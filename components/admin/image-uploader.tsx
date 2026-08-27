'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Upload, X, GripVertical, Link as LinkIcon } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';

type ImageUploaderProps = {
  images: string[];
  onChange: (images: string[]) => void;
  label?: string;
  max?: number;
  recommendation?: string;
};

export function ImageUploader({ images, onChange, label = 'ছবি', max = 10, recommendation }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList) => {
    setUploading(true);
    try {
      const newImages: string[] = [];
      for (const file of Array.from(files)) {
        if (images.length + newImages.length >= max) break;
        const processed = await processLocalImage(file);
        const url = await uploadProcessedFile(processed, 'product-images', supabase);
        newImages.push(url);
      }
      onChange([...images, ...newImages]);
      toast(`${newImages.length} টি ছবি আপলোড হয়েছে`);
    } catch (err: any) {
      toast(`আপলোড ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  }, [images, max, onChange]);

  const importFromUrl = async () => {
    if (!urlInput.trim()) return;
    if (images.length >= max) { toast(`সর্বোচ্চ ${max} টি ছবি`, 'error'); return; }
    setUploading(true);
    try {
      const processed = await processUrlImage(urlInput.trim());
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      onChange([...images, url]);
      setUrlInput('');
      toast('ছবি ইম্পোর্ট ও ওয়াটারমার্ক করা হয়েছে');
    } catch (err: any) {
      toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const updated = [...images];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    onChange(updated);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {recommendation && <p className="mb-2 text-xs text-muted-foreground">Recommended: {recommendation} — Best for display</p>}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary/40"
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">ছবি আপলোড করতে ক্লিক করুন বা ড্র্যাগ করুন</p>
        <p className="text-xs text-muted-foreground/60">PNG, JPG, WebP (সর্বোচ্চ {max} টি) — স্বয়ংক্রিয় রিসাইজ ও ওয়াটারমার্ক প্রয়োগ হবে</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      <div className="mt-2 flex gap-1">
        <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="flex-1 rounded-lg border border-input px-3 py-2 text-sm" placeholder="অথবা ছবি URL দিন (ওয়াটারমার্ক সহ প্রসেস হবে)" />
        <button type="button" onClick={importFromUrl} disabled={uploading} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">
          <LinkIcon className="h-4 w-4" /> ইম্পোর্ট
        </button>
      </div>

      {uploading && <p className="mt-2 text-sm text-primary">প্রসেস ও আপলোড হচ্ছে...</p>}

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((img, idx) => (
            <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/20"
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragEnd={() => setDragIdx(null)}
              onDragOver={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) moveImage(dragIdx, idx); }}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
              {idx === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Main</span>}
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-1 left-1 cursor-grab opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical className="h-4 w-4 text-white drop-shadow" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type VideoUploaderProps = {
  videoUrl: string;
  onChange: (url: string) => void;
  label?: string;
};

export function VideoUploader({ videoUrl, onChange, label = 'ভিডিও' }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadVideo = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-video-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) { toast(`আপলোড ব্যর্থ: ${error.message}`, 'error'); return; }
      const { data: url } = supabase.storage.from('product-images').getPublicUrl(fileName);
      onChange(url.publicUrl);
      toast('ভিডিও আপলোড হয়েছে');
    } catch {
      toast('আপলোড ব্যর্থ', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) uploadVideo(e.dataTransfer.files[0]); }}
        onDragOver={(e) => e.preventDefault()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 hover:border-primary/40"
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">ভিডিও আপলোড করুন (MP4, WebM)</p>
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadVideo(e.target.files[0]); e.target.value = ''; }} />
      </div>
      {uploading && <p className="mt-2 text-sm text-primary">আপলোড হচ্ছে...</p>}
      {videoUrl && (
        <div className="mt-2">
          <video src={videoUrl} controls className="w-full max-w-xs rounded-lg" />
          <button onClick={() => onChange('')} className="mt-1 text-xs text-destructive hover:underline">ভিডিও মুছুন</button>
        </div>
      )}
    </div>
  );
}

type SingleImageUploaderProps = {
  imageUrl: string;
  onChange: (url: string) => void;
  label?: string;
  /** Max width/height for processing. Default 1200x1200. */
  maxWidth?: number;
  maxHeight?: number;
  recommendation?: string;
};

export function SingleImageUploader({ imageUrl, onChange, label = 'ছবি', maxWidth = 1200, maxHeight = 1200, recommendation }: SingleImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const processed = await processLocalImage(file, { maxWidth, maxHeight });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      onChange(url);
      toast('ছবি আপলোড ও ওয়াটারমার্ক হয়েছে');
    } catch (err: any) {
      toast(`আপলোড ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const importFromUrl = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      const processed = await processUrlImage(urlInput.trim(), { maxWidth, maxHeight });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      onChange(url);
      setUrlInput('');
      setShowUrlInput(false);
      toast('ছবি ইম্পোর্ট ও ওয়াটারমার্ক হয়েছে');
    } catch (err: any) {
      toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {recommendation && <p className="mb-2 text-xs text-muted-foreground">Recommended: {recommendation} — Best for display</p>}
      {imageUrl ? (
        <div className="group relative inline-block">
          <img src={imageUrl} alt="" className="h-24 w-24 rounded-lg border border-border object-cover" />
          <button onClick={() => onChange('')} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) uploadImage(e.dataTransfer.files[0]); }}
            onDragOver={(e) => e.preventDefault()}
            className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/40"
          >
            <Upload className="h-6 w-6 text-muted-foreground/40" />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); e.target.value = ''; }} />
          </div>
          {!showUrlInput ? (
            <button type="button" onClick={() => setShowUrlInput(true)} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <LinkIcon className="h-3 w-3" /> URL থেকে ইম্পোর্ট
            </button>
          ) : (
            <div className="flex gap-1">
              <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="flex-1 rounded-lg border border-input px-2 py-1 text-xs" placeholder="ছবি URL" />
              <button type="button" onClick={importFromUrl} disabled={uploading} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50">যোগ</button>
            </div>
          )}
        </div>
      )}
      {uploading && <p className="mt-1 text-xs text-primary">প্রসেস হচ্ছে...</p>}
    </div>
  );
}
