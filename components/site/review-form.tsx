'use client';

import { useState, useRef } from 'react';
import { Star, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from '@/components/site/toast-provider';
import { useFeatureFlags } from '@/components/site/feature-provider';

export type ReviewFormProps = {
  productId: string;
  productName: string;
  user: any;
  isVerifiedPurchase: boolean;
  onSubmitted: () => void;
};

export function ReviewForm({ productId, productName, user, isVerifiedPurchase, onSubmitted }: ReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ready: featuresReady, enabled } = useFeatureFlags();
  const photoReviewsEnabled = featuresReady && enabled('enable_photo_reviews');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!photoReviewsEnabled) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { toast('রেটিং দিন', 'error'); return; }
    if (!user && !guestName.trim()) { toast('নাম দিন', 'error'); return; }
    if (reviewText.trim().length < 5) { toast('রিভিউ লিখুন (কমপক্ষে ৫ অক্ষর)', 'error'); return; }

    setSubmitting(true);
    try {
      let photoUrl = '';
      if (photoReviewsEnabled && imageFile) {
        const ext = imageFile.name.split('.').pop();
        const fileName = `review-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, imageFile, { cacheControl: '3600', upsert: false });
        if (!uploadError) {
          const { data: url } = supabase.storage.from('product-images').getPublicUrl(fileName);
          photoUrl = url.publicUrl;
        }
      }

      const { error } = await supabase.from('reviews').insert({
        product_id: productId,
        customer_name: user?.user_metadata?.name || user?.email?.split('@')[0] || guestName.trim() || 'গ্রাহক',
        rating,
        review: reviewText.trim(),
        photo: photoUrl,
        is_approved: false,
        status: 'pending',
        verified_purchase: isVerifiedPurchase,
        user_id: user?.id || null,
        guest_phone: !user ? guestPhone.trim() || null : null,
      });

      if (error) throw error;

      setSubmitted(true);
      setRating(0);
      setReviewText('');
      removeImage();
      onSubmitted();
    } catch (err: any) {
      toast(err.message || 'রিভিউ জমা দিতে সমস্যা', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <p className="font-semibold text-green-800">আপনার রিভিউ সফলভাবে জমা হয়েছে। অনুমোদনের পর প্রকাশিত হবে।</p>
        <button onClick={() => { setSubmitted(false); setOpen(false); }} className="mt-4 rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100">ঠিক আছে</button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Star className="h-5 w-5" /> রিভিউ দিন
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">রিভিউ লিখুন</h3>
        <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!user && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">নাম *</label>
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="input-bangla" placeholder="আপনার নাম" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ফোন (ঐচ্ছিক)</label>
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="input-bangla" placeholder="ফোন নম্বর" />
            </div>
          </div>
        )}
        <div>
          <label className="mb-2 block text-sm font-medium">রেটিং *</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="p-1">
                <Star className={`h-8 w-8 transition-colors ${(hoverRating || rating) >= star ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-300'}`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">রিভিউ *</label>
          <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} className="input-bangla min-h-[100px]" placeholder="আপনার অভিজ্ঞতা লিখুন..." required />
        </div>

        {photoReviewsEnabled && (
          <div>
            <label className="mb-1 block text-sm font-medium">ছবি (ঐচ্ছিক)</label>
            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="" className="h-24 w-24 rounded-lg border border-border object-cover" />
                <button type="button" onClick={removeImage} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-secondary">
                <Upload className="h-4 w-4" /> ছবি আপলোড করুন
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
        )}

        <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> জমা হচ্ছে...</> : 'রিভিউ জমা দিন'}
        </button>
      </form>
    </div>
  );
}
