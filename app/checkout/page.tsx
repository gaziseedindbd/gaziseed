'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase/client';
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
    setCart(getCart() as CartItemWithDiscount[]);
    const handler = () => setCart(getCart() as CartItemWithDiscount[]);
    window.addEventListener('cart-updated', handler);
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id);
        const { data: addrs } = await supabase.from('customer_addresses').select('*').eq('user_id', data.session.user.id).order('is_default', { ascending: false });
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
    const { data, error } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase()).eq('is_active', true).maybeSingle();
    if (error || !data) { setCouponError(t('কুপন পাওয়া যায়নি', 'Coupon not found')); setAppliedCoupon(null); setCouponLoading(false); return; }
    if (data.min_order && subtotal < data.min_order) { setCouponError(t(`ন্যূনতম অর্ডার ৳${data.min_order}`, `Minimum order ৳${data.min_order}`)); setAppliedCoupon(null); setCouponLoading(false); return; }
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
    if (!/^01[0-9]{9}$/.test(phone)) { setError(t('সঠিক মোবাইল নম্বর দিন', 'Enter a valid phone number')); return; }
    if (!addrValue.division || !addrValue.district || !addrValue.thana || !addrValue.detail) { setError(t('সম্পূর্ণ ঠিকানা দিন', 'Enter full address')); return; }
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
        <div className="rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6"><div className="flex items-center justify-between border-b border-border/60 pb-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black">১</div><div><h2 className="text-lg font-black text-foreground">{t('ডেলিভারি তথ্য', 'Delivery Information')}</h2><p className="text-xs text-muted-foreground">{t('যে ঠিকানায় পণ্যটি পাঠানো হবে', 'Address where the product will be delivered')}</p></div></div><MapPin className="h-5 w-5 text-primary/70" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-extrabold text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-primary" /> {t('আপনার নাম', 'Your Name')} <span className="text-rose-500">*</span></label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('যেমন: মো: আরিফুল ইসলাম', 'e.g., Md. Ariful Islam')} className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all" required /></div><div className="space-y-1.5"><label className="text-xs font-extrabold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-primary" /> {t('মোবাইল নম্বর', 'Phone')} <span className="text-rose-500">*</span></label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t('01XXXXXXXXX', '01XXXXXXXXX')} className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all" required /></div></div><AddressSelector value={addrValue} onChange={setAddrValue} /><div className="space-y-1.5"><label className="text-xs font-extrabold text-muted-foreground">{t('বিশেষ নির্দেশনা', 'Special Instructions')}</label><textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={3} className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15" placeholder={t('ডেলিভারি সংক্রান্ত কোনো বিশেষ নির্দেশনা থাকলে লিখুন', 'Any special delivery instructions')} /></div></div>
      </div>
      <div className="space-y-5 lg:sticky lg:top-24"><div className="rounded-[32px] border border-border/80 bg-card p-6 sm:p-7 shadow-sm"><div className="flex items-center justify-between mb-5"><div><h2 className="text-lg font-black">{t('অর্ডার সামারি', 'Order Summary')}</h2><p className="text-xs text-muted-foreground">{cart.length} {t('টি আইটেম', 'items')}</p></div><ShoppingBag className="h-5 w-5 text-primary" /></div><div className="space-y-3 max-h-[340px] overflow-auto pr-1">{cart.map((item) => <div key={`${item.product_id}-${item.variant_id || ''}-${item.bundle_id || ''}`} className="flex items-center gap-3 rounded-2xl bg-background/60 border border-border/50 p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary"><img src={item.image} alt={item.name} className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black line-clamp-2">{item.name}</p><p className="text-xs text-muted-foreground">{formatPrice(item.unit_price)} × {item.quantity}</p></div><p className="text-sm font-black shrink-0">{formatPrice(item.unit_price * item.quantity)}</p></div>)}</div><div className="mt-5 space-y-3 border-t border-border pt-5 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">{t('সাবটোটাল', 'Subtotal')}</span><span className="font-bold">{formatPrice(subtotal)}</span></div>{savingsTotal > 0 && <div className="flex items-center justify-between text-emerald-600"><span>{t('পণ্য ছাড়', 'Product savings')} ({discountPercent}%)</span><span className="font-bold">-{formatPrice(savingsTotal)}</span></div>}{appliedCoupon && couponDiscount > 0 && <div className="flex items-center justify-between text-emerald-600"><span>{t('কুপন ছাড়', 'Coupon discount')}</span><span className="font-bold">-{formatPrice(couponDiscount)}</span></div>}<div className="flex items-center justify-between"><span className="text-muted-foreground">{t('ডেলিভারি', 'Delivery')}</span><span className="font-bold">{deliveryCharge === 0 ? t('ফ্রি', 'Free') : formatPrice(deliveryCharge)}</span></div>
        {walletSummary?.enabled && walletSummary.balance > 0 && <div className={`rounded-2xl border p-3 ${walletSummary.unlocked ? 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20' : 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20'}`}>
          {walletSummary.unlocked ? <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} disabled={walletLoading || loading || walletSummary.max_usable <= 0} className="mt-1 h-4 w-4 accent-emerald-600" /><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-300"><WalletCards className="h-4 w-4" /> {t('Referral Wallet ব্যবহার করুন', 'Use Referral Wallet')}</span><span className="mt-1 block text-[11px] text-muted-foreground">{t(`ব্যালেন্স ${formatPrice(walletSummary.balance)} • এই অর্ডারে সর্বোচ্চ ${formatPrice(walletSummary.max_usable)} (${walletSummary.usage_percent}%)`, `Balance ${formatPrice(walletSummary.balance)} • Max ${formatPrice(walletSummary.max_usable)} (${walletSummary.usage_percent}%) on this order`)}</span></span>{useWallet && walletCredit > 0 && <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">-{formatPrice(walletCredit)}</span>}</label> : <div className="flex items-start gap-3"><Lock className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" /><div><p className="text-xs font-black text-amber-700 dark:text-amber-300">{t('Referral Wallet এখনো ব্যবহারযোগ্য নয়', 'Referral Wallet is locked')}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t(`আপনার wallet-এ ${formatPrice(walletSummary.balance)} আছে। ব্যবহার করতে আগে কমপক্ষে ${formatPrice(walletSummary.min_purchase_amount)} টাকার Seed Purchase সম্পন্ন করুন এবং অর্ডারটি Delivered হতে হবে।`, `You have ${formatPrice(walletSummary.balance)} in your wallet. To use it, first complete a Seed Purchase of at least ${formatPrice(walletSummary.min_purchase_amount)} and the order must be Delivered.`)}</p></div></div>}
        </div>}
        {walletCredit > 0 && <div className="flex items-center justify-between text-emerald-600"><span>{t('Referral Wallet Credit', 'Referral Wallet Credit')}</span><span className="font-bold">-{formatPrice(walletCredit)}</span></div>}<div className="flex items-center justify-between border-t border-border pt-4 text-base"><span className="font-black">{t('সর্বমোট', 'Grand Total')}</span><span className="text-xl font-black text-primary">{formatPrice(payableTotal)}</span></div></div>
        <div className="mt-5 rounded-2xl border border-border bg-background/60 p-3"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-2"><Tag className="h-4 w-4 text-primary" />{t('কুপন কোড', 'Coupon Code')}</div><div className="flex gap-2"><input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="WELCOME10" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold focus:border-primary focus:outline-none" />{appliedCoupon ? <button type="button" onClick={removeCoupon} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600"><X className="h-4 w-4" /></button> : <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponCode} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground disabled:opacity-50">{couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('প্রয়োগ', 'Apply')}</button>}</div>{couponError && <p className="mt-2 text-xs font-semibold text-red-500">{couponError}</p>}</div>
        {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</div>}
        <button type="submit" disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 transition disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}{loading ? t('অর্ডার হচ্ছে...', 'Placing order...') : t('অর্ডার নিশ্চিত করুন', 'Place Order')}</button>
      </div></div></div></form>
    </div></div>
  );
}
