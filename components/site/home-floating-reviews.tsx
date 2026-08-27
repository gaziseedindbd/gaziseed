'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Star, X } from 'lucide-react';
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

    // The review widget is mounted from the root layout, but visually belongs
    // immediately above the Home page newsletter section. Create a normal
    // document-flow host there instead of using fixed/sticky positioning.
    const newsletter = document.querySelector('.newsletter-wrap');
    const newsletterSection = newsletter?.closest('section');
    if (!newsletterSection?.parentElement) return;

    const host = document.createElement('div');
    host.className = 'section-pad home-review-flow-host';
    newsletterSection.parentElement.insertBefore(host, newsletterSection);
    setPortalHost(host);

    return () => {
      setPortalHost(null);
      host.remove();
    };
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

    return () => {
      mounted = false;
      window.clearInterval(refresh);
    };
  }, [pathname]);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const interval = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % reviews.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [reviews.length]);

  if (pathname !== '/' || !visible || reviews.length === 0 || !portalHost) return null;

  const review = reviews[current];
  const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));

  return createPortal(
    <div className="container-custom" aria-live="polite">
      <div className="flex justify-end overflow-hidden">
        <div
          key={review.id}
          className="w-full max-w-xl animate-in slide-in-from-right duration-700"
        >
          <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-lg ring-1 ring-black/5 dark:border-emerald-900/40 dark:bg-card">
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="absolute right-2 top-2 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-muted"
              aria-label="Close customer review"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-6">
              <div className="mb-2 flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className={`h-4 w-4 ${index < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  />
                ))}
              </div>

              <p className="line-clamp-3 text-sm leading-6 text-gray-700 dark:text-muted-foreground">
                “{review.review}”
              </p>
              <p className="mt-3 text-sm font-bold text-emerald-800 dark:text-emerald-400">— {review.customer_name}</p>
              <p className="mt-0.5 text-[11px] font-medium text-gray-400">সন্তুষ্ট গ্রাহকের মতামত</p>
            </div>

            {reviews.length > 1 && (
              <div className="mt-3 flex items-center justify-end gap-1.5">
                {reviews.slice(0, Math.min(reviews.length, 5)).map((item, index) => (
                  <span
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all ${index === current % 5 ? 'w-5 bg-emerald-600' : 'w-1.5 bg-emerald-200'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    portalHost,
  );
}
