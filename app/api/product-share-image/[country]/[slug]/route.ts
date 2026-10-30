import sharp from 'sharp';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_SOCIAL_BYTES = 580 * 1024;

function isAllowedProductImageUrl(source: string): URL | null {
  try {
    const url = new URL(source);
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.supabase.co') ||
      !url.pathname.includes('/storage/v1/object/public/product-images/')
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function makeSocialJpeg(input: Buffer): Promise<Buffer> {
  const base = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
    .rotate()
    .resize(1200, 630, { fit: 'contain', background: '#ffffff' });

  let output = await base.clone().jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  if (output.byteLength > MAX_SOCIAL_BYTES) {
    output = await base.clone().jpeg({ quality: 68, mozjpeg: true }).toBuffer();
  }
  if (output.byteLength > MAX_SOCIAL_BYTES) {
    output = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize(900, 473, { fit: 'contain', background: '#ffffff' })
      .jpeg({ quality: 60, mozjpeg: true })
      .toBuffer();
  }

  if (output.byteLength > MAX_SOCIAL_BYTES) {
    throw new Error('Product share image exceeds the size limit after compression');
  }
  return output;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ country: string; slug: string }> },
) {
  const { country: rawCountry, slug } = await params;
  const country = rawCountry.toUpperCase();
  if ((country !== 'IN' && country !== 'BD') || !slug) {
    return new Response('Not found', { status: 404 });
  }

  const supabase = await createServerSupabase(country);
  const { data: product, error } = await supabase
    .from('products')
    .select('image, images')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  if (error) return new Response('Image unavailable', { status: 502 });
  if (!product) return new Response('Not found', { status: 404 });

  const source = (Array.isArray(product.images) ? product.images.find((item) => typeof item === 'string' && item.trim()) : null)
    || product.image;
  const imageUrl = typeof source === 'string' ? isAllowedProductImageUrl(source) : null;
  if (!imageUrl) return new Response('Image unavailable', { status: 404 });

  try {
    const imageResponse = await fetch(imageUrl, {
      cache: 'force-cache',
      next: { revalidate: 86_400 },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!imageResponse.ok) return new Response('Image unavailable', { status: 502 });

    const declaredLength = Number(imageResponse.headers.get('content-length') || 0);
    if (declaredLength > MAX_SOURCE_BYTES) return new Response('Image unavailable', { status: 413 });

    const input = Buffer.from(await imageResponse.arrayBuffer());
    if (input.byteLength === 0 || input.byteLength > MAX_SOURCE_BYTES) {
      return new Response('Image unavailable', { status: 413 });
    }

    const jpeg = await makeSocialJpeg(input);
    return new Response(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(jpeg.byteLength),
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Image unavailable', { status: 502 });
  }
}
