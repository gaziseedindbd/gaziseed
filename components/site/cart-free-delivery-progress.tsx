'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Truck } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';
import { formatPrice } from '@/lib/data';
import { supabase, getVisitorCountry } from '@/lib/supabase/client';
import { updateCartQuantity, type CartItem } from '@/lib/cart';

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
  const [country, setCountry] = useState<'BD' | 'IN'>(() => getVisitorCountry());
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
    : country === 'IN'
      ? Math.ceil(Math.max(0, freeDeliveryThreshold - subtotal))
      : Math.round(Math.max(0, freeDeliveryThreshold - subtotal));
  const freeDeliveryPercent = freeDeliveryUnlocked
    ? 100
    : freeDeliveryThreshold
      ? Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100))
      : 0;

  const progressTarget = freeDeliveryThreshold ?? subtotal;

  const addOn = useMemo(() => {
    if (!deliveryQuoteReady || freeDeliveryUnlocked || freeDeliveryThreshold == null || subtotal >= progressTarget) return null;
    let best: { item: CartItem; extra: number; nextSubtotal: number; overage: number } | null = null;
    for (const item of items) {
      if (item.bundle_id) continue;
      const basePrice = Number(item.base_unit_price ?? item.unit_price);
      for (let extra = 1; extra <= Math.max(0, 99 - item.quantity); extra += 1) {
        const quantity = item.quantity + extra;
        const tier = (item.bulk_tiers || []).filter((candidate) => candidate.is_active !== false && candidate.min_quantity <= quantity && candidate.unit_price > 0).sort((a, b) => b.min_quantity - a.min_quantity)[0];
        const unitPrice = Number(tier?.unit_price ?? basePrice);
        const nextSubtotal = subtotal - item.unit_price * item.quantity + unitPrice * quantity;
        if (nextSubtotal < progressTarget) continue;
        const overage = nextSubtotal - progressTarget;
        if (!best || overage < best.overage || (overage === best.overage && extra < best.extra)) best = { item, extra, nextSubtotal, overage };
        break;
      }
    }
    return best;
  }, [deliveryQuoteReady, freeDeliveryUnlocked, freeDeliveryThreshold, items, progressTarget, subtotal]);

  if (freeDeliveryThreshold === null && !freeDeliveryUnlocked) return null;

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
      {addOn && (
        <div className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <p className="text-xs font-black text-emerald-900">{t('ফ্রি ডেলিভারি পেতে আরও পণ্য যোগ করুন', 'Add more to unlock FREE delivery')}</p>
          <p className="text-sm font-bold text-emerald-800">{t(`${addOn.extra}টি ${addOn.item.name} যোগ করুন`, `Add ${addOn.extra} more ${addOn.item.name}`)}</p>
          <div className="flex items-center justify-between gap-2 text-xs text-emerald-800"><span>{t('নতুন পণ্যের মোট', 'New product subtotal')}</span><strong>{formatPrice(addOn.nextSubtotal, country)}</strong></div>
          <button type="button" onClick={() => updateCartQuantity(addOn.item.product_id, addOn.item.quantity + addOn.extra, addOn.item.variant_id, addOn.item.bundle_id)} className="min-h-10 w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">+ {t('যোগ করুন', 'Add')}</button>
        </div>
      )}
      {deliveryQuoteReady && deliveryCharge !== null && (
        <div className="flex items-center justify-between gap-3 border-t border-primary/15 pt-2 text-sm">
          <span className="font-semibold text-muted-foreground">{t('ডেলিভারি চার্জ', 'Delivery')}</span>
          <span className="font-bold text-foreground">{deliveryCharge === 0 ? t('ফ্রি', 'FREE') : formatPrice(deliveryCharge, country)}</span>
        </div>
      )}
      {deliveryQuoteReady && deliveryCharge !== null && (
        <>
          {freeDeliveryUnlocked && (() => {
            const waivedCharge = deliveryRules
              .filter((rule) => !rule.is_free && rule.charge > 0 && subtotal >= rule.min_order && (rule.max_order == null || subtotal <= rule.max_order))
              .sort((a, b) => b.min_order - a.min_order)[0]?.charge
              ?? deliveryRules.filter((rule) => !rule.is_free && rule.charge > 0).sort((a, b) => a.min_order - b.min_order)[0]?.charge;
            return waivedCharge ? (
              <p className="rounded-xl bg-emerald-100/70 px-3 py-2 text-xs font-black text-emerald-800">
                ✅ {t('ফ্রি ডেলিভারি আনলক হয়েছে! আপনি সাশ্রয় করেছেন', 'FREE delivery unlocked! You saved')} {formatPrice(waivedCharge, country)}
              </p>
            ) : null;
          })()}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-100/70 px-3 py-2">
            <span className="font-black text-emerald-950">{t('সর্বমোট', 'Total including delivery')}</span>
            <span className="text-lg font-black tabular-nums text-emerald-900">{formatPrice(subtotal + deliveryCharge, country)}</span>
          </div>
        </>
      )}
    </div>
  );
}
