import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import { createClient } from '@supabase/supabase-js';
import sharp, { type Metadata, type OutputInfo } from 'sharp';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_WATERMARK_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff']);

type SafeAddress = { address: string; family: 4 | 6 };

class ImageImportError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ImageImportError';
    this.status = status;
    this.code = code;
  }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isPublicAddress(address: string, family: number): boolean {
  if (family === 4) {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }

    const [a, b, c] = parts;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      (a === 255)
    ) {
      return false;
    }

    return true;
  }

  if (family === 6) {
    // Only global-unicast IPv6 (2000::/3) is accepted. This rejects loopback,
    // link-local, unique-local, multicast, unspecified and IPv4-mapped ranges.
    const firstWord = Number.parseInt(address.split(':')[0] || '0', 16);
    return Number.isFinite(firstWord) && firstWord >= 0x2000 && firstWord <= 0x3fff;
  }

  return false;
}

async function resolvePublicAddress(hostname: string): Promise<SafeAddress> {
  const ipVersion = isIP(hostname);
  if (ipVersion) {
    if (!isPublicAddress(hostname, ipVersion)) {
      throw new ImageImportError(400, 'PRIVATE_HOST', 'Private বা local network-এর image URL গ্রহণ করা যাবে না।');
    }
    return { address: hostname, family: ipVersion as 4 | 6 };
  }

  const normalizedHost = hostname.toLowerCase().replace(/\.$/, '');
  if (
    !normalizedHost ||
    normalizedHost === 'localhost' ||
    normalizedHost.endsWith('.localhost') ||
    normalizedHost.endsWith('.local') ||
    normalizedHost.endsWith('.internal') ||
    normalizedHost.endsWith('.test') ||
    normalizedHost.endsWith('.invalid') ||
    normalizedHost.endsWith('.example') ||
    normalizedHost.endsWith('.onion')
  ) {
    throw new ImageImportError(400, 'PRIVATE_HOST', 'এই image URL-এর hostname public internet address নয়।');
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(normalizedHost, { all: true, verbatim: true });
  } catch {
    throw new ImageImportError(422, 'DNS_LOOKUP_FAILED', 'Image host খুঁজে পাওয়া যায়নি। URL ঠিক আছে কি না পরীক্ষা করুন।');
  }

  if (!records.length || records.some((record) => !isPublicAddress(record.address, record.family))) {
    throw new ImageImportError(400, 'UNSAFE_HOST', 'Image URL private বা restricted network-এ resolve হচ্ছে, তাই গ্রহণ করা হয়নি।');
  }

  const selected = records.find((record) => record.family === 4) || records[0];
  return { address: selected.address, family: selected.family as 4 | 6 };
}

function validateImageUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImageImportError(400, 'INVALID_URL', 'সঠিক পূর্ণ image URL দিন (https:// দিয়ে শুরু হতে হবে)।');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !url.hostname
  ) {
    throw new ImageImportError(400, 'INVALID_URL', 'শুধু public HTTPS image URL ব্যবহার করুন।');
  }

  url.hash = '';
  return url;
}

type DownloadResponse = {
  status: number;
  location?: string;
  contentType: string;
  contentLength?: number;
  buffer?: Buffer;
};

function requestPinnedUrl(url: URL, address: SafeAddress, maxBytes: number): Promise<DownloadResponse> {
  return new Promise((resolve, reject) => {
    const pinnedLookup = ((
      _hostname: string,
      options: number | { all?: boolean },
      callback: (...args: any[]) => void,
    ) => {
      if (typeof options === 'object' && options.all) {
        callback(null, [address]);
      } else {
        callback(null, address.address, address.family);
      }
    }) as any;

    const agent = new https.Agent({ keepAlive: false, lookup: pinnedLookup });
    const request = https.request(
      url,
      {
        method: 'GET',
        agent,
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/tiff,application/octet-stream;q=0.8',
          'User-Agent': 'GAZI-SEED-Product-Image-Importer/1.0',
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        const location = response.headers.location;
        const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const contentLength = Number(response.headers['content-length'] || 0) || undefined;

        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume();
          agent.destroy();
          resolve({ status, location, contentType, contentLength });
          return;
        }

        if (contentLength && contentLength > maxBytes) {
          response.resume();
          agent.destroy();
          reject(new ImageImportError(413, 'IMAGE_TOO_LARGE', 'Image file 10 MB সীমার চেয়ে বড়। ছোট image URL ব্যবহার করুন।'));
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;
        response.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxBytes) {
            request.destroy(new ImageImportError(413, 'IMAGE_TOO_LARGE', 'Image file নির্ধারিত size limit অতিক্রম করেছে।'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          agent.destroy();
          resolve({
            status,
            location,
            contentType,
            contentLength,
            buffer: Buffer.concat(chunks),
          });
        });
        response.on('error', (error) => {
          agent.destroy();
          reject(error);
        });
      },
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new ImageImportError(504, 'IMAGE_HOST_TIMEOUT', 'Image host response দিতে বেশি সময় নিচ্ছে। পরে আবার চেষ্টা করুন।'));
    });
    request.on('error', (error) => {
      agent.destroy();
      reject(error);
    });
    request.end();
  });
}

async function downloadPublicImage(rawUrl: string, maxBytes: number): Promise<{ buffer: Buffer; contentType: string }> {
  let currentUrl = validateImageUrl(rawUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const address = await resolvePublicAddress(currentUrl.hostname);
    const result = await requestPinnedUrl(currentUrl, address, maxBytes);

    if ([301, 302, 303, 307, 308].includes(result.status)) {
      if (!result.location || redirects === MAX_REDIRECTS) {
        throw new ImageImportError(422, 'TOO_MANY_REDIRECTS', 'Image URL অতিরিক্ত redirect করছে। সরাসরি image URL ব্যবহার করুন।');
      }
      currentUrl = validateImageUrl(new URL(result.location, currentUrl).toString());
      continue;
    }

    if (result.status !== 200 || !result.buffer?.length) {
      if (result.status === 401 || result.status === 403) {
        throw new ImageImportError(422, 'IMAGE_HOST_DENIED', 'Image host download অনুমতি দেয়নি (HTTP ' + result.status + ')। Public direct image URL ব্যবহার করুন অথবা device থেকে upload করুন।');
      }
      throw new ImageImportError(422, 'IMAGE_DOWNLOAD_FAILED', 'Image URL download করা যায়নি (HTTP ' + result.status + ')। URL public ও সরাসরি image file কি না পরীক্ষা করুন।');
    }

    if (
      result.contentType === 'image/svg+xml' ||
      (!result.contentType.startsWith('image/') && result.contentType !== 'application/octet-stream')
    ) {
      throw new ImageImportError(415, 'NOT_AN_IMAGE', 'এই URL image file ফেরত দেয়নি। সরাসরি JPG, PNG, WebP বা অন্য supported image URL দিন।');
    }

    return { buffer: result.buffer, contentType: result.contentType };
  }

  throw new ImageImportError(422, 'TOO_MANY_REDIRECTS', 'Image URL resolve করা যায়নি।');
}

async function optimizeProductImage(
  source: Buffer,
  watermark: {
    enabled: boolean;
    logoUrl: string;
    opacity: number;
    size: number;
  },
): Promise<Buffer> {
  let metadata: Metadata;
  try {
    metadata = await sharp(source, { limitInputPixels: 40_000_000, animated: false }).metadata();
  } catch {
    throw new ImageImportError(415, 'INVALID_IMAGE', 'ডাউনলোড করা file-টি valid image হিসেবে পড়া যাচ্ছে না।');
  }

  if (
    !metadata.format ||
    !ALLOWED_FORMATS.has(metadata.format) ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new ImageImportError(415, 'UNSUPPORTED_IMAGE', 'এই image format support করা হচ্ছে না। JPG, PNG, WebP বা AVIF ব্যবহার করুন।');
  }

  let processed: { data: Buffer; info: OutputInfo };
  try {
    processed = await sharp(source, { limitInputPixels: 40_000_000, animated: false })
      .rotate()
      .resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 93, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ImageImportError(415, 'IMAGE_PROCESSING_FAILED', 'Image resize বা WebP conversion করা যায়নি। অন্য image file চেষ্টা করুন।');
  }

  if (watermark.enabled && watermark.logoUrl) {
    const logo = await downloadPublicImage(watermark.logoUrl, MAX_WATERMARK_BYTES);
    let logoMetadata: Metadata;
    try {
      logoMetadata = await sharp(logo.buffer, { limitInputPixels: 16_000_000 }).metadata();
    } catch {
      throw new ImageImportError(422, 'WATERMARK_INVALID', 'বর্তমান watermark logo পড়া যাচ্ছে না। Admin watermark settings পরীক্ষা করুন।');
    }

    if (!logoMetadata.format || !ALLOWED_FORMATS.has(logoMetadata.format)) {
      throw new ImageImportError(422, 'WATERMARK_INVALID', 'বর্তমান watermark logo format support করা হচ্ছে না।');
    }

    const targetWidth = Math.max(
      120,
      Math.round(Math.min(processed.info.width, processed.info.height) * watermark.size),
    );
    const logoPng = await sharp(logo.buffer, { limitInputPixels: 16_000_000 })
      .resize({ width: targetWidth, height: targetWidth, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });

    const safeOpacity = Math.max(0, Math.min(1, watermark.opacity));
    const svg = Buffer.from(
      '<svg width="' + processed.info.width + '" height="' + processed.info.height + '" xmlns="http://www.w3.org/2000/svg">' +
      '<image href="data:image/png;base64,' + logoPng.data.toString('base64') + '" ' +
      'width="' + logoPng.info.width + '" height="' + logoPng.info.height + '" ' +
      'x="' + Math.round((processed.info.width - logoPng.info.width) / 2) + '" ' +
      'y="' + Math.round((processed.info.height - logoPng.info.height) / 2) + '" ' +
      'opacity="' + safeOpacity + '"/>' +
      '</svg>',
    );

    processed = await sharp(processed.data)
      .composite([{ input: svg }])
      .webp({ quality: 93, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  }

  return processed.data;
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ success: false, message: 'Cross-site request rejected.' }, { status: 403 });
    }

    const accessToken =
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
    if (!accessToken) {
      return NextResponse.json({ success: false, message: 'Admin login প্রয়োজন। আবার লগইন করুন।' }, { status: 401 });
    }

    const admin = serviceClient();
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Image import server configuration incomplete.' }, { status: 500 });
    }

    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return NextResponse.json({ success: false, message: 'Admin session মেয়াদ শেষ হয়েছে। আবার লগইন করুন।' }, { status: 401 });
    }

    const { data: adminRow, error: adminError } = await admin
      .from('admin_users')
      .select('user_id,role,country_code')
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!adminRow) {
      return NextResponse.json({ success: false, message: 'Active admin access প্রয়োজন।' }, { status: 403 });
    }

    let countryCode = String(adminRow.country_code || '').toUpperCase();
    if (adminRow.role === 'master_admin') {
      const { data: branchContext, error: branchError } = await admin
        .from('admin_branch_context')
        .select('country_code')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (branchError) throw branchError;
      countryCode = String(branchContext?.country_code || '').toUpperCase();
    }

    if (countryCode !== 'BD' && countryCode !== 'IN') {
      return NextResponse.json({ success: false, message: 'Admin branch যাচাই করা যায়নি। Branch পুনরায় নির্বাচন করুন।' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const sourceUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!sourceUrl || sourceUrl.length > 2_048) {
      return NextResponse.json({ success: false, message: 'একটি valid image URL দিন (সর্বোচ্চ 2048 characters)।' }, { status: 400 });
    }

    const { data: settings, error: settingsError } = await admin
      .from('site_settings')
      .select('watermark_enabled,watermark_logo_url,watermark_opacity,watermark_size,watermark_position')
      .eq('country_code', countryCode)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const watermark = {
      enabled: settings?.watermark_enabled ?? true,
      logoUrl: String(settings?.watermark_logo_url || '').trim(),
      opacity: Math.max(0, Math.min(1, Number(settings?.watermark_opacity ?? 0.35))),
      size: Math.max(0.05, Math.min(0.85, Number(settings?.watermark_size ?? 0.35))),
    };

    const downloaded = await downloadPublicImage(sourceUrl, MAX_IMAGE_BYTES);
    const processedImage = await optimizeProductImage(downloaded.buffer, watermark);
    const fileName = Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.webp';

    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(fileName, processedImage, {
        cacheControl: '31536000',
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      console.error('[admin/product-images/import] Storage upload failed:', uploadError.message);
      return NextResponse.json({ success: false, message: 'Image processing হয়েছে, কিন্তু Supabase Storage upload ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' }, { status: 502 });
    }

    const { data: publicUrlData } = admin.storage.from('product-images').getPublicUrl(fileName);
    if (!publicUrlData.publicUrl) {
      return NextResponse.json({ success: false, message: 'Image upload হয়েছে, কিন্তু public URL তৈরি করা যায়নি।' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      format: 'webp',
      country_code: countryCode,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ImageImportError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status },
      );
    }

    console.error(
      '[admin/product-images/import] Unexpected failure:',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { success: false, message: 'Image import ব্যর্থ হয়েছে। URL, image format এবং admin storage access পরীক্ষা করে আবার চেষ্টা করুন।' },
      { status: 500 },
    );
  }
}
