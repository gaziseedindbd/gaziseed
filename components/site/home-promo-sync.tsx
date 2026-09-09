'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

type Promo = {
  slot: 'growing_guide' | 'farmer_stories';
  title: string;
  subtitle: string;
  image_url: string;
  href: string;
  button_text: string;
  is_active: boolean;
};

const SLOT_ORDER: Promo['slot'][] = ['growing_guide', 'farmer_stories'];

function applyPromos(promos: Promo[]) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.home-promo-grid .home-promo-card'));
  if (!cards.length) return false;

  const bySlot = new Map(promos.map((promo) => [promo.slot, promo]));
  cards.slice(0, 2).forEach((card, index) => {
    const promo = bySlot.get(SLOT_ORDER[index]);
    const visible = Boolean(promo?.is_active && promo.image_url);
    card.dataset.homePromoSlot = SLOT_ORDER[index];
    card.style.display = visible ? '' : 'none';
    card.classList.remove('home-promo-awaiting');

    if (!promo || !visible) return;

    const link = card.querySelector<HTMLAnchorElement>('a') || (card as unknown as HTMLAnchorElement);
    if (link && promo.href) link.href = promo.href;

    const image = card.querySelector<HTMLImageElement>('img');
    if (image) {
      image.src = promo.image_url;
      image.alt = promo.title || 'GAZI SEED';
      image.loading = 'lazy';
    }

    const title = card.querySelector<HTMLElement>('.home-promo-content h3');
    if (title) title.textContent = promo.title;

    const subtitle = card.querySelector<HTMLElement>('.home-promo-content p');
    if (subtitle) subtitle.textContent = promo.subtitle;

    const button = card.querySelector<HTMLElement>('.home-promo-content span');
    if (button) button.textContent = promo.button_text;
  });

  return true;
}

export default function HomePromoSync() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    const load = async () => {
      const { data } = await supabase
        .from('homepage_promos')
        .select('slot,title,subtitle,image_url,href,button_text,is_active')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (cancelled) return;

      const apply = () => applyPromos((data || []) as Promo[]);
      if (apply()) return;

      observer = new MutationObserver(() => {
        if (apply()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      window.setTimeout(() => observer?.disconnect(), 5000);
    };

    load();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return <style jsx global>{`
    .home-promo-grid .home-promo-card.home-promo-awaiting { visibility: hidden; }
  `}</style>;
}
