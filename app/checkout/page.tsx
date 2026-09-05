'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCart } from '@/lib/cart';
import { getVisitorCountry, supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import type { CustomerAddress } from '@/lib/supabase/types';
import { AddressSelector, formatAddressToString, type AddressValue } from '@/components/site/address-selector';
import { useLang } from '@/components/site/language-provider';
import { Check, Loader2, Lock, MapPin, Tag, X, Sparkles, ShieldCheck, Truck, User, Phone, ShoppingBag, Banknote, ChevronRight, CreditCard, WalletCards } from 'lucide-react';
import Link from 'next/link';

type CartItemWithDiscount = { product_id: string; name: string; slug: string; image: string; unit_price: number; regular_price: number; quantity: number; variant_id?: string; variant_name?: string; bundle_id?: string };
type WalletSummary = { balance: number; unlocked: boolean; max_usable: number; min_purchase_amount: number; usage_percent: number; enabled: boolean };

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
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    const visitorCountry = getVisitorCountry();
    setCountry(visitorCountry);
    setCart(getCart() as CartItemWithDiscount[]);
    const handler = () => setCart(getCart() as CartItemWithDiscount[]);
    window.addEventListener('cart-updated', handler);
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id);
        const { data: addrs } = await supabase.from('customer_addresses').select('*').eq('user_id', data.session.user.id).eq('country_code', visitorCountry).order('is_default', { ascending: false });
        setSavedAddresses((addrs || []) as CustomerAddress[]);
        setWalletLoading(true);
        const { data: summary, error: walletError } = await supabase.rpc('get_referral_wallet_summary', { p_user_id: data.session.user.id });
        if (!walletError && summary?.[0]) setWalletSummary({
          balance: Number(summary[0].balance || 0),
          unlocked: Boolean(summary[0].unlocked),
          max_usable: Number(summary[0].max_usable || 0),
          min_purchase_amount: Number(summary[0].min_purchase_amount || 2000),
          usage_percent: Number(summary[0].usage_percent || 15),
          enabled: Boolean(summary[0].enabled),
        });
        setWalletLoading(false);
      }
    });
    return () => window.removeEventListener('cart-updated', handler);
  }, []);

  const selectSavedAddress = (id: string) => {
    setSelectedAddrId(id);
    const addr = savedAddresses.find((a) => a.id === id);
    if (addr) setForm({ ...form, name: addr.name, phone: addr.phone });
  };

  const originalTotal = cart.reduce((sum, item) => sum + (item.regular_price || item.unit_price) * item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const savingsTotal = originalTotal - subtotal;
  const discountPercent = originalTotal > 0 ? Math.round((savingsTotal / originalTotal) * 100) : 0;
  const deliveryCharge = subtotal >= 600 ? 0 : subtotal >= 400 ? 50 : subtotal >= 200 ? 70 : 120;
  const couponDiscount = appliedCoupon ? (appliedCoupon.type === 'percentage' ? Math.min(subtotal * (appliedCoupon.value / 100), appliedCoupon.max_discount || Infinity) : appliedCoupon.value) : 0;
  const grandTotal = subtotal - couponDiscount + deliveryCharge;
  const walletCredit = useWallet && walletSummary?.unlocked ? Math.min(walletSummary.max_usable, Math.max(0, grandTotal)) : 0;
  const payableTotal = Math.max(0, grandTotal - walletCredit);

  const applyCoupon = async () => {
    if (!couponCode) return;
    setCouponLoading(true); setCouponError('');
    const { data, error } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase()).eq('is_active', true).eq('country_code', country).maybeSingle();
    if (error || !data) { setCouponError(t('কুপন পাওয়া যায়নি', 'Coupon not found')); setAppliedCoupon(null); setCouponLoading(false); return; }
    if (data.min_order && subtotal < data.min_order) { setCouponError(t(`ন্যূনতম অর্ডার ${country === 'IN' ? '₹' : '৳'}${data.min_order}`, `Minimum order ${country === 'IN' ? '₹' : '৳'}${data.min_order}`)); setAppliedCoupon(null); setCouponLoading(false); return; }
    if (data.usage_limit && data.usage_count >= data.usage_limit) { setCouponError(t('কুপন সীমা শেষ', 'Coupon limit reached')); setAppliedCoupon(null); setCouponLoading(false); return; }
    if (data.start_date && new Date(data.start_date) > new Date()) { setCouponError(t('কুপন এখনও কার্যকর নয়', 'Coupon not active yet')); setAppliedCoupon(null); setCouponLoading(false); return; }
    if (data.expiry_date && new Date(data.expiry_date) < new Date()) { setCouponError(t('কুপন মেয়াদোত্তীর্ণ', 'Coupon expired')); setAppliedCoupon(null); setCouponLoading(false); return; }
    setAppliedCoupon(data); setCouponLoading(false);
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponCode(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError(t('নাম প্রয়োজন', 'Name is required')); return; }
    const phone = form.phone.replace(/[^0-9]/g, '');
    const phoneValid = country === 'IN' ? /^[6-9][0-9]{9}$/.test(phone) : /^01[0-9]{9}$/.test(phone);
    if (!phoneValid) { setError(country === 'IN' ? t('সঠিক ১০ সংখ্যার ভারতীয় মোবাইল নম্বর দিন', 'Enter a valid 10-digit Indian mobile number') : t('সঠিক মোবাইল নম্বর দিন', 'Enter a valid phone number')); return; }
    if (!addrValue.division || !addrValue.district || !addrValue.thana || !addrValue.detail || (country === 'IN' && !/^\d{6}$/.test(addrValue.postalCode || ''))) { setError(country === 'IN' ? t('সম্পূর্ণ ভারতীয় ঠিকানা ও ৬ সংখ্যার PIN কোড দিন', 'Enter a complete Indian address and 6-digit PIN code') : t('সম্পূর্ণ ঠিকানা দিন', 'Enter full address')); return; }
    if (cart.length === 0) { setError(t('কার্ট খালি', 'Cart is empty')); return; }
    setLoading(true);
    try {
      const fullAddress = formatAddressToString(addrValue);
      const items = cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity, variant_id: item.variant_id || null, bundle_id: item.bundle_id || null }));
      const { data, error: rpcError } = await supabase.rpc('create_order_with_referral_wallet', {
        p_customer_name: form.name.trim(), p_customer_phone: phone, p_delivery_address: fullAddress, p_items: items,
        p_coupon_code: appliedCoupon?.code || null, p_delivery_zone_id: null, p_order_source: 'website',
        p_special_instructions: form.instructions.trim(), p_user_id: userId,
        p_use_referral_wallet: Boolean(useWallet && walletCredit > 0),
      });
      if (rpcError) throw rpcError;
      if (data?.error) { setError(data.error); return; }
      localStorage.removeItem('gazi_cart');
      window.dispatchEvent(new Event('cart-updated'));
      router.push(`/order-success?number=${data.order_number}`);
    } catch (err) {
      setError(t('অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'Order failed. Please try again.'));
    } finally { setLoading(false); }
  };

  if (cart.length === 0) return (
    <div className="container-custom py-24 text-center space-y-4"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary text-muted-foreground"><ShoppingBag className="h-10 w-10" /></div><h1 className="text-2xl font-black">{t('কার্ট খালি', 'Cart is empty')}</h1><p className="text-sm text-muted-foreground">{t('অর্ডার করতে প্রথমে কার্টে পণ্য যোগ করুন', 'Add items to cart first')}</p><Link href="/all-products" className="inline-block rounded-2xl bg-primary px-8 py-3.5 text-xs font-black text-primary-foreground shadow-xl shadow-primary/25 hover:scale-105 transition-all">{t('শপিং করুন', 'Shop Now')}</Link></div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-foreground py-8 sm:py-14"><div className="container-custom max-w-6xl mx-auto px-4">
      <div className="mb-10 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6"><div><div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black tracking-wider uppercase mb-2"><Sparkles className="h-3.5 w-3.5" /> {t('১০০% সুরক্ষিত চেকআউট', '100% Secure Checkout')}</div><h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t('চেকআউট', 'Checkout')}</h1></div><div className="flex items-center justify-center sm:justify-end gap-3 text-xs font-bold text-muted-foreground"><span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">{t('কার্ট', 'Cart')}</span><ChevronRight className="h-3.5 w-3.5 opacity-40" /><span className="flex items-center gap-1 text-primary font-black"><Lock className="h-3.5 w-3.5" /> {t('চেকআউট', 'Checkout')}</span><ChevronRight className="h-3.5 w-3.5 opacity-40" /><span className="opacity-60">{t('কনফার্মেশন', 'Confirmation')}</span></div></div>
      <form onSubmit={handleSubmit}><div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 sm:gap-10 items-start"><div className="space-y-8">
        {savedAddresses.length > 0 && <div className="rounded-[32px] border border-border/80 bg-card p-6 shadow-sm backdrop-blur-xl space-y-4"><h3 className="flex items-center gap-2 text-sm font-black text-foreground"><MapPin className="h-4 w-4 text-primary" /> {t('সংরক্ষিত ঠিকানা', 'Saved Addresses')}</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{savedAddresses.map((a) => <button key={a.id} type="button" onClick={() => selectSavedAddress(a.id)} className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left text-xs transition-all cursor-pointer ${selectedAddrId === a.id ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' : 'border-border/80 bg-background/50 hover:border-border'}`}><div><p className="font-black text-foreground">{a.name} {a.is_default && <span className="text-[10px] text-primary font-bold ml-1">({t('ডিফল্ট', 'Default')})</span>}</p><p className="text-muted-foreground mt-0.5 line-clamp-1">{a.address}</p></div>{selectedAddrId === a.id && <Check className="h-4 w-4 text-primary shrink-0" />}</button>)}</div></div>}
        <div className="rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6"><div className="flex items-center justify-between border-b border-border/60 pb-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black">১</div><div><h2 className="text-lg font-black text-foreground">{t('ডেলিভারি তথ্য', 'Delivery Information')}</h2><p className="text-xs text-muted-foreground">{t('যে ঠিকানায় পণ্যটি পাঠানো হবে', 'Address where the product will be delivered')}</p></div></div><MapPin className="h-5 w-5 text-primary/70" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-extrabold text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-primary" /> {t('আপনার নাম', 'Your Name')} <span className="text-rose-500">*</span></label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('যেমন: মো: আরিফুল ইসলাম', 'e.g., Md. Ariful Islam')} className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all" required /></div><div className="space-y-1.5"><label className="text-xs font-extrabold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-primary" /> {t('মোবাইল নম্বর', 'Phone')} <span className="text-rose-500">*</span></label><input type="tel" inputMode="tel" maxLength={country === 'IN' ? 10 : 11} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={country === 'IN' ? '10-digit mobile number' : t('01XXXXXXXXX', '01XXXXXXXXX')} className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all" required /></div></div><AddressSelector value={addrValue} onChange={setAddrValue} countryCode={country} /><div className="space-y-1.5"><label className="text-xs font-extrabold text-muted-foreground">{t('অতিরিক্ত নির্দেশনা', 'Special Instructions')}</label><textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder={t('ডেলিভারি সংক্রান্ত কোনো বিশেষ নির্দেশনা...', 'Any special delivery instructions...')} className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all min-h-[90px]" /></div></div>
        <div className="rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">{t('কুপন', 'Coupon')}</h2><p className="text-xs text-muted-foreground">{t('ডিসকাউন্ট কোড থাকলে এখানে দিন', 'Enter your discount code')}</p></div><Tag className="h-5 w-5 text-primary" /></div><div className="flex gap-3"><input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder={t('কুপন কোড', 'Coupon code')} className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold uppercase" /><button type="button" onClick={applyCoupon} disabled={couponLoading} className="rounded-2xl bg-primary px-5 py-3 text-xs font-black text-primary-foreground disabled:opacity-50">{couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('প্রয়োগ', 'Apply')}</button></div>{couponError && <p className="text-xs font-bold text-rose-600">{couponError}</p>}{appliedCoupon && <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 p-3 text-xs"><span className="font-black text-emerald-700 dark:text-emerald-300">{appliedCoupon.code}</span><button type="button" onClick={removeCoupon} className="text-rose-500 font-bold">{t('সরান', 'Remove')}</button></div>}</div>
      </div><aside className="lg:sticky lg:top-24 rounded-[32px] border border-border/80 bg-card p-6 sm:p-7 shadow-xl shadow-black/5 space-y-5"><div className="flex items-center justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{country === 'IN' ? 'India Branch' : 'Bangladesh Branch'}</p><h2 className="text-xl font-black">{t('অর্ডার সামারি', 'Order Summary')}</h2></div><ShieldCheck className="h-6 w-6 text-primary" /></div><div className="space-y-3 border-b border-border pb-4">{cart.map((item) => <div key={`${item.product_id}-${item.variant_id || ''}`} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{item.name} × {item.quantity}</span><span className="font-black whitespace-nowrap">{formatPrice(item.unit_price * item.quantity)}</span></div>)}</div><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">{t('সাবটোটাল', 'Subtotal')}</span><span className="font-bold">{formatPrice(subtotal)}</span></div>{savingsTotal > 0 && <div className="flex justify-between text-emerald-600"><span>{t('আপনার সাশ্রয়', 'You save')}</span><span className="font-bold">-{formatPrice(savingsTotal)}</span></div>}{couponDiscount > 0 && <div className="flex justify-between text-emerald-600"><span>{t('কুপন ডিসকাউন্ট', 'Coupon discount')}</span><span className="font-bold">-{formatPrice(couponDiscount)}</span></div>}<div className="flex justify-between"><span className="text-muted-foreground">{t('ডেলিভারি', 'Delivery')}</span><span className="font-bold">{deliveryCharge === 0 ? t('ফ্রি', 'Free') : formatPrice(deliveryCharge)}</span></div>{walletCredit > 0 && <div className="flex justify-between text-emerald-600"><span>{t('ওয়ালেট ক্রেডিট', 'Wallet credit')}</span><span className="font-bold">-{formatPrice(walletCredit)}</span></div>}<div className="flex justify-between border-t border-border pt-3 text-lg"><span className="font-black">{t('মোট', 'Total')}</span><span className="font-black text-primary">{formatPrice(payableTotal)}</span></div></div>{error && <div className="rounded-2xl bg-rose-500/10 p-3 text-xs font-bold text-rose-600">{error}</div>}<button type="submit" disabled={loading} className="w-full rounded-2xl bg-primary px-5 py-4 text-sm font-black text-primary-foreground shadow-lg shadow-primary/25 hover:scale-[1.01] transition-transform disabled:opacity-60">{loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : <span className="inline-flex items-center justify-center gap-2">{t('অর্ডার কনফার্ম করুন', 'Confirm Order')} <ChevronRight className="h-4 w-4" /></span>}</button><div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-muted-foreground"><div className="rounded-2xl bg-muted/60 p-3"><Truck className="mx-auto mb-1 h-4 w-4" />{country === 'IN' ? 'India Delivery' : 'দেশজুড়ে ডেলিভারি'}</div><div className="rounded-2xl bg-muted/60 p-3"><Banknote className="mx-auto mb-1 h-4 w-4" />COD</div><div className="rounded-2xl bg-muted/60 p-3"><Lock className="mx-auto mb-1 h-4 w-4" />SSL</div></div></aside></div></form></div></div>
  );
}
