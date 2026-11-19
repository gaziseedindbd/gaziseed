'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, ShoppingBag, ArrowRight } from 'lucide-react';

type Props = {
  title: string;
  image?: string;
  description?: string;
  price?: string;
  regularPrice?: string;
  discountPercent?: number;
  country?: 'IN' | 'BD';
  orderTarget: string;
  onOrder?: () => void | Promise<void>;
  labels: { badge: string; order: string; close: string; imageAlt: string };
};

export function LandingProductQuickView({ title, image, description, price, regularPrice, discountPercent = 0, orderTarget, onOrder, labels }: Props) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-2 backdrop-blur-md sm:p-5"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative my-auto grid w-full max-w-4xl grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[24px] bg-white shadow-2xl sm:rounded-[30px] md:grid-cols-2 md:grid-rows-1"
        style={{ maxHeight: 'min(92dvh, 760px)' }}
      >
        <button type="button" onClick={() => setOpen(false)} aria-label={labels.close} className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white/95 text-slate-800 shadow-lg backdrop-blur"><X className="h-5 w-5" /></button>

        <div className="relative min-h-0 min-w-0 overflow-hidden bg-slate-50 md:min-h-[420px]">
          <div className="relative h-[30dvh] min-h-[190px] max-h-[300px] w-full sm:h-[36dvh] md:h-full md:min-h-[420px] md:max-h-none">
            {image ? <Image src={image} alt={labels.imageAlt || title} fill priority sizes="(max-width: 767px) 100vw, 50vw" className="object-contain p-4 sm:p-6" /> : <div className="flex h-full items-center justify-center text-7xl">🌱</div>}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain p-5 sm:p-7 md:justify-center md:p-8">
          <span className="mb-3 inline-flex w-fit shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{labels.badge}</span>
          <h2 className="min-w-0 break-words text-xl font-black leading-tight text-slate-900 sm:text-2xl lg:text-3xl">{title}</h2>
          {price ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="shrink-0 text-xl font-black text-emerald-800 sm:text-2xl">{price}</span>
              {regularPrice && regularPrice !== price && <span className="shrink-0 text-sm font-semibold text-slate-400 line-through sm:text-base">{regularPrice}</span>}
              {discountPercent > 0 && <span className="shrink-0 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">{discountPercent}% OFF</span>}
            </div>
          ) : null}
          {description ? <p className="mt-3 break-words text-sm leading-6 text-slate-600 sm:mt-4 sm:leading-7">{description}</p> : null}
          <div className="mt-5 grid shrink-0 gap-2 sm:mt-7">
            <button type="button" onClick={() => { if (onOrder) { void onOrder(); setOpen(false); return; } setOpen(false); window.setTimeout(() => document.getElementById(orderTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800">
              <ShoppingBag className="h-5 w-5" />{labels.order}<ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">{labels.close}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
