'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Images, ZoomIn } from 'lucide-react';

interface ProductGalleryProps {
  images: string[];
  alt: string;
  discount?: number;
}

const AUTO_SLIDE_INTERVAL = 4000;
const RESUME_DELAY = 3000;

export function ProductGallery({ images, alt, discount = 0 }: ProductGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const hasMultiple = images.length > 1;

  const goTo = useCallback((idx: number) => {
    if (!images.length) return;
    setActiveIdx(((idx % images.length) + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    if (!images.length) return;
    setActiveIdx((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    if (!images.length) return;
    setActiveIdx((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const pauseAndResume = useCallback(() => {
    setIsPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setIsPaused(false), RESUME_DELAY);
  }, []);

  useEffect(() => {
    if (!hasMultiple || isPaused) return;
    const interval = setInterval(next, AUTO_SLIDE_INTERVAL);
    return () => clearInterval(interval);
  }, [hasMultiple, isPaused, next]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  useEffect(() => {
    setActiveIdx(0);
  }, [images]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) next();
      else prev();
      pauseAndResume();
    }
    touchStartX.current = null;
  };

  if (images.length === 0) {
    return (
      <div className="product-gallery-premium">
        <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-primary/10 bg-gradient-to-br from-primary/5 via-white to-accent/10 shadow-inner">
          <div className="flex h-full w-full items-center justify-center text-6xl">🌱</div>
        </div>
        <PremiumProductDetailStyles />
      </div>
    );
  }

  return (
    <div className="product-gallery-premium">
      <div
        className="group relative aspect-square overflow-hidden rounded-[1.5rem] border border-primary/10 bg-gradient-to-br from-primary/[0.035] via-white to-accent/[0.07] shadow-[0_18px_45px_-30px_rgba(15,23,42,.45)] sm:rounded-[1.75rem]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => {
          if (resumeTimer.current) clearTimeout(resumeTimer.current);
          resumeTimer.current = setTimeout(() => setIsPaused(false), RESUME_DELAY);
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,.12),transparent_30%),radial-gradient(circle_at_90%_85%,rgba(245,158,11,.10),transparent_32%)]" />
        {images[activeIdx] && (
          <img
            key={activeIdx}
            src={images[activeIdx]}
            alt={alt}
            className="relative h-full w-full object-contain p-3 sm:p-5 animate-[fadeIn_0.4s_ease-out] transition-transform duration-700 ease-out group-hover:scale-[1.015]"
            draggable={false}
          />
        )}

        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-black text-white shadow-lg sm:left-4 sm:top-4 sm:px-3.5 sm:py-2 sm:text-sm">
            -{discount}%
          </span>
        )}

        {hasMultiple && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/85 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 shadow-md backdrop-blur-md sm:right-4 sm:top-4">
            <Images className="h-3.5 w-3.5 text-primary" /> {images.length}
          </span>
        )}

        {hasMultiple && (
          <>
            <button
              onClick={() => { prev(); pauseAndResume(); }}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-700 shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => { next(); pauseAndResume(); }}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-700 shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full border border-white/70 bg-white/75 px-2 py-1.5 shadow-md backdrop-blur-md">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => { goTo(idx); pauseAndResume(); }}
              className={`h-1.5 rounded-full transition-all ${idx === activeIdx ? 'w-6 bg-primary' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`}
              aria-label={`Go to image ${idx + 1}`}
            />
          ))}
        </div>

        <span className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-1.5 rounded-xl border border-white/70 bg-white/75 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow-md backdrop-blur-md sm:flex">
          <ZoomIn className="h-3.5 w-3.5 text-primary" /> {alt}
        </span>
      </div>

      {hasMultiple && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar px-0.5 pb-1 sm:mt-4 sm:gap-2.5">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => { goTo(idx); pauseAndResume(); }}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-all sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-2xl ${idx === activeIdx ? 'border-primary ring-4 ring-primary/10 -translate-y-0.5' : 'border-slate-200 hover:border-primary/40 hover:-translate-y-0.5'}`}
              aria-label={`Select image ${idx + 1}`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
              {idx === activeIdx && <span className="absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      )}
      <PremiumProductDetailStyles />
    </div>
  );
}

function PremiumProductDetailStyles() {
  return (
    <style jsx global>{`
      .min-h-screen:has(.product-gallery-premium) {
        background: radial-gradient(circle at 5% 0%, hsl(152 68% 28% / .075), transparent 28%), radial-gradient(circle at 95% 6%, hsl(43 86% 55% / .09), transparent 24%), #fafbfc !important;
      }
      .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child {
        gap: 1.5rem !important;
      }
      .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child > :first-child {
        padding: .75rem !important;
        border: 1px solid hsl(152 68% 28% / .12) !important;
        border-radius: 2rem !important;
        background: rgba(255,255,255,.82) !important;
        box-shadow: 0 24px 70px -42px hsl(152 40% 20% / .42) !important;
      }
      .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child > :nth-child(2) {
        padding: 1.35rem !important;
        border: 1px solid hsl(152 68% 28% / .10) !important;
        border-radius: 2rem !important;
        background: rgba(255,255,255,.86) !important;
        box-shadow: 0 24px 70px -46px hsl(152 40% 20% / .34) !important;
        backdrop-filter: blur(16px);
      }
      .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child > :nth-child(2) h1 {
        font-size: clamp(1.65rem, 3vw, 2.7rem) !important;
        letter-spacing: -.04em !important;
      }
      .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child > :nth-child(2) > div:nth-child(2) {
        border-radius: 1.25rem !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.8) !important;
      }
      @media (max-width: 640px) {
        .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child { gap: .85rem !important; }
        .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child > :first-child,
        .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child > :nth-child(2) { border-radius: 1.5rem !important; }
        .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child > :first-child { padding: .45rem !important; }
        .min-h-screen:has(.product-gallery-premium) > .max-w-6xl > .grid:first-child > :nth-child(2) { padding: .9rem !important; }
      }
    `}</style>
  );
}
