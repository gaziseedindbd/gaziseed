'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';
import { Upload, Link as LinkIcon, X, Star } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import imageCompression from 'browser-image-compression';

export type MediaUploaderProps = {
  images: string[];
  setImages: (v: string[]) => void;
  bucket?: string;
  label?: string;
  maxImages?: number;
  recommendation?: string;
};

export function MediaUploader({ images, setImages, bucket = 'product-images', label = 'পণ্যের ছবি', maxImages = 10, recommendation }: MediaUploaderProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified SEED BARI image pipeline: current General Settings watermark + resize + compression + upload.
  const processAndUploadFile = async (file: File) => {
    const processed = await processLocalImage(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      format: 'image/webp',
      quality: 0.85,
    });

    let optimizedFile = processed;
    try {
      optimizedFile = await imageCompression(processed, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.85,
      });
    } catch {
      // Keep the already watermarked file as a safe fallback.
    }

    return uploadProcessedFile(optimizedFile, bucket, supabase);
  };

  const processAndUploadUrl = async (url: string) => {
    const processed = await processUrlImage(url, {
      maxWidth: 1200,
      maxHeight: 1200,
      format: 'image/webp',
      quality: 0.85,
    });

    let optimizedFile = processed;
    try {
      optimizedFile = await imageCompression(processed, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.85,
      });
    } catch {
      // Keep the already watermarked file as a safe fallback.
    }

    return uploadProcessedFile(optimizedFile, bucket, supabase);
  };

  const uploadFiles = async (files: FileList) => {
    if (images.length + files.length > maxImages) {
      toast(`সর্বোচ্চ ${maxImages} টি ছবি দেওয়া যাবে`, 'error');
      return;
    }
    setUploading(true);
    try {
      const newImages: string[] = [];
      for (const file of Array.from(files)) {
        const url = await processAndUploadFile(file);
        newImages.push(url);
      }
      setImages([...images, ...newImages]);
      if (newImages.length > 0) toast(`${newImages.length} টি ছবি ওয়াটারমার্ক ও অপটিমাইজ হয়ে আপলোড হয়েছে`);
    } catch (err: any) {
      toast(`আপলোড ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const addUrlImage = async () => {
    if (!imageUrl.trim()) return;
    if (images.length >= maxImages) {
      toast(`সর্বোচ্চ ${maxImages} টি ছবি`, 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await processAndUploadUrl(imageUrl.trim());
      setImages([...images, url]);
      setImageUrl('');
      toast('ছবি ওয়াটারমার্ক ও অপটিমাইজ সম্পন্ন হয়েছে');
    } catch (err: any) {
      toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => setImages(images.filter((_, i) => i !== idx));
  const setMain = (idx: number) => {
    const updated = [...images];
    const [img] = updated.splice(idx, 1);
    updated.unshift(img);
    setImages(updated);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{label}</h3>
      {recommendation && <p className="text-xs text-muted-foreground">Recommended: {recommendation} — Best for display</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Upload className="h-4 w-4" /> {uploading ? 'ওয়াটারমার্ক ও আপলোড হচ্ছে...' : 'ডিভাইস থেকে ছবি আপলোড করুন'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }} />
        <div className="flex flex-1 gap-1">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1 rounded-lg border border-input px-3 py-2 text-sm" placeholder="অথবা ছবি URL দিন (ওয়াটারমার্ক হবে)" />
          <button type="button" onClick={addUrlImage} disabled={uploading} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><LinkIcon className="h-4 w-4" /> ইম্পোর্ট</button>
        </div>
      </div>
      {uploading && <p className="text-sm text-primary">ওয়াটারমার্ক যুক্ত হয়ে অপটিমাইজ (WebP) ও আপলোড হচ্ছে...</p>}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((img, idx) => (
            <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/20">
              <img src={img} alt="" className="h-full w-full object-cover" />
              {idx === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Main</span>}
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {idx !== 0 && <button type="button" onClick={() => setMain(idx)} className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"><Star className="h-3 w-3" /></button>}
                <button type="button" onClick={() => removeImage(idx)} className="rounded bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
