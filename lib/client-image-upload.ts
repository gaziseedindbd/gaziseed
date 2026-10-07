'use client';

import imageCompression from 'browser-image-compression';
import { processLocalImage } from '@/lib/image-processing';

export type ImageUploadPreset =
  | 'product'
  | 'category'
  | 'category-banner'
  | 'logo'
  | 'watermark';

const PRESETS: Record<ImageUploadPreset, {
  maxWidth: number;
  maxHeight: number;
  maxSizeMB: number;
  quality: number;
  watermark: boolean;
}> = {
  // Product images keep higher resolution and avoid unnecessary second-pass compression.
  product: { maxWidth: 1800, maxHeight: 1800, maxSizeMB: 1.5, quality: 0.93, watermark: true },
  category: { maxWidth: 800, maxHeight: 800, maxSizeMB: 0.22, quality: 0.8, watermark: true },
  'category-banner': { maxWidth: 1200, maxHeight: 400, maxSizeMB: 0.28, quality: 0.8, watermark: true },
  logo: { maxWidth: 360, maxHeight: 240, maxSizeMB: 0.12, quality: 0.78, watermark: false },
  watermark: { maxWidth: 600, maxHeight: 400, maxSizeMB: 0.16, quality: 0.78, watermark: false },
};

export async function optimizeImageForUpload(
  file: File,
  preset: ImageUploadPreset = 'product',
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image is too large. Please choose an image under 15 MB.');
  }

  const target = PRESETS[preset];
  const processed = await processLocalImage(file, {
    maxWidth: target.maxWidth,
    maxHeight: target.maxHeight,
    format: 'image/webp',
    quality: target.quality,
    watermark: { enabled: target.watermark },
  });

  try {
    // Avoid re-encoding product images that are already within the target size.
    // A second lossy WebP pass can soften fine text and seed-packet details.
    if (preset === 'product' && processed.size <= target.maxSizeMB * 1024 * 1024) {
      return processed;
    }

    const compressed = await imageCompression(processed, {
      maxSizeMB: target.maxSizeMB,
      maxWidthOrHeight: Math.max(target.maxWidth, target.maxHeight),
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: target.quality,
      alwaysKeepResolution: false,
    });

    return new File([compressed], processed.name.replace(/\.[^.]+$/, '.webp'), {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch {
    // processLocalImage already guarantees WebP + dimension control.
    return processed;
  }
}

export async function optimizeImageUrlForUpload(
  url: string,
  preset: ImageUploadPreset = 'product',
): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download image URL.');
  }

  const blob = await response.blob();
  const source = new File([blob], 'url-image', {
    type: blob.type || 'image/jpeg',
    lastModified: Date.now(),
  });

  return optimizeImageForUpload(source, preset);
}
