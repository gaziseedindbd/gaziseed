'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Popup = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  cta_link: string | null;
  offer_text: string | null;
  cta_text: string | null;
  closeable: boolean | null;
  display_frequency: string | null;
  delay_seconds: number | null;
};

export default function PromotionalPopup({ popup }: { popup: Popup }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `seed-bari-popup:${popup.id}`;
    const frequency = popup.display_frequency || 'session';
    if (frequency === 'once' && window.localStorage.getItem(key)) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      if (frequency === 'once') window.localStorage.setItem(key, '1');
    }, Math.max(0, popup.delay_seconds ?? 2) * 1000);

    return () => window.clearTimeout(timer);
  }, [popup]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={popup.title || 'SEED BARI promotion'}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        {popup.closeable !== false && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-lg text-white"
            aria-label="Close promotion"
          >
            ×
          </button>
        )}
        {popup.image_url && <img src={popup.image_url} alt="" className="max-h-72 w-full object-cover" />}
        <div className="p-6">
          {popup.offer_text && <p className="text-sm font-bold uppercase tracking-wider text-[#1f6b3b]">{popup.offer_text}</p>}
          {popup.title && <h2 className="mt-1 text-2xl font-black">{popup.title}</h2>}
          {popup.description && <p className="mt-3 text-gray-600">{popup.description}</p>}
          {popup.cta_link && (
            <Link href={popup.cta_link} onClick={() => setOpen(false)} className="mt-5 inline-flex rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white">
              {popup.cta_text || 'Shop now'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
