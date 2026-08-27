/**
 * Client-side image processing: resize + apply SEED BARI branding watermark.
 * Uses Canvas API with robust cross-origin & fallback loading.
 */

export type WatermarkSettings = {
  enabled?: boolean;
  logoUrl?: string;
  opacity?: number;
  size?: number;
  position?: 'center';
};

export type ProcessOptions = {
  maxWidth?: number;
  maxHeight?: number;
  format?: 'image/jpeg' | 'image/webp' | 'image/png';
  quality?: number;
  watermark?: WatermarkSettings;
};

const DEFAULT_LOGO = 'https://pfvwovplgwrsewwkkoir.supabase.co/storage/v1/object/public/product-images/site-logo-1786985837266.png';

const DEFAULTS: Required<Omit<ProcessOptions, 'watermark'>> & { watermark: Required<WatermarkSettings> } = {
  maxWidth: 1600,
  maxHeight: 1600,
  format: 'image/webp',
  quality: 0.82,
  watermark: {
    enabled: true,
    logoUrl: DEFAULT_LOGO,
    opacity: 0.35,
    size: 0.35,
    position: 'center',
  },
};

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from blob'));
    };
    img.src = url;
  });
}

async function loadLogoSafe(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    return await blobToImage(blob);
  } catch (err) {
    console.warn('CORS Fetch failed for watermark logo, trying direct Image():', err);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn('Direct Image load also failed for watermark');
        resolve(null);
      };
      img.src = url;
    });
  }
}

async function resolveOptions(options?: ProcessOptions): Promise<Required<Omit<ProcessOptions, 'watermark'>> & { watermark: Required<WatermarkSettings> }> {
  let savedWatermark: WatermarkSettings = {};
  try {
    const { supabase } = await import('@/lib/supabase/client');
    const { data } = await supabase
      .from('site_settings')
      .select('watermark_enabled, watermark_logo_url, watermark_opacity, watermark_size, watermark_position')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      savedWatermark = {
        enabled: data.watermark_enabled ?? true,
        logoUrl: data.watermark_logo_url || DEFAULT_LOGO,
        opacity: data.watermark_opacity ?? 0.35,
        size: data.watermark_size ?? 0.35,
        position: 'center',
      };
    }
  } catch {
    savedWatermark = {};
  }

  return {
    ...DEFAULTS,
    ...options,
    watermark: { ...DEFAULTS.watermark, ...savedWatermark, ...options?.watermark },
  };
}

export async function processLocalImage(file: File, options?: ProcessOptions): Promise<File> {
  const opts = await resolveOptions(options);
  const mainImg = await blobToImage(file);

  let { width, height } = mainImg;
  const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height, 1);
  if (ratio < 1) {
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // ১. মূল ছবি ড্র করা
  ctx.drawImage(mainImg, 0, 0, width, height);

  // ২. ওয়াটারমার্ক স্ট্যাম্প করা
  if (opts.watermark.enabled) {
    const logoImg = await loadLogoSafe(opts.watermark.logoUrl);
    if (logoImg) {
      const targetWidth = Math.max(120, Math.round(Math.min(width, height) * opts.watermark.size));
      const naturalW = logoImg.naturalWidth || logoImg.width || 300;
      const naturalH = logoImg.naturalHeight || logoImg.height || 100;
      const logoRatio = naturalW / naturalH;
      const targetHeight = Math.round(targetWidth / logoRatio);

      const x = Math.round((width - targetWidth) / 2);
      const y = Math.round((height - targetHeight) / 2);

      ctx.save();
      ctx.globalAlpha = opts.watermark.opacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(logoImg, x, y, targetWidth, targetHeight);
      ctx.restore();
    }
  }

  // ৩. প্রসেসড ব্লব থেকে ফাইল তৈরি
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Failed to generate canvas blob')),
      opts.format,
      opts.quality
    );
  });

  const ext = opts.format === 'image/png' ? 'png' : opts.format === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `watermarked-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`, {
    type: opts.format,
  });
}

export async function processUrlImage(url: string, options?: ProcessOptions): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to download image URL');
  const blob = await res.blob();
  const file = new File([blob], 'url-download.jpg', { type: blob.type });
  return await processLocalImage(file, options);
}

export async function uploadProcessedFile(
  file: File,
  bucket: string,
  supabaseClient: import('@supabase/supabase-js').SupabaseClient,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'webp';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '31536000',
      contentType: file.type || 'image/webp',
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}
