import type { PromotionalPopup } from '@/lib/supabase/types';

export type PopupLanguage = 'bn' | 'en' | 'hi';
export type PopupLocation = 'main' | 'offers';

export type PopupCopy = {
  title: string;
  description: string;
  offer: string;
  cta_text: string;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getPopupCopy(popup: PromotionalPopup, language: PopupLanguage): PopupCopy {
  const translations = popup.localized_content || {};
  const fallbackOrder: PopupLanguage[] = language === 'hi'
    ? ['hi', 'en', 'bn']
    : language === 'en'
      ? ['en', 'bn', 'hi']
      : ['bn', 'en', 'hi'];
  const field = (name: keyof PopupCopy, legacy: string) => {
    for (const locale of fallbackOrder) {
      const value = text(translations[locale]?.[name]);
      if (value) return value;
    }
    return text(legacy);
  };

  return {
    title: field('title', popup.title),
    description: field('description', popup.description),
    offer: field('offer', popup.offer),
    cta_text: field('cta_text', popup.cta_text),
  };
}

export function getSafePopupHref(value: string | null | undefined): string {
  const href = text(value);
  if (!href) return '/all-products';
  if (isAllowedPopupHref(href)) return href;

  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
  } catch {
    // Invalid or unsupported links fall back to the product listing.
  }
  return '/all-products';
}

export function isAllowedPopupHref(value: string | null | undefined): boolean {
  const href = text(value);
  if (!href) return true;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try {
    const parsed = new URL(href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isPopupScheduled(popup: PromotionalPopup, now = new Date()): boolean {
  const start = popup.start_date ? new Date(popup.start_date).getTime() : Number.NEGATIVE_INFINITY;
  const end = popup.end_date ? new Date(popup.end_date).getTime() : Number.POSITIVE_INFINITY;
  const current = now.getTime();
  return Number.isFinite(current) && !Number.isNaN(start) && !Number.isNaN(end) && start <= current && current < end;
}

export function selectEligiblePopup(
  popups: PromotionalPopup[],
  location: PopupLocation,
  now: Date,
  canDisplay: (popup: PromotionalPopup) => boolean,
): PromotionalPopup | null {
  return popups.find((popup) => {
    const enabledForLocation = location === 'main' ? popup.show_on_main : popup.show_on_offers;
    return popup.is_active && enabledForLocation && isPopupScheduled(popup, now) && canDisplay(popup);
  }) || null;
}
