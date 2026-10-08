'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { useLang } from './language-provider';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { getVisitorCountry } from '@/lib/supabase/client';

interface ProductGalleryProps {
  images: string[];
  alt: string;
  discount?: number;
}

export function ProductGallery({ images, alt, discount = 0 }: ProductGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [country, setCountry] = useState<'BD' | 'IN'>('BD');
  const { t } = useLang();
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

  useEffect(() => {
    setActiveIdx(0);
  }, [images]);

  useEffect(() => {
    const syncCountry = () => setCountry(getVisitorCountry());
    syncCountry();
    window.addEventListener('gazi-country-changed', syncCountry);
    window.addEventListener('storage', syncCountry);
    return () => {
      window.removeEventListener('gazi-country-changed', syncCountry);
      window.removeEventListener('storage', syncCountry);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  if (images.length === 0) {
    return (
      <div className={`product-gallery-premium ${country === 'IN' ? 'product-gallery-india' : ''}`}>
        <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-primary/10 bg-gradient-to-br from-primary/5 via-white to-accent/10 shadow-inner">
          <div className="flex h-full w-full items-center justify-center text-6xl">🌱</div>
        </div>
        <PremiumProductDetailStyles />
      </div>
    );
  }

  return (
    <div className={`product-gallery-premium ${country === 'IN' ? 'product-gallery-india' : ''}`}>
      <div
        className="group relative aspect-square overflow-hidden rounded-[1.5rem] border border-primary/10 bg-gradient-to-br from-primary/[0.035] via-white to-accent/[0.07] shadow-[0_18px_45px_-30px_rgba(15,23,42,.45)] sm:rounded-[1.75rem]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,.12),transparent_30%),radial-gradient(circle_at_90%_85%,rgba(245,158,11,.10),transparent_32%)]" />
        {images[activeIdx] && (
          <Image
            key={activeIdx}
            src={images[activeIdx]}
            alt={alt}
            fill
            priority={activeIdx === 0}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px"
            quality={92}
            className="relative object-contain p-0 animate-[fadeIn_0.4s_ease-out] transition-transform duration-700 ease-out group-hover:scale-[1.015]"
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
              onClick={prev}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-700 shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              aria-label={t('আগের ছবি', 'Previous image', 'पिछली तस्वीर')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-700 shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              aria-label={t('পরের ছবি', 'Next image', 'अगली तस्वीर')}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

      </div>

      {hasMultiple && (
        <div className="mt-2 flex flex-wrap items-center justify-center" aria-label={t('ছবি নির্বাচন', 'Choose image', 'तस्वीर चुनें')}>
          {images.map((_, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => goTo(idx)}
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t(`${idx + 1} নম্বর ছবি দেখুন`, `Go to image ${idx + 1}`, `तस्वीर ${idx + 1} देखें`)}
              aria-pressed={idx === activeIdx}
            >
              <span aria-hidden="true" className={`h-1.5 rounded-full transition-all ${idx === activeIdx ? 'w-6 bg-primary' : 'w-1.5 bg-slate-300'}`} />
            </button>
          ))}
        </div>
      )}

      {hasMultiple && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar px-0.5 pb-1 sm:mt-4 sm:gap-2.5">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-all sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-2xl ${idx === activeIdx ? 'border-primary ring-4 ring-primary/10 -translate-y-0.5' : 'border-slate-200 hover:border-primary/40 hover:-translate-y-0.5'}`}
              aria-label={t(`${idx + 1} নম্বর ছবি নির্বাচন`, `Select image ${idx + 1}`, `तस्वीर ${idx + 1} चुनें`)}
              aria-pressed={idx === activeIdx}
            >
              <Image src={img} alt="" fill sizes="72px" quality={70} className="object-cover" draggable={false} />
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

        /* India mobile audit I3: keep the gallery useful without pushing product details below the fold. */
        .product-gallery-premium.product-gallery-india > .group:first-child {
          aspect-ratio: 4 / 3 !important;
          max-height: 285px !important;
        }
        .product-gallery-premium.product-gallery-india > .group:first-child > button {
          width: 2.5rem !important;
          height: 2.5rem !important;
        }
        .product-gallery-premium.product-gallery-india > div[aria-label] {
          margin-top: .25rem !important;
        }
        .product-gallery-premium.product-gallery-india > div[aria-label] > button {
          width: 2rem !important;
          height: 2rem !important;
        }
        .product-gallery-premium.product-gallery-india > .mt-3 {
          margin-top: .4rem !important;
          gap: .4rem !important;
        }
        .product-gallery-premium.product-gallery-india > .mt-3 > button {
          width: 3.5rem !important;
          height: 3.5rem !important;
          border-radius: .7rem !important;
        }
      }
    `}</style>
  );
}
