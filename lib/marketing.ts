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
  add_shipping_info: { meta: 'AddShippingInfo', tiktok: 'AddShippingInfo' },
  add_payment_info: { meta: 'AddPaymentInfo', tiktok: 'AddPaymentInfo' },
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
    const eventId =
      typeof params.event_id === 'string' ? params.event_id : undefined;
    const metaParams = { ...params };
    delete metaParams.event_id;
    w.fbq?.(
      'track',
      mapping.meta,
      metaParams,
      eventId ? { eventID: eventId } : undefined,
    );
  } catch {
    // Analytics providers must never break the storefront.
  }

  try {
    w.ttq?.track?.(mapping.tiktok, params);
  } catch {
    // Analytics providers must never break the storefront.
  }
}

export function getMarketingCartFingerprint(items: Array<{
  product_id: string;
  quantity: number;
  unit_price: number;
  variant_id?: string;
  bundle_id?: string;
}>) {
  return items
    .map((item) => [
      item.product_id,
      item.variant_id || '',
      item.bundle_id || '',
      item.quantity,
      item.unit_price,
    ].join(':'))
    .sort()
    .join('|');
}

export function trackPageView(pathname: string) {
  if (typeof window === 'undefined') return;
  trackMarketingEvent('page_view', {
    page_location: window.location.href,
    page_path: pathname,
    page_title: document.title,
  });
}
