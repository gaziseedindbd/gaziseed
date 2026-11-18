'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, ShoppingBag, ArrowRight } from 'lucide-react';

type Props = {
  title: string;
  image?: string;
  description?: string;
  price?: string;
  country?: 'IN' | 'BD';
  orderTarget: string;
  labels: { badge: string; order: string; close: string; imageAlt: string };
};

export function LandingProductQuickView({ title, image, description, price, orderTarget, labels }: Props) {
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="relative grid w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl md:grid-cols-2">
        <button type="button" onClick={() => setOpen(false)} aria-label={labels.close} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-lg"><X className="h-5 w-5" /></button>
        <div className="relative aspect-square bg-slate-50 md:min-h-[420px]">
          {image ? <Image src={image} alt={labels.imageAlt || title} fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-contain p-5" /> : <div className="flex h-full items-center justify-center text-7xl">🌱</div>}
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <span className="mb-3 inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{labels.badge}</span>
          <h2 className="text-2xl font-black leading-tight text-slate-900 sm:text-3xl">{title}</h2>
          {price ? <p className="mt-4 text-2xl font-black text-emerald-800">{price}</p> : null}
          {description ? <p className="mt-4 line-clamp-5 text-sm leading-7 text-slate-600">{description}</p> : null}
          <button type="button" onClick={() => { setOpen(false); window.setTimeout(() => document.getElementById(orderTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800">
            <ShoppingBag className="h-5 w-5" />{labels.order}<ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setOpen(false)} className="mt-3 min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{labels.close}</button>
        </div>
      </section>
    </div>
  );
}
