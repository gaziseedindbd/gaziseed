'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Sparkles, Sprout, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/components/site/language-provider';
import { getVisitorCountry, supabase } from '@/lib/supabase/client';
import { getPopupCopy, getSafePopupHref, selectEligiblePopup, type PopupLanguage } from '@/lib/promotional-popup';
import type { PromotionalPopup as PromotionalPopupRecord } from '@/lib/supabase/types';

const STORAGE_KEY = 'gazi_popup_dismissed_v2';

function readDismissedValue(key: string, storage: Storage): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeDismissedValue(key: string, value: string, storage: Storage) {
  try {
    storage.setItem(key, value);
  } catch {
    // The popup remains usable when browser storage is unavailable.
  }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hasBeenDismissed(popup: PromotionalPopupRecord, country: 'BD' | 'IN') {
  if (popup.display_frequency === 'every_visit') return false;
  const key = `${STORAGE_KEY}:${country}:${popup.id}`;
  if (popup.display_frequency === 'once_per_session') return Boolean(readDismissedValue(key, sessionStorage));
  const value = readDismissedValue(key, localStorage);
  if (popup.display_frequency === 'once_per_day') return value === localDateKey();
  if (popup.display_frequency === 'once_until_closed') return value === 'closed';
  return false;
}

function rememberDismissal(popup: PromotionalPopupRecord, country: 'BD' | 'IN') {
  if (popup.display_frequency === 'every_visit') return;
  const key = `${STORAGE_KEY}:${country}:${popup.id}`;
  if (popup.display_frequency === 'once_per_session') {
    writeDismissedValue(key, '1', sessionStorage);
  } else if (popup.display_frequency === 'once_per_day') {
    writeDismissedValue(key, localDateKey(), localStorage);
  } else if (popup.display_frequency === 'once_until_closed') {
    writeDismissedValue(key, 'closed', localStorage);
  }
}

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

export function PromotionalPopup({ location }: { location: 'main' | 'offers' }) {
  const pathname = usePathname();
  const { lang, t } = useLang();
  const [country, setCountry] = useState<'BD' | 'IN'>(() => getVisitorCountry());
  const [popup, setPopup] = useState<PromotionalPopupRecord | null>(null);
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const copy = useMemo(() => popup ? getPopupCopy(popup, lang as PopupLanguage) : null, [popup, lang]);
  const href = useMemo(() => getSafePopupHref(popup?.cta_link), [popup?.cta_link]);

  useEffect(() => {
    const syncCountry = () => setCountry(getVisitorCountry());
    window.addEventListener('gazi-country-changed', syncCountry);
    return () => window.removeEventListener('gazi-country-changed', syncCountry);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let revealTimer: number | undefined;
    setVisible(false);
    setPopup(null);

    if (pathname === '/checkout' || pathname.startsWith('/admin')) return;

    const loadPopup = async () => {
      const locationColumn = location === 'main' ? 'show_on_main' : 'show_on_offers';
      const { data, error } = await supabase
        .from('promotional_popups')
        .select('*')
        .eq('country_code', country)
        .eq('is_active', true)
        .eq(locationColumn, true)
        .order('created_at', { ascending: false });

      if (error || cancelled || !data) return;

      const now = new Date();
      const selected = selectEligiblePopup(
        data as PromotionalPopupRecord[],
        location,
        now,
        (candidate) => {
          if (hasBeenDismissed(candidate, country)) return false;
          const candidateCopy = getPopupCopy(candidate, lang as PopupLanguage);
          return Boolean(candidateCopy.title || candidateCopy.description || candidateCopy.offer || candidateCopy.cta_text || candidate.image);
        },
      );

      if (!selected || cancelled) return;
      setPopup(selected);
      const delaySeconds = Math.min(30, Math.max(0, Number(selected.display_delay) || 0));
      revealTimer = window.setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, delaySeconds * 1000);
    };

    void loadPopup();
    return () => {
      cancelled = true;
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
    };
  }, [country, lang, location, pathname]);

  const close = useCallback(() => {
    if (popup) rememberDismissal(popup, country);
    setVisible(false);
  }, [country, popup]);

  useEffect(() => {
    if (!popup || !visible || !popup.auto_close) return;
    const seconds = Math.min(60, Math.max(3, Number(popup.auto_close_seconds) || 8));
    const timer = window.setTimeout(close, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [close, popup, visible]);

  useEffect(() => {
    if (!visible) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [close, visible]);

  if (!popup || !visible || !copy) return null;

  const titleId = `promotional-popup-title-${popup.id}`;
  const descriptionId = `promotional-popup-description-${popup.id}`;
  const hasDescription = Boolean(copy.description);
  const ctaText = copy.cta_text || t('অফারটি দেখুন', 'Explore the offer', 'ऑफ़र देखें');
  const ctaClassName = 'group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 sm:w-auto motion-reduce:transform-none motion-reduce:transition-none';
  const cta = isExternalHref(href)
    ? <a href={href} onClick={close} className={ctaClassName}>{ctaText}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></a>
    : <Link href={href} onClick={close} className={ctaClassName}>{ctaText}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={copy.title ? titleId : undefined}
        aria-label={copy.title ? undefined : copy.offer || t('বিশেষ অফার', 'Special offer', 'विशेष ऑफ़र')}
        aria-describedby={hasDescription ? descriptionId : undefined}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-y-auto rounded-[1.75rem] border border-white/70 bg-card text-card-foreground shadow-[0_30px_100px_-35px_rgba(0,0,0,.75)] outline-none animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={close}
          aria-label={t('পপআপ বন্ধ করুন', 'Close promotion', 'ऑफ़र बंद करें')}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-800 shadow-lg transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 motion-reduce:transform-none"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className={`relative isolate w-full overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-lime-700 ${popup.image ? 'aspect-[16/9]' : 'flex min-h-48 items-center justify-center'}`}>
          {popup.image ? (
            <Image src={popup.image} alt={copy.title || 'GAZI SEED promotion'} fill sizes="(max-width: 640px) 100vw, 576px" unoptimized className="object-cover" priority />
          ) : (
            <div className="flex h-full min-h-48 w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(217,249,157,.34),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,.16),transparent_30%)] text-lime-100">
              <Sprout className="h-16 w-16" strokeWidth={1.4} aria-hidden="true" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/65 via-transparent to-emerald-950/10" />
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-emerald-950/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-white shadow backdrop-blur-md sm:bottom-5 sm:left-5">
            <Sparkles className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" />
            {t('GAZI SEED বিশেষ অফার', 'GAZI SEED special offer', 'GAZI SEED विशेष ऑफ़र')}
          </div>
        </div>

        <div className="px-5 pb-6 pt-5 text-center sm:px-8 sm:pb-8 sm:pt-7">
          {copy.offer && (
            <span className="mb-3 inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-3.5 py-1.5 text-xs font-extrabold tracking-wide text-amber-900">
              {copy.offer}
            </span>
          )}
          {copy.title && <h2 id={titleId} className="mx-auto max-w-lg text-balance text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">{copy.title}</h2>}
          {hasDescription && <p id={descriptionId} className="mx-auto mt-3 max-w-lg text-pretty text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{copy.description}</p>}
          {copy.cta_text && <div className="mt-6 flex justify-center">{cta}</div>}
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[.18em] text-muted-foreground/70">GAZI SEED · {country === 'IN' ? 'India' : 'Bangladesh'}</p>
        </div>
      </div>
    </div>
  );
}
