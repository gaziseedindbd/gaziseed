'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCart } from '@/lib/cart';
import { getVisitorCountry, supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import type { CustomerAddress } from '@/lib/supabase/types';
import { AddressSelector, formatAddressToString, type AddressValue } from '@/components/site/address-selector';
import { useLang } from '@/components/site/language-provider';
import {
  Banknote,
  Check,
  ChevronRight,
  Loader2,
  Lock,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  User,
  WalletCards,
  X,
} from 'lucide-react';

type CartItemWithDiscount = {
  product_id: string;
  name: string;
  slug: string;
  image: string;
  unit_price: number;
  regular_price: number;
  quantity: number;
  variant_id?: string;
  variant_name?: string;
  bundle_id?: string;
};

type WalletSummary = {
  balance: number;
  unlocked: boolean;
  max_usable: number;
  min_purchase_amount: number;
  usage_percent: number;
  enabled: boolean;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'production' | 'sandbox' }) => {
      checkout: (options: { paymentSessionId: string }) => Promise<unknown> | unknown;
    };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { t } = useLang();
  const [country, setCountry] = useState<'BD' | 'IN'>('BD');
  const [cart, setCart] = useState<CartItemWithDiscount[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', instructions: '' });
  const [addrValue, setAddrValue] = useState<AddressValue>({ division: '', district: '', thana: '', detail: '', postalCode: '' });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [walletLoading, setWalletLoading] = useState(false);
  const [freeDeliveryProductIds, setFreeDeliveryProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const visitorCountry = getVisitorCountry();
    setCountry(visitorCountry);
    setCart(getCart() as CartItemWithDiscount[]);
    const handler = () => setCart(getCart() as CartItemWithDiscount[]);
    window.addEventListener('cart-updated', handler);

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      setUserId(data.session.user.id);
      const { data: addrs } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('user_id', data.session.user.id)
        .eq('country_code', visitorCountry)
        .order('is_default', { ascending: false });
      setSavedAddresses((addrs || []) as CustomerAddress[]);

      setWalletLoading(true);
      const { data: summary, error: walletError } = await supabase.rpc('get_referral_wallet_summary', { p_user_id: data.session.user.id });
      if (!walletError && summary?.[0]) {
        const nextWallet = {
          balance: Number(summary[0].balance || 0),
          unlocked: Boolean(summary[0].unlocked),
          max_usable: Number(summary[0].max_usable || 0),
          min_purchase_amount: Number(summary[0].min_purchase_amount || 2000),
          usage_percent: Number(summary[0].usage_percent || 15),
          enabled: Boolean(summary[0].enabled),
        };
        setWalletSummary(nextWallet);
      }
      setWalletLoading(false);
    });

    return () => window.removeEventListener('cart-updated', handler);
  }, []);

  useEffect(() => {
    if (country !== 'IN' || cart.length === 0) {
      setFreeDeliveryProductIds(new Set());
      return;
    }

    const productIds = Array.from(new Set(cart.map((item) => item.product_id)));
    supabase
      .from('products')
      .select('id, free_delivery')
      .in('id', productIds)
      .then(({ data }) => {
        const rows = (data || []) as Array<{ id: string; free_delivery: boolean }>;
        setFreeDeliveryProductIds(new Set(rows.filter((product) => product.free_delivery).map((product) => product.id)));
      });
  }, [cart, country]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedFromCashfree = params.get('cashfree_return') === '1';
    const queryOrderId = params.get('order_id');
    const pendingOrderId = localStorage.getItem('cashfree_pending_order_id');
    const pendingPaymentIntentId = localStorage.getItem('cashfree_pending_payment_intent_id');
    const pendingPaymentMethod = localStorage.getItem('cashfree_pending_payment_method') || 'online';
    const cashfreeOrderId = queryOrderId || (returnedFromCashfree ? pendingOrderId : null);
    if (!cashfreeOrderId && !pendingPaymentIntentId) return;

    let active = true;
    let navigatedToSuccess = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const isCodReturn = pendingPaymentMethod === 'cod' && Boolean(pendingPaymentIntentId);
        const { data, error: verifyError } = isCodReturn
          ? await supabase.functions.invoke('cashfree-complete-cod-order', {
              body: { payment_intent_id: pendingPaymentIntentId },
            })
          : await supabase.functions.invoke('cashfree-complete-order', {
              body: { cashfree_order_id: cashfreeOrderId },
            });
        if (!active) return;
        if (verifyError) throw verifyError;
        if (data?.completed && data?.order_number) {
          localStorage.removeItem('gazi_cart');
          localStorage.removeItem('cashfree_pending_order_id');
          localStorage.removeItem('cashfree_pending_payment_intent_id');
          localStorage.removeItem('cashfree_pending_payment_method');
          window.dispatchEvent(new Event('cart-updated'));
          navigatedToSuccess = true;
          const successStatus = isCodReturn ? 'cod' : 'paid';
          router.replace(`/order-success?number=${encodeURIComponent(data.order_number)}&amount=${encodeURIComponent(data.amount ?? data.advance_amount ?? "")}&payment_status=${successStatus}&due_amount=${encodeURIComponent(isCodReturn ? data.due_amount ?? "" : "")}`);
          return;
        }
        if (data?.already_completed && data?.order_id) {
          localStorage.removeItem('cashfree_pending_order_id');
          localStorage.removeItem('cashfree_pending_payment_intent_id');
          localStorage.removeItem('cashfree_pending_payment_method');
          navigatedToSuccess = true;
          router.replace(data.order_number ? `/order-success?number=${encodeURIComponent(data.order_number)}&amount=${encodeURIComponent(data.amount ?? data.advance_amount ?? "")}&payment_status=${isCodReturn ? 'cod' : 'paid'}&due_amount=${encodeURIComponent(isCodReturn ? data.due_amount ?? "" : "")}` : `/order-success?order_id=${data.order_id}`);
          return;
        }
        if (data?.paid === false) {
          setError(t('পেমেন্ট সম্পন্ন হয়নি। আবার চেষ্টা করুন।', 'Payment was not completed. Please try again.'));
        } else {
          setError(data?.error || t('পেমেন্ট যাচাই করা যায়নি।', 'Payment could not be verified.'));
        }
      } catch {
        if (active) setError(t('পেমেন্ট যাচাই করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'Unable to verify the payment. Please try again.'));
      } finally {
        if (active) setLoading(false);
        if (!navigatedToSuccess) {
          window.history.replaceState({}, '', '/checkout');
        }
      }
    })();

    return () => { active = false; };
  }, [router, t]);

  const selectSavedAddress = (id: string) => {
    setSelectedAddrId(id);
    const addr = savedAddresses.find((a) => a.id === id);
    if (addr) {
      setForm((current) => ({ ...current, name: addr.name, phone: addr.phone }));
    }
  };

  const originalTotal = cart.reduce((sum, item) => sum + (item.regular_price || item.unit_price) * item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const savingsTotal = Math.max(0, originalTotal - subtotal);
  const discountPercent = originalTotal > 0 ? Math.round((savingsTotal / originalTotal) * 100) : 0;
  const deliveryCharge = country === 'IN'
    ? freeDeliveryProductIds.size > 0 ? 0 : subtotal >= 999 ? 0 : subtotal >= 499 ? 60 : 90
    : subtotal >= 600 ? 0 : subtotal >= 400 ? 50 : subtotal >= 200 ? 70 : 120;
  const couponDiscount = appliedCoupon
    ? appliedCoupon.type === 'percentage'
      ? Math.min(subtotal * (appliedCoupon.value / 100), appliedCoupon.max_discount || Infinity)
      : Math.min(Number(appliedCoupon.value || 0), subtotal)
    : 0;
  const grandTotal = Math.max(0, subtotal - couponDiscount + deliveryCharge);
  const walletCredit = useWallet && walletSummary?.unlocked
    ? Math.min(walletSummary.max_usable, Math.max(0, grandTotal))
    : 0;
  const payableTotal = Math.max(0, grandTotal - walletCredit);
  const selectedWalletAmount = walletSummary?.unlocked ? Math.min(walletSummary.max_usable, grandTotal) : 0;
  const codAdvance = country === 'IN' ? (deliveryCharge > 0 ? deliveryCharge : 120) : 0;
  const codAvailable = country !== 'IN' || deliveryCharge > 0 || payableTotal >= 120;
  const codDue = country === 'IN' && paymentMethod === 'cod' ? Math.max(0, payableTotal - codAdvance) : 0;

  const deliveryMessage = useMemo(() => {
    if (country === 'IN') {
      return freeDeliveryProductIds.size > 0
        ? t('ফ্রি ডেলিভারি যোগ হয়েছে', 'Free delivery unlocked')
        : subtotal >= 999 ? t('ফ্রি ডেলিভারি যোগ হয়েছে', 'Free delivery unlocked') : t('₹৯৯৯+ অর্ডারে ফ্রি ডেলিভারি', 'Free delivery on ₹999+');
    }
    return subtotal >= 600 ? t('ফ্রি ডেলিভারি যোগ হয়েছে', 'Free delivery unlocked') : t('৳৬০০+ অর্ডারে ফ্রি ডেলিভারি', 'Free delivery on ৳600+');
  }, [country, subtotal, freeDeliveryProductIds, t]);

  const applyCoupon = async () => {
    const normalizedCode = couponCode.trim().toUpperCase();
    if (!normalizedCode) return;
    setCouponLoading(true);
    setCouponError('');
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .eq('country_code', country)
      .maybeSingle();

    if (error || !data) {
      setCouponError(t('কুপন পাওয়া যায়নি', 'Coupon not found'));
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    if (data.min_order && subtotal < data.min_order) {
      setCouponError(t(`ন্যূনতম অর্ডার ${country === 'IN' ? '₹' : '৳'}${data.min_order}`, `Minimum order ${country === 'IN' ? '₹' : '৳'}${data.min_order}`));
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    if (data.usage_limit && data.usage_count >= data.usage_limit) {
      setCouponError(t('কুপন সীমা শেষ', 'Coupon limit reached'));
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    if (data.start_date && new Date(data.start_date) > new Date()) {
      setCouponError(t('কুপন এখনও কার্যকর নয়', 'Coupon not active yet'));
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
      setCouponError(t('কুপন মেয়াদোত্তীর্ণ', 'Coupon expired'));
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    setCouponCode(normalizedCode);
    setAppliedCoupon(data);
    setCouponLoading(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const loadCashfreeSdk = async () => {
    if (window.Cashfree) return;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-cashfree-sdk="v3"]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Cashfree SDK failed to load')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.dataset.cashfreeSdk = 'v3';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Cashfree SDK failed to load'));
      document.head.appendChild(script);
    });
  };

  const startCashfreePayment = async (fullAddress: string, items: Array<{ product_id: string; quantity: number; variant_id: string | null; bundle_id: string | null }>, phone: string, method: 'online' | 'cod') => {
    try {
      const returnUrl = `${window.location.origin}/checkout?cashfree_return=1`;
      const { data, error: sessionError } = await supabase.functions.invoke('cashfree-payment-session', {
        body: {
          customer_name: form.name.trim(),
          customer_phone: phone,
          customer_email: '',
          delivery_address: fullAddress,
          special_instructions: form.instructions.trim(),
          items,
          coupon_code: appliedCoupon?.code || null,
          use_referral_wallet: Boolean(useWallet && walletCredit > 0),
          payment_method: method === 'cod' ? 'cod' : 'cashfree',
          return_url: returnUrl,
        },
      });
      if (sessionError) throw sessionError;
      if (!data?.ok || !data.payment_session_id || !data.order_id) throw new Error(data?.error || 'Unable to start Cashfree payment');
      localStorage.setItem('cashfree_pending_order_id', data.order_id);
      localStorage.setItem('cashfree_pending_payment_intent_id', data.payment_intent_id || '');
      localStorage.setItem('cashfree_pending_payment_method', data.payment_method || method);

      await loadCashfreeSdk();
      if (!window.Cashfree) throw new Error('Cashfree SDK is unavailable');
      const cashfree = window.Cashfree({ mode: 'production' });
      await cashfree.checkout({ paymentSessionId: data.payment_session_id });
    } catch (paymentError) {
      console.error(paymentError);
      setError(t('অনলাইন পেমেন্ট শুরু করা যায়নি। আবার চেষ্টা করুন।', 'Unable to start online payment. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError(t('নাম প্রয়োজন', 'Name is required'));
      return;
    }
    const phone = form.phone.replace(/[^0-9]/g, '');
    const phoneValid = country === 'IN' ? /^[6-9][0-9]{9}$/.test(phone) : /^01[0-9]{9}$/.test(phone);
    if (!phoneValid) {
      setError(country === 'IN' ? t('সঠিক ১০ সংখ্যার ভারতীয় মোবাইল নম্বর দিন', 'Enter a valid 10-digit Indian mobile number') : t('সঠিক মোবাইল নম্বর দিন', 'Enter a valid phone number'));
      return;
    }
    if (!addrValue.division || !addrValue.district || !addrValue.thana || !addrValue.detail || (country === 'IN' && !/^\d{6}$/.test(addrValue.postalCode || ''))) {
      setError(country === 'IN' ? t('সম্পূর্ণ ভারতীয় ঠিকানা ও ৬ সংখ্যার PIN কোড দিন', 'Enter a complete Indian address and 6-digit PIN code') : t('সম্পূর্ণ ঠিকানা দিন', 'Enter full address'));
      return;
    }
    if (cart.length === 0) {
      setError(t('কার্ট খালি', 'Cart is empty'));
      return;
    }

    setLoading(true);
    try {
      const fullAddress = formatAddressToString(addrValue);
      const items = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        variant_id: item.variant_id || null,
        bundle_id: item.bundle_id || null,
      }));

      if (country === 'IN') {
        await startCashfreePayment(fullAddress, items, phone, paymentMethod);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('create_order_with_referral_wallet', {
        p_customer_name: form.name.trim(),
        p_customer_phone: phone,
        p_delivery_address: fullAddress,
        p_items: items,
        p_coupon_code: appliedCoupon?.code || null,
        p_delivery_zone_id: null,
        p_order_source: 'website',
        p_special_instructions: form.instructions.trim(),
        p_user_id: userId,
        p_use_referral_wallet: Boolean(useWallet && walletCredit > 0),
      });

      if (rpcError) throw rpcError;
      if (data?.error) {
        setError(data.error);
        return;
      }
      localStorage.removeItem('gazi_cart');
      window.dispatchEvent(new Event('cart-updated'));
      router.push(`/order-success?number=${data.order_number}`);
    } catch {
      setError(t('অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'Order failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container-custom flex min-h-[70vh] items-center justify-center py-20">
          <div className="w-full max-w-md rounded-[2rem] border border-border/70 bg-card p-8 text-center shadow-xl shadow-black/5 sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <ShoppingBag className="h-10 w-10" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-tight">{t('কার্ট খালি', 'Cart is empty')}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('অর্ডার করতে প্রথমে কার্টে পণ্য যোগ করুন', 'Add items to cart first')}</p>
            <Link
              href="/all-products"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-7 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
            >
              {t('শপিং করুন', 'Shop Now')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/90 pb-28 dark:bg-slate-950 sm:pb-14">
      <div className="container-custom mx-auto max-w-6xl px-4 py-7 sm:py-10 lg:py-14">
        <div className="mb-8 rounded-[2rem] border border-border/70 bg-card/95 p-5 shadow-sm sm:mb-10 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t('নিরাপদ চেকআউট', 'Secure checkout')}
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t('চেকআউট সম্পন্ন করুন', 'Complete your checkout')}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                {t('ঠিকানা নিশ্চিত করুন, প্রয়োজনে কুপন বা ওয়ালেট ব্যবহার করুন, তারপর অর্ডার কনফার্ম করুন।', 'Confirm your delivery details, apply any coupon or wallet credit, then place your order.')}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground sm:justify-end">
              <span className="inline-flex items-center gap-1.5 text-primary"><Check className="h-3.5 w-3.5" /> {t('কার্ট', 'Cart')}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              <span className="inline-flex items-center gap-1.5 text-foreground"><Lock className="h-3.5 w-3.5 text-primary" /> {t('চেকআউট', 'Checkout')}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              <span className="opacity-50">{t('কনফার্মেশন', 'Confirmation')}</span>
            </div>
          </div>
        </div>

        <form id="checkout-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-9">
            <div className="space-y-6 lg:space-y-7">
              {savedAddresses.length > 0 && (
                <section className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm sm:p-7">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">{t('এক ক্লিকে নির্বাচন করুন', 'Quick select')}</p>
                      <h2 className="mt-1 text-lg font-black">{t('সংরক্ষিত ঠিকানা', 'Saved addresses')}</h2>
                    </div>
                    <MapPin className="h-5 w-5 text-primary/70" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {savedAddresses.map((address) => {
                      const selected = selectedAddrId === address.id;
                      return (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => selectSavedAddress(address.id)}
                          aria-pressed={selected}
                          className={`flex min-h-20 items-start justify-between gap-3 rounded-2xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/80 bg-background hover:border-primary/25 hover:bg-primary/[0.03]'}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-foreground">{address.name}</span>
                            <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{address.address}</span>
                            {address.is_default && <span className="mt-1.5 inline-flex text-[10px] font-black text-primary">{t('ডিফল্ট ঠিকানা', 'Default address')}</span>}
                          </span>
                          {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm sm:p-7">
                <div className="mb-6 flex items-start justify-between gap-4 border-b border-border/60 pb-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-black text-primary">১</div>
                    <div>
                      <h2 className="text-lg font-black">{t('ডেলিভারি তথ্য', 'Delivery information')}</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('যে ঠিকানায় আপনার অর্ডার পৌঁছাবে', 'Where your order will be delivered')}</p>
                    </div>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-primary/70" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="checkout-name" className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
                      <User className="h-3.5 w-3.5 text-primary" /> {t('আপনার নাম', 'Your name')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="checkout-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t('যেমন: মো: আরিফুল ইসলাম', 'e.g. Md. Ariful Islam')}
                      className="min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="checkout-phone" className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-primary" /> {t('মোবাইল নম্বর', 'Phone number')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="checkout-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={country === 'IN' ? 10 : 11}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder={country === 'IN' ? '10-digit mobile number' : '01XXXXXXXXX'}
                      className="min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                      required
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <AddressSelector value={addrValue} onChange={setAddrValue} countryCode={country} />
                </div>

                <div className="mt-5 space-y-1.5">
                  <label htmlFor="checkout-instructions" className="text-xs font-extrabold text-muted-foreground">{t('অতিরিক্ত নির্দেশনা', 'Special instructions')}</label>
                  <textarea
                    id="checkout-instructions"
                    name="instructions"
                    autoComplete="off"
                    value={form.instructions}
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                    placeholder={t('ডেলিভারি সংক্রান্ত কোনো বিশেষ নির্দেশনা থাকলে লিখুন...', 'Add any special delivery instructions...')}
                    className="min-h-24 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                </div>
              </section>

              <section className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">SAVE MORE</p>
                    <h2 className="mt-1 text-lg font-black">{t('কুপন কোড', 'Coupon code')}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('আপনার ডিসকাউন্ট কোড থাকলে এখানে ব্যবহার করুন।', 'Have a discount code? Apply it here.')}</p>
                  </div>
                  <Tag className="h-5 w-5 text-primary/70" />
                </div>

                <div className="mt-4 flex gap-3">
                  <label htmlFor="coupon-code" className="sr-only">{t('কুপন কোড', 'Coupon code')}</label>
                  <input
                    id="coupon-code"
                    name="coupon"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                    placeholder={t('কুপন কোড লিখুন', 'Enter coupon code')}
                    className="min-w-0 min-h-12 flex-1 rounded-2xl border border-border bg-background px-4 text-sm font-bold uppercase tracking-wide text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('প্রয়োগ', 'Apply')}
                  </button>
                </div>

                {couponError && <p role="alert" className="mt-3 text-xs font-bold text-rose-600">{couponError}</p>}
                {appliedCoupon && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-500/10 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2 text-xs">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="truncate font-black text-emerald-700 dark:text-emerald-300">{appliedCoupon.code}</span>
                    </div>
                    <button type="button" onClick={removeCoupon} className="inline-flex min-h-9 items-center gap-1 rounded-xl px-2 text-[11px] font-black text-rose-600 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40">
                      <X className="h-3.5 w-3.5" /> {t('সরান', 'Remove')}
                    </button>
                  </div>
                )}
              </section>

              {walletSummary?.enabled && (
                <section className="rounded-[2rem] border border-emerald-200/60 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card p-5 shadow-sm sm:p-7 dark:border-emerald-900/60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <WalletCards className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">WALLET CREDIT</p>
                        <h2 className="mt-1 text-lg font-black">{t('আপনার রেফারেল ওয়ালেট', 'Your referral wallet')}</h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {walletLoading ? t('ব্যালেন্স যাচাই করা হচ্ছে...', 'Checking your wallet balance...') : t(`ব্যালেন্স ${formatPrice(walletSummary.balance)} · সর্বোচ্চ ব্যবহার ${formatPrice(walletSummary.max_usable)}`, `Balance ${formatPrice(walletSummary.balance)} · Up to ${formatPrice(walletSummary.max_usable)} usable`)}
                        </p>
                      </div>
                    </div>
                    {walletSummary.unlocked && <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300">{t('ব্যবহারযোগ্য', 'Available')}</span>}
                  </div>

                  {!walletLoading && walletSummary.unlocked ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={useWallet}
                      onClick={() => setUseWallet((value) => !value)}
                      className={`mt-5 flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${useWallet ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-background hover:border-emerald-300'}`}
                    >
                      <span>
                        <span className="block text-sm font-black text-foreground">{t('ওয়ালেট ক্রেডিট ব্যবহার করুন', 'Use wallet credit')}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{t(`${formatPrice(selectedWalletAmount)} পর্যন্ত অর্ডারে ব্যবহার করা যাবে`, `Use up to ${formatPrice(selectedWalletAmount)} on this order`)}</span>
                      </span>
                      <span className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${useWallet ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`} aria-hidden="true">
                        <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${useWallet ? 'translate-x-5' : 'translate-x-0'}`} />
                      </span>
                    </button>
                  ) : !walletLoading ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/70 px-4 py-3 text-xs font-semibold text-muted-foreground">
                      {t(`৳${walletSummary.min_purchase_amount}+ অর্ডার হলে ওয়ালেট ব্যবহার করা যাবে।`, `Wallet credit unlocks at ${formatPrice(walletSummary.min_purchase_amount)} purchase.`)}
                    </div>
                  ) : null}
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24">
              <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-xl shadow-black/[0.06]">
                <div className="border-b border-border/60 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{country === 'IN' ? 'INDIA' : 'BANGLADESH'}</p>
                      <h2 className="mt-1 text-xl font-black">{t('অর্ডার সামারি', 'Order summary')}</h2>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PackageCheck className="h-5 w-5" /></div>
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                    <Truck className="h-3.5 w-3.5" /> {deliveryMessage}
                  </div>
                </div>

                {country === 'IN' && (
                  <div className="border-b border-border/60 p-5 sm:p-6">
                    <div className="mb-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">{t('পেমেন্ট পদ্ধতি', 'Payment method')}</p>
                      <h3 className="mt-1 text-sm font-black text-foreground">{t('কীভাবে পেমেন্ট করবেন?', 'How would you like to pay?')}</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('online')}
                        aria-pressed={paymentMethod === 'online'}
                        className={`rounded-2xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${paymentMethod === 'online' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:border-primary/30'}`}
                      >
                        <span className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><WalletCards className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block text-sm font-black">{t('অনলাইন পেমেন্ট', 'Online payment')}</span>
                            <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">UPI / Card</span>
                          </span>
                        </span>
                      </button>

                      {codAvailable && (
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cod')}
                          aria-pressed={paymentMethod === 'cod'}
                          className={`rounded-2xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${paymentMethod === 'cod' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:border-primary/30'}`}
                        >
                          <span className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Banknote className="h-4 w-4" /></span>
                            <span className="min-w-0">
                              <span className="block text-sm font-black">{t('ক্যাশ অন ডেলিভারি', 'Cash on Delivery')}</span>
                              <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{t(`অগ্রিম ${formatPrice(codAdvance)} · ডেলিভারিতে ${formatPrice(codDue)}`, `Advance ${formatPrice(codAdvance)} · ${formatPrice(codDue)} due on delivery`)}</span>
                            </span>
                          </span>
                        </button>
                      )}
                    </div>
                    {!codAvailable && (
                      <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-500/10 px-3 py-2 text-[10px] font-bold leading-4 text-amber-700 dark:border-amber-900/60 dark:text-amber-300">
                        {t('এই অর্ডারের জন্য COD উপলভ্য নয়।', 'COD is not available for this order.')}
                      </p>
                    )}
                  </div>
                )}

                <div className="max-h-72 space-y-3 overflow-y-auto border-b border-border/60 p-5 sm:p-6">
                  {cart.map((item) => (
                    <div key={`${item.product_id}-${item.variant_id || ''}-${item.bundle_id || ''}`} className="flex items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary/50">
                        <img src={item.image || '/placeholder.svg'} alt="" className="h-full w-full object-cover" />
                        <span className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-black text-background">{item.quantity}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-black leading-5 text-foreground">{item.name}</p>
                        {item.variant_name && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.variant_name}</p>}
                      </div>
                      <span className="shrink-0 text-xs font-black text-foreground">{formatPrice(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 p-5 sm:p-6">
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{t('সাবটোটাল', 'Subtotal')}</span><span className="font-bold">{formatPrice(subtotal)}</span></div>
                  {savingsTotal > 0 && <div className="flex justify-between gap-4 text-sm text-emerald-600"><span>{t(`আপনার সাশ্রয়${discountPercent ? ` (${discountPercent}%)` : ''}`, `You save${discountPercent ? ` (${discountPercent}%)` : ''}`)}</span><span className="font-bold">-{formatPrice(savingsTotal)}</span></div>}
                  {couponDiscount > 0 && <div className="flex justify-between gap-4 text-sm text-emerald-600"><span>{t('কুপন ডিসকাউন্ট', 'Coupon discount')}</span><span className="font-bold">-{formatPrice(couponDiscount)}</span></div>}
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{t('ডেলিভারি', 'Delivery')}</span><span className="font-bold">{deliveryCharge === 0 ? t('ফ্রি', 'Free') : formatPrice(deliveryCharge)}</span></div>
                  {country === 'IN' && paymentMethod === 'cod' && <><div className="flex justify-between gap-4 text-sm text-primary"><span>{t('COD অগ্রিম','COD advance')}</span><span className="font-bold">{formatPrice(codAdvance)}</span></div><div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{t('ডেলিভারিতে বাকি','Due on delivery')}</span><span className="font-bold">{formatPrice(codDue)}</span></div></>}
                  {walletCredit > 0 && <div className="flex justify-between gap-4 text-sm text-emerald-600"><span>{t('ওয়ালেট ক্রেডিট', 'Wallet credit')}</span><span className="font-bold">-{formatPrice(walletCredit)}</span></div>}
                  <div className="mt-3 flex items-end justify-between gap-4 border-t border-border pt-4">
                    <div>
                      <span className="block text-sm font-black">{t('সর্বমোট', 'Total')}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold text-muted-foreground">{t('চূড়ান্ত পরিশোধযোগ্য', 'Final payable amount')}</span>
                    </div>
                    <span className="text-2xl font-black tracking-tight text-primary">{formatPrice(country === 'IN' && paymentMethod === 'cod' ? codAdvance : payableTotal)}</span>
                  </div>

                  {error && (
                    <div role="alert" className="rounded-2xl border border-rose-200/80 bg-rose-500/10 px-4 py-3 text-xs font-bold leading-5 text-rose-700 dark:border-rose-900/60 dark:text-rose-300">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{country === 'IN' ? (paymentMethod === 'cod' ? t('COD অগ্রিম পরিশোধ করুন', 'Pay COD advance') : t('অনলাইনে পেমেন্ট করুন', 'Pay online')) : t('অর্ডার কনফার্ম করুন', 'Confirm order')} <ChevronRight className="h-4 w-4" /></>}
                  </button>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="rounded-2xl bg-secondary/70 p-3"><Truck className="mx-auto mb-1 h-4 w-4 text-primary" /><span className="text-[10px] font-bold text-muted-foreground">{country === 'IN' ? 'India Delivery' : t('দেশজুড়ে', 'Nationwide')}</span></div>
                    <div className="rounded-2xl bg-secondary/70 p-3"><Banknote className="mx-auto mb-1 h-4 w-4 text-primary" /><span className="text-[10px] font-bold text-muted-foreground">{country === 'IN' ? (paymentMethod === 'cod' ? 'COD' : 'UPI / Card') : 'COD'}</span></div>
                    <div className="rounded-2xl bg-secondary/70 p-3"><Lock className="mx-auto mb-1 h-4 w-4 text-primary" /><span className="text-[10px] font-bold text-muted-foreground">SSL</span></div>
                  </div>
                </div>
              </section>

              <div className="mt-4 hidden items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 lg:flex">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-black text-foreground">{t('নিরাপদ অর্ডার প্রসেস', 'Secure order processing')}</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{t('আপনার তথ্য নিরাপদে প্রক্রিয়া করা হয়।', 'Your details are handled securely throughout checkout.')}</p>
                </div>
              </div>
            </aside>
          </div>
        </form>

        <div className="fixed inset-x-3 bottom-3 z-40 lg:hidden">
          <div className="flex items-center gap-3 rounded-[22px] border border-border/80 bg-background/95 p-3 shadow-2xl shadow-black/20 backdrop-blur-xl" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="min-w-0 flex-1 pl-1">
              <p className="text-[10px] font-bold text-muted-foreground">{t('পরিশোধযোগ্য', 'Payable')}</p>
              <p className="truncate text-lg font-black text-primary">{formatPrice(paymentMethod === 'cod' ? codAdvance : payableTotal)}</p>
            </div>
            <button
              type="submit"
              form="checkout-form"
              disabled={loading}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{country === 'IN' ? (paymentMethod === 'cod' ? t('COD অগ্রিম', 'COD advance') : t('অনলাইন পেমেন্ট', 'Pay online')) : t('অর্ডার করুন', 'Place order')} <ChevronRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
