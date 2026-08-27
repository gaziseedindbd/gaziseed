import imageCompression from 'browser-image-compression';
import { supabase } from './supabase/client';

export async function optimizeAndUploadImage(
  file: File,
  bucketName = 'product-images'
): Promise<string> {
  const options = {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.85,
  };

  // ব্রাউজারেই কম্প্রেশন এবং WebP ফরম্যাটে রূপান্তর
  const compressedBlob = await imageCompression(file, options);

  // ইউনিক ফাইল নাম তৈরি
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
  const finalFileName = `${timestamp}-${cleanFileName}-${randomStr}.webp`;

  // Supabase Storage-এ আপলোড
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(finalFileName, compressedBlob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  // পাবলিক URL সংগ্রহ
  const { data: publicData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return publicData.publicUrl;
}
