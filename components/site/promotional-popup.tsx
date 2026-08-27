'use client';

import { useEffect, useState } from 'react';
import { X, Zap } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { PromotionalPopup } from '@/lib/supabase/types';

const STORAGE_KEY = 'sb_popup_dismissed';

function getDismissedMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function setDismissedMap(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
function todayKey() { return new Date().toISOString().slice(0, 10); }

export function PromotionalPopup({ location }: { location: 'main' | 'offers' }) {
  const [popup, setPopup] = useState<PromotionalPopup | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    supabase
      .from('promotional_popups')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const p = data as PromotionalPopup;
        const now = new Date();
        if (p.start_date && new Date(p.start_date) > now) return;
        if (p.end_date && new Date(p.end_date) < now) return;
        if (location === 'main' && !p.show_on_main) return;
        if (location === 'offers' && !p.show_on_offers) return;
        if (!shouldShow(p)) return;
        setPopup(p);
        setTimeout(() => setVisible(true), 800);
      });
  }, [location]);

  const shouldShow = (p: PromotionalPopup) => {
    const map = getDismissedMap();
    const val = map[p.id];
    switch (p.display_frequency) {
      case 'every_visit': return true;
      case 'once_per_session':
        if (sessionStorage.getItem(`${STORAGE_KEY}_${p.id}`)) return false;
        return true;
      case 'once_per_day':
        return val !== todayKey();
      case 'once_until_closed':
        return !val;
      default: return true;
    }
  };

  const markDismissed = (p: PromotionalPopup) => {
    const map = getDismissedMap();
    if (p.display_frequency === 'once_per_session') {
      sessionStorage.setItem(`${STORAGE_KEY}_${p.id}`, '1');
    } else if (p.display_frequency === 'once_per_day') {
      map[p.id] = todayKey();
      setDismissedMap(map);
    } else if (p.display_frequency === 'once_until_closed') {
      map[p.id] = 'closed';
      setDismissedMap(map);
    }
  };

  const close = () => {
    if (!popup) return;
    markDismissed(popup);
    setVisible(false);
  };

  useEffect(() => {
    if (!popup || !visible || !popup.auto_close) return;
    const timer = setTimeout(() => close(), popup.auto_close_seconds * 1000);
    return () => clearTimeout(timer);
  }, [popup, visible]);

  if (!popup || !visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl animate-in zoom-in-95 duration-300">
        {popup.show_close_button && (
          <button onClick={close} className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5 text-foreground shadow hover:bg-background">
            <X className="h-4 w-4" />
          </button>
        )}
        {popup.image && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-secondary/30">
            <img src={popup.image} alt={popup.title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="p-6 text-center">
          {popup.offer && (
            <span className="mb-2 inline-block rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">{popup.offer}</span>
          )}
          {popup.title && <h3 className="mb-2 text-xl font-bold text-foreground">{popup.title}</h3>}
          {popup.description && <p className="mb-4 text-sm text-muted-foreground">{popup.description}</p>}
          {popup.cta_text && (
            <Link href={popup.cta_link || '/all-products'} onClick={close} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              <Zap className="h-4 w-4" /> {popup.cta_text}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
