'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getProductBySlug } from '@/lib/data';
import { getCart } from '@/lib/cart';
import { trackMarketingEvent, trackPageView } from '@/lib/marketing';

type MarketingSettings = {
  meta_pixel_id?: string | null;
  ga4_measurement_id?: string | null;
  gtm_id?: string | null;
  tiktok_pixel_id?: string | null;
};

type WindowWithPixels = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: any;
  TiktokAnalyticsObject?: string;
};

function loadScript(src: string, id: string) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function initMetaPixel(pixelId: string) {
  const w = window as WindowWithPixels;
  if (!w.fbq) {
    const fbq: any = function (...args: unknown[]) {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    w.fbq = fbq;
  }
  if (!(w.fbq as any).__seedBariInitialized) {
    (w.fbq as any)('init', pixelId);
    (w.fbq as any).__seedBariInitialized = pixelId;
    loadScript('https://connect.facebook.net/en_US/fbevents.js', 'seed-bari-meta-pixel');
  }
}

function initGoogleAnalytics(measurementId: string) {
  const w = window as WindowWithPixels;
  w.dataLayer = w.dataLayer || [];
  if (!w.gtag) w.gtag = (...args: unknown[]) => w.dataLayer!.push(args);
  if ((w.gtag as any).__seedBariInitialized !== measurementId) {
    w.gtag('js', new Date());
    w.gtag('config', measurementId, { send_page_view: false });
    (w.gtag as any).__seedBariInitialized = measurementId;
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`, 'seed-bari-ga4');
  }
}

function initGtm(containerId: string) {
  const w = window as WindowWithPixels;
  w.dataLayer = w.dataLayer || [];
  if ((w as any).__seedBariGtmInitialized === containerId) return;
  w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  (w as any).__seedBariGtmInitialized = containerId;
  loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`, 'seed-bari-gtm');
}

function initTikTokPixel(pixelId: string) {
  const w = window as WindowWithPixels;
  if (w.ttq && w.ttq.__seedBariInitialized === pixelId) return;

  const t = 'ttq';
  const ttq: any = w.ttq || [];
  const methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
  ttq.methods = ttq.methods || methods;
  ttq.setAndDefer = ttq.setAndDefer || function (obj: any, method: string) {
    obj[method] = function (...args: unknown[]) { obj.push([method, ...args]); };
  };
  methods.forEach((method) => ttq.setAndDefer(ttq, method));
  ttq.instance = ttq.instance || function (id: string) {
    const instance = ttq._i?.[id] || [];
    methods.forEach((method) => ttq.setAndDefer(instance, method));
    return instance;
  };
  ttq.load = ttq.load || function (id: string, options?: Record<string, unknown>) {
    ttq._i = ttq._i || {};
    ttq._i[id] = [];
    ttq._t = ttq._t || {};
    ttq._t[id] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[id] = options || {};
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=${t}`;
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  };
  w.TiktokAnalyticsObject = t;
  w.ttq = ttq;
  ttq.load(pixelId);
  ttq.__seedBariInitialized = pixelId;
  ttq.page?.();
}

function initialiseProviders(settings: MarketingSettings) {
  if (typeof window === 'undefined') return;
  if (settings.meta_pixel_id?.trim()) initMetaPixel(settings.meta_pixel_id.trim());
  if (settings.ga4_measurement_id?.trim()) initGoogleAnalytics(settings.ga4_measurement_id.trim());
  if (settings.gtm_id?.trim()) initGtm(settings.gtm_id.trim());
  if (settings.tiktok_pixel_id?.trim()) initTikTokPixel(settings.tiktok_pixel_id.trim());
}

async function trackRouteCommerceEvents(pathname: string, search: string) {
  try {
    if (pathname.startsWith('/product/')) {
      const slug = decodeURIComponent(pathname.replace(/^\/product\//, '').split('/')[0]);
      if (!slug) return;
      const product = await getProductBySlug(slug);
      if (!product) return;
      const price = product.sale_price && product.sale_price > 0 && product.sale_price < product.regular_price
        ? product.sale_price
        : product.regular_price;
      trackMarketingEvent('view_item', {
        currency: 'BDT',
        value: price,
        items: [{ item_id: product.sku || product.id, item_name: product.name_bn || product.name_en, price, quantity: 1 }],
        content_ids: [product.id],
        content_type: 'product',
        content_name: product.name_bn || product.name_en,
        content_id: product.id,
      });
      return;
    }

    if (pathname === '/checkout') {
      const key = 'seed-bari-checkout-event';
      if (sessionStorage.getItem(key) === '1') return;
      const cart = getCart();
      if (!cart.length) return;
      const value = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      trackMarketingEvent('begin_checkout', {
        currency: 'BDT',
        value,
        items: cart.map((item) => ({
          item_id: item.product_id,
          item_name: item.name,
          price: item.unit_price,
          quantity: item.quantity,
          item_variant: item.variant_name,
        })),
        content_ids: cart.map((item) => item.product_id),
        content_type: 'product',
      });
      sessionStorage.setItem(key, '1');
      return;
    }

    if (pathname === '/order-success') {
      const orderNumber = new URLSearchParams(search).get('number');
      if (!orderNumber) return;
      const key = `seed-bari-purchase-${orderNumber}`;
      if (sessionStorage.getItem(key) === '1') return;

      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, final_amount, grand_total, delivery_charge, coupon_code')
        .eq('order_number', orderNumber)
        .maybeSingle();

      if (order) {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('product_id, product_name, quantity, unit_price, variant_id')
          .eq('order_id', order.id);
        const value = Number(order.final_amount ?? order.grand_total ?? 0);
        trackMarketingEvent('purchase', {
          transaction_id: order.order_number,
          currency: 'BDT',
          value,
          shipping: Number(order.delivery_charge || 0),
          coupon: order.coupon_code || undefined,
          items: (orderItems || []).map((item) => ({
            item_id: item.product_id,
            item_name: item.product_name,
            price: Number(item.unit_price),
            quantity: item.quantity,
            item_variant: item.variant_id || undefined,
          })),
          content_ids: (orderItems || []).map((item) => item.product_id),
          content_type: 'product',
        });
      } else {
        // Guest orders are still recorded as a conversion when RLS prevents reading the order row.
        trackMarketingEvent('purchase', { transaction_id: orderNumber, currency: 'BDT', content_type: 'product' });
      }
      sessionStorage.setItem(key, '1');
    }
  } catch {
    // Tracking failures must never interrupt checkout or navigation.
  }
}

export function MarketingTracker() {
  const pathname = usePathname();
  const readyRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('marketing_settings')
      .select('meta_pixel_id, ga4_measurement_id, gtm_id, tiktok_pixel_id')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        initialiseProviders((data || {}) as MarketingSettings);
        readyRef.current = true;
        if (pathname) {
          lastPathRef.current = pathname;
          trackPageView(pathname);
          void trackRouteCommerceEvents(pathname, window.location.search);
        }
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!readyRef.current || !pathname || lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    trackPageView(pathname);
    void trackRouteCommerceEvents(pathname, window.location.search);
  }, [pathname]);

  return null;
}
