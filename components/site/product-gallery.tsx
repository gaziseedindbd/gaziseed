'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    setActiveIdx(((idx % images.length) + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setActiveIdx((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setActiveIdx((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const pauseAndResume = useCallback(() => {
    setIsPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setIsPaused(false), RESUME_DELAY);
  }, []);

  // Auto-slide every 4 seconds, pause on interaction
  useEffect(() => {
    if (!hasMultiple || isPaused) return;
    const interval = setInterval(next, AUTO_SLIDE_INTERVAL);
    return () => clearInterval(interval);
  }, [hasMultiple, isPaused, next]);

  // Cleanup resume timer
  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  // Reset to first image when images change
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
      <div>
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary/30">
          <div className="flex h-full w-full items-center justify-center text-6xl">🌱</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main image */}
      <div
        className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary/30"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => {
          if (resumeTimer.current) clearTimeout(resumeTimer.current);
          resumeTimer.current = setTimeout(() => setIsPaused(false), RESUME_DELAY);
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images[activeIdx] && (
          <img
            key={activeIdx}
            src={images[activeIdx]}
            alt={alt}
            className="h-full w-full object-contain animate-[fadeIn_0.4s_ease-out]"
            draggable={false}
          />
        )}

        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-destructive px-3 py-1 text-sm font-bold text-destructive-foreground">
            -{discount}%
          </span>
        )}

        {/* Arrow controls — only for multiple images */}
        {hasMultiple && (
          <>
            <button
              onClick={() => { prev(); pauseAndResume(); }}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-700 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => { next(); pauseAndResume(); }}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-700 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => { goTo(idx); pauseAndResume(); }}
                className={`h-2 rounded-full transition-all ${
                  idx === activeIdx ? 'w-6 bg-primary' : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails — only for multiple images */}
      {hasMultiple && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => { goTo(idx); pauseAndResume(); }}
              className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                idx === activeIdx
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
