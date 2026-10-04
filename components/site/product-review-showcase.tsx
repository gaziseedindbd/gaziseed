'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Quote, Star } from 'lucide-react';
import type { Review } from '@/lib/supabase/types';

type ReviewTrackProps = {
  reviews: Review[];
  visibleCount: 1 | 3;
  label: (bn: string, en: string) => string;
};

function ReviewTrack({ reviews, visibleCount, label }: ReviewTrackProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const clones = Math.min(visibleCount, reviews.length);
  const trackReviews = useMemo(
    () => reviews.concat(reviews.slice(0, clones)),
    [reviews, clones],
  );

  useEffect(() => {
    setCurrent(0);
  }, [reviews.length]);

  useEffect(() => {
    if (reviews.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setCurrent((prev) => prev + 1);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [reviews.length, paused]);

  if (reviews.length === 0) return null;

  const handleTransitionEnd = () => {
    if (current >= reviews.length) {
      setCurrent(0);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    setPaused(true);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    setPaused(false);
    if (startX === null) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const distance = endX - startX;
    if (Math.abs(distance) < 40) return;

    setCurrent((prev) => {
      if (distance < 0) return prev + 1;
      return prev <= 0 ? reviews.length - 1 : prev - 1;
    });
  };

  const cardWidth = 100 / trackReviews.length;
  const translate = current * cardWidth;

  return (
    <div
      className="overflow-hidden rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex transition-transform duration-700 ease-out will-change-transform"
        style={{
          width: `${trackReviews.length * (100 / visibleCount)}%`,
          transform: `translateX(-${translate}%)`,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {trackReviews.map((review, index) => {
          const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
          return (
            <article
              key={`${review.id}-${index}`}
              className="shrink-0 px-1.5 sm:px-2"
              style={{ flex: `0 0 ${cardWidth}%` }}
            >
              <div className="h-full rounded-3xl border border-emerald-100/90 bg-white p-5 shadow-[0_18px_45px_-30px_rgba(6,78,59,.45)] ring-1 ring-emerald-900/5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Quote className="h-4 w-4 fill-current" />
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={starIndex}
                        className={`h-4 w-4 ${starIndex < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                </div>

                <p className="mt-4 line-clamp-4 min-h-[7rem] text-sm font-medium leading-6 text-gray-700">
                  “{review.review}”
                </p>

                <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
                  {review.photo ? (
                    <img
                      src={review.photo}
                      alt={review.customer_name || 'Customer'}
                      className="h-11 w-11 rounded-full border border-gray-200 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">
                      {review.customer_name?.charAt(0).toUpperCase() || 'G'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-gray-900">
                      {review.customer_name}
                    </p>
                    {review.verified_purchase && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <Check className="h-3 w-3" />
                        {label('ভেরিফায়েড ক্রেতা', 'Verified Buyer')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductReviewShowcase({
  reviews,
  label,
}: {
  reviews: Review[];
  label: (bn: string, en: string) => string;
}) {
  if (reviews.length === 0) return null;

  return (
    <section className="mt-10 sm:mt-12" aria-label={label('গ্রাহকের মতামত', 'Customer reviews')}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-800">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            <h2 className="text-lg font-black sm:text-xl">{label('গ্রাহকের মতামত', 'Customer Reviews')}</h2>
          </div>
          <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">
            {label('আমাদের ক্রেতাদের অভিজ্ঞতা', 'What our customers say')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
          {reviews.length} {label('টি রিভিউ', 'reviews')}
        </span>
      </div>

      <div className="hidden sm:block">
        <ReviewTrack reviews={reviews} visibleCount={3} label={label} />
      </div>
      <div className="sm:hidden">
        <ReviewTrack reviews={reviews} visibleCount={1} label={label} />
      </div>
    </section>
  );
}
