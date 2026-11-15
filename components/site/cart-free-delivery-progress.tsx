'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Truck } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';
import { formatPrice } from '@/lib/data';
import { supabase, getVisitorCountry } from '@/lib/supabase/client';
import type { CartItem } from '@/lib/cart';

type DeliveryRule = {
  min_order: number;
  max_order: number | null;
  charge: number;
  is_free: boolean;
};

type Props = {
  items: CartItem[];
  subtotal: number;
};

export default function CartFreeDeliveryProgress({ items, subtotal }: Props) {
  const { t } = useLang();
  const [country, setCountry] = useState<'BD' | 'IN'>('BD');
  const [deliveryRules, setDeliveryRules] = useState<DeliveryRule[]>([]);
  const [freeDeliveryProductIds, setFreeDeliveryProductIds] = useState<Set<string>>(new Set());
  const [deliveryCharge, setDeliveryCharge] = useState<number | null>(null);
  const [deliveryQuoteReady, setDeliveryQuoteReady] = useState(false);

  const productIdsKey = useMemo(
    () => Array.from(new Set(items.map((item) => item.product_id).filter(Boolean))).sort().join(','),
    [items],
  );

  useEffect(() => {
    const syncCountry = () => setCountry(getVisitorCountry());
    syncCountry();
    window.addEventListener('gazi-country-changed', syncCountry);
    window.addEventListener('storage', syncCountry);
    return () => {
      window.removeEventListener('gazi-country-changed', syncCountry);
      window.removeEventListener('storage', syncCountry);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncDeliveryQuote = async () => {
      const productIds = productIdsKey ? productIdsKey.split(',') : [];
      if (productIds.length === 0) {
        setDeliveryRules([]);
        setFreeDeliveryProductIds(new Set());
        setDeliveryCharge(null);
        setDeliveryQuoteReady(false);
        return;
      }

      setDeliveryQuoteReady(false);

      try {
        const [rulesResult, freeDeliveryResult] = await Promise.all([
          supabase
            .from('delivery_charge_rules')
            .select('min_order, max_order, charge, is_free')
            .eq('country_code', country)
            .eq('is_active', true)
            .order('min_order', { ascending: false }),
          supabase
            .from('products')
            .select('id, free_delivery')
            .in('id', productIds)
            .eq('country_code', country),
        ]);

        if (cancelled) return;
        if (rulesResult.error) throw rulesResult.error;
        if (freeDeliveryResult.error) throw freeDeliveryResult.error;

        const rules = (rulesResult.data || []).map((rule) => ({
          min_order: Number(rule.min_order || 0),
          max_order: rule.max_order == null ? null : Number(rule.max_order),
          charge: Number(rule.charge || 0),
          is_free: Boolean(rule.is_free),
        }));
        const freeRows = (freeDeliveryResult.data || []) as Array<{ id: string; free_delivery: boolean }>;
        const freeIds = new Set(freeRows.filter((product) => product.free_delivery).map((product) => product.id));

        setDeliveryRules(rules);
        setFreeDeliveryProductIds(freeIds);

        const { data: chargeData, error: chargeError } = await supabase.rpc('calculate_delivery_charge', {
          p_order_value: subtotal,
          p_free_delivery: freeIds.size > 0,
        });

        if (cancelled) return;
        const verifiedCharge = Number(chargeData);
        if (chargeError || chargeData === null || !Number.isFinite(verifiedCharge) || verifiedCharge < 0) {
          throw chargeError || new Error('Invalid delivery charge quote');
        }

        setDeliveryCharge(verifiedCharge);
        setDeliveryQuoteReady(true);
      } catch (error) {
        if (!cancelled) {
          console.error('Cart free delivery quote failed:', error);
          setDeliveryQuoteReady(false);
          setDeliveryCharge(null);
        }
      }
    };

    void syncDeliveryQuote();
    return () => {
      cancelled = true;
    };
  }, [country, productIdsKey, subtotal]);

  const freeDeliveryThreshold = useMemo(() => {
    const candidates = deliveryRules
      .filter((rule) => rule.is_free && rule.min_order > 0)
      .sort((a, b) => a.min_order - b.min_order);

    return candidates.find((rule) => rule.min_order > subtotal)?.min_order
      ?? candidates[candidates.length - 1]?.min_order
      ?? null;
  }, [deliveryRules, subtotal]);

  const freeDeliveryUnlocked = deliveryQuoteReady
    && (deliveryCharge === 0 || freeDeliveryProductIds.size > 0);
  const freeDeliveryRemaining = freeDeliveryThreshold == null
    ? null
    : Math.max(0, freeDeliveryThreshold - subtotal);
  const freeDeliveryPercent = freeDeliveryUnlocked
    ? 100
    : freeDeliveryThreshold
      ? Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100))
      : 0;

  if (freeDeliveryThreshold === null && !freeDeliveryUnlocked) return null;

  const progressTarget = country === 'IN'
    ? Math.max(0, (freeDeliveryThreshold ?? subtotal) - 0.01)
    : (freeDeliveryThreshold ?? subtotal);

  return (
    <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/[0.04] p-3.5" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
        <span className="flex items-center gap-1.5">
          <Truck className="h-4 w-4 shrink-0 text-primary" />
          {!deliveryQuoteReady
            ? t('ডেলিভারি যাচাই হচ্ছে', 'Checking delivery', 'डिलीवरी की जाँच हो रही है')
            : freeDeliveryUnlocked
              ? t('ফ্রি ডেলিভারি আনলক হয়েছে!', 'Free delivery unlocked!', 'मुफ्त डिलीवरी मिल गई!')
              : freeDeliveryRemaining !== null
                ? t(
                    `আর ${formatPrice(freeDeliveryRemaining, country)} যোগ করুন ফ্রি ডেলিভারির জন্য`,
                    `Add ${formatPrice(freeDeliveryRemaining, country)} more for free delivery`,
                    `मुफ्त डिलीवरी के लिए ${formatPrice(freeDeliveryRemaining, country)} और जोड़ें`,
                  )
                : t('ডেলিভারি চার্জ প্রযোজ্য', 'Delivery charge applies', 'डिलीवरी शुल्क लागू है')}
        </span>
        {freeDeliveryThreshold !== null && (
          <span className="tabular-nums text-primary">
            {formatPrice(subtotal, country)} / {formatPrice(progressTarget, country)}
          </span>
        )}
        {freeDeliveryUnlocked && <Check className="h-4 w-4 text-primary" />}
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-primary/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={freeDeliveryPercent}
        aria-label="Free delivery progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${freeDeliveryPercent}%` }}
        />
      </div>
    </div>
  );
}
