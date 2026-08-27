'use client';

type MarketingParams = Record<string, unknown>;

type WindowWithMarketing = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: { track?: (event: string, params?: MarketingParams) => void; page?: () => void };
};

const EVENT_MAP = {
  page_view: { meta: 'PageView', tiktok: 'ViewContent' },
  view_item: { meta: 'ViewContent', tiktok: 'ViewContent' },
  add_to_cart: { meta: 'AddToCart', tiktok: 'AddToCart' },
  begin_checkout: { meta: 'InitiateCheckout', tiktok: 'InitiateCheckout' },
  purchase: { meta: 'Purchase', tiktok: 'CompletePayment' },
} as const;

export type MarketingEventName = keyof typeof EVENT_MAP;

export function trackMarketingEvent(event: MarketingEventName, params: MarketingParams = {}) {
  if (typeof window === 'undefined') return;

  const w = window as WindowWithMarketing;
  const mapping = EVENT_MAP[event];

  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });

  try {
    w.gtag?.('event', event, params);
  } catch {
    // Analytics providers must never break the storefront.
  }

  try {
    w.fbq?.('track', mapping.meta, params);
  } catch {
    // Analytics providers must never break the storefront.
  }

  try {
    w.ttq?.track?.(mapping.tiktok, params);
  } catch {
    // Analytics providers must never break the storefront.
  }
}

export function trackPageView(pathname: string) {
  if (typeof window === 'undefined') return;
  trackMarketingEvent('page_view', {
    page_location: window.location.href,
    page_path: pathname,
    page_title: document.title,
  });
}
