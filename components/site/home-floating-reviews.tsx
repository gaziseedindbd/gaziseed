'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Star, X, Quote } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface FloatingReview {
  id: string;
  customer_name: string;
  review: string;
  rating: number;
}

export default function HomeFloatingReviews() {
  const pathname = usePathname();
  const [reviews, setReviews] = useState<FloatingReview[]>([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== '/') return;
    const newsletter = document.querySelector('.newsletter-wrap');
    const newsletterSection = newsletter?.closest('section');
    if (!newsletterSection?.parentElement) return;
    const host = document.createElement('div');
    host.className = 'section-pad home-review-flow-host';
    newsletterSection.parentElement.insertBefore(host, newsletterSection);
    setPortalHost(host);
    return () => { setPortalHost(null); host.remove(); };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') return;
    let mounted = true;
    const loadReviews = async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, customer_name, review, rating')
        .eq('is_approved', true)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(12);
      if (!mounted || error || !data?.length) return;
      setReviews(data as FloatingReview[]);
      setCurrent(0);
      setVisible(true);
    };
    loadReviews();
    const refresh = window.setInterval(loadReviews, 60000);
    return () => { mounted = false; window.clearInterval(refresh); };
  }, [pathname]);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const interval = window.setInterval(() => setCurrent((prev) => (prev + 1) % reviews.length), 6500);
    return () => window.clearInterval(interval);
  }, [reviews.length]);

  if (pathname !== '/' || !visible || reviews.length === 0 || !portalHost) return null;

  const review = reviews[current];
  const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));

  return createPortal(
    <div className="container-custom" aria-live="polite">
      <div className="flex justify-end overflow-hidden">
        <div key={review.id} className="w-full max-w-xl animate-in slide-in-from-right duration-700">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,.5)] ring-1 ring-primary/5 dark:bg-card">
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-20 rounded-full bg-accent/10 blur-2xl" />
            <button type="button" onClick={() => setVisible(false)} className="absolute right-3 top-3 rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close customer review">
              <X className="h-4 w-4" />
            </button>
            <div className="relative pr-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Quote className="h-4 w-4 fill-current" /></span>
                <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />)}
                </div>
              </div>
              <p className="line-clamp-3 text-[15px] font-medium leading-7 text-foreground/85">“{review.review}”</p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div><p className="text-sm font-black text-foreground">— {review.customer_name}</p><p className="mt-0.5 text-[11px] font-medium text-muted-foreground">সন্তুষ্ট গ্রাহকের মতামত</p></div>
                {reviews.length > 1 && <div className="flex items-center gap-1.5">{reviews.slice(0, Math.min(reviews.length, 5)).map((item, index) => <span key={item.id} className={`h-1.5 rounded-full transition-all ${index === current % 5 ? 'w-5 bg-primary' : 'w-1.5 bg-primary/20'}`} />)}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalHost,
  );
}
