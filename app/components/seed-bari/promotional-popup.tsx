'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Popup = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  cta_link: string | null;
  offer_text: string | null;
  cta_text: string | null;
  closeable: boolean;
  display_frequency: string | null;
  delay_seconds: number | null;
};

export function PromotionalPopup({ popup }: { popup: Popup }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const storageKey = `seed-bari-popup-${popup.id}`;
    const frequency = (popup.display_frequency ?? 'always').toLowerCase();
    const seenAt = window.localStorage.getItem(storageKey);

    if (frequency === 'once' && seenAt) return;
    if (frequency === 'daily' && seenAt) {
      const age = Date.now() - Number(seenAt);
      if (age < 24 * 60 * 60 * 1000) return;
    }

    const delay = Math.max(0, Number(popup.delay_seconds ?? 0)) * 1000;
    const timer = window.setTimeout(() => {
      setOpen(true);
      window.localStorage.setItem(storageKey, String(Date.now()));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [popup]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={popup.title ?? 'Promotion'}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        {popup.closeable !== false ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl text-white"
            aria-label="Close promotion"
          >
            ×
          </button>
        ) : null}

        {popup.image_url ? (
          <img src={popup.image_url} alt={popup.title ?? 'SEED BARI promotion'} className="max-h-72 w-full object-cover" />
        ) : null}

        <div className="p-6 md:p-8">
          {popup.offer_text ? <p className="font-bold text-[#1f6b3b]">{popup.offer_text}</p> : null}
          {popup.title ? <h2 className="mt-2 text-2xl font-black">{popup.title}</h2> : null}
          {popup.description ? <p className="mt-3 text-gray-600">{popup.description}</p> : null}

          {popup.cta_link ? (
            <Link
              href={popup.cta_link}
              onClick={() => setOpen(false)}
              className="mt-6 inline-flex rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white"
            >
              {popup.cta_text || 'Explore Offer'}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
