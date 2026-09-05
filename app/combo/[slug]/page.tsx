'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Clock3,
  Leaf,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  User,
  X,
  Zap,
} from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function ComboLandingPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [combo, setCombo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQty, setSelectedQty] = useState(1);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3 * 3600);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCombo = async () => {
      const { data: comboData, error: comboError } = await supabase
        .from('combo_packs')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (comboError || !comboData) {
        setLoading(false);
        return;
      }

      const { data: itemsData } = await supabase
        .from('combo_items')
        .select('quantity, unit_type, products(*)')
        .eq('combo_id', comboData.id);

      const tiers = Array.isArray(comboData.tier_pricing) ? comboData.tier_pricing : [];
      const firstQty = Number(tiers[0]?.qty ?? tiers[0]?.quantity ?? 1);

      setCombo({ ...comboData, combo_items: itemsData || [] });
      setSelectedQty(firstQty || 1);
      setLoading(false);
    };

    if (slug) void fetchCombo();
  }, [slug]);

  const getTierQty = (tier: any) => Number(tier?.qty ?? tier?.quantity ?? 1);
  const getTierFreeDelivery = (tier: any) => tier?.freeDelivery === true || tier?.free_delivery === true;
  const getTierOffer = (tier: any) => Number(tier?.offer) || 0;
  const getTierRegular = (tier: any) => Number(tier?.regular) || 0;

  const currentTier = useMemo(() => {
    if (!combo) return null;
    const tiers = Array.isArray(combo.tier_pricing) ? combo.tier_pricing : [];
    return tiers.find((tier: any) => getTierQty(tier) === Number(selectedQty)) || tiers[0] || {
      quantity: 1,
      regular: Number(combo.regular_total) || 0,
      offer: Number(combo.combo_price) || 0,
      free_delivery: Boolean(combo.free_delivery),
      badge: 'BEST',
    };
  }, [combo, selectedQty]);

  const currentComboPrice = Number(currentTier?.offer) || Number(combo?.combo_price) || 0;
  const regularPrice = Number(currentTier?.regular) || Number(combo?.regular_total) || 0;
  const savings = Math.max(0, regularPrice - currentComboPrice);
  const freeDelivery = getTierFreeDelivery(currentTier);
  const deliveryCharge = freeDelivery ? 0 : (currentComboPrice >= 600 ? 0 : currentComboPrice >= 400 ? 50 : currentComboPrice >= 200 ? 70 : 120);
  const finalTotal = currentComboPrice + deliveryCharge;

  const tiers = Array.isArray(combo?.tier_pricing) ? combo.tier_pricing : [];
  const comboItems = Array.isArray(combo?.combo_items) ? combo.combo_items : [];
  const itemCount = comboItems.length || 3;
  const imageList = comboItems.map((item: any) => item.products?.image).filter(Boolean);
  const heroImage = combo?.image || combo?.images?.[0] || imageList[0] || '';

  const formatTime = (seconds: number) => {
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return { hours, minutes, seconds: secs };
  };

  const parseManualList = (data: any) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return data
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            const parts = line.split(/[-–:]/);
            return { name: parts[0]?.trim() || line, qty: parts[1]?.trim() || '' };
          });
      }
    }
    return [];
  };

  const manualItems = parseManualList(combo?.manual_items_list);
  const timer = formatTime(timeLeft);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !phone.trim()) {
      toast('দয়া করে নাম, ঠিকানা ও ফোন নাম্বার দিন', 'error');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!/^01[0-9]{9}$/.test(cleanPhone)) {
      toast('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { data: orderData, error: orderError } = await supabase.rpc('create_combo_order', {
        p_combo_id: combo.id,
        p_quantity: selectedQty,
        p_customer_name: name.trim(),
        p_customer_phone: cleanPhone,
        p_delivery_address: address.trim(),
        p_special_instructions: null,
      });

      if (orderError) throw orderError;
      if (orderData?.error) throw new Error(orderData.error);

      toast('আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!');
      router.push(`/order-success?number=${orderData.order_number}`);
    } catch (err: any) {
      toast('অর্ডার করতে সমস্যা হয়েছে: ' + (err?.message || ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-10 w-72 rounded-full bg-emerald-100" />
          <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            <div className="h-[520px] rounded-[32px] bg-emerald-50" />
            <div className="h-[520px] rounded-[32px] bg-emerald-50" />
          </div>
        </div>
      </div>
    );
  }

  if (!combo) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-24 text-center">
        <div className="mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-10 shadow-sm">
          <PackageCheck className="mx-auto h-14 w-14 text-emerald-700" />
          <h2 className="mt-5 text-2xl font-black text-slate-900">কম্বো প্যাকটি পাওয়া যায়নি</h2>
          <p className="mt-2 text-sm text-slate-500">কম্বোটি হয়তো বর্তমানে সক্রিয় নেই বা লিংকটি পরিবর্তন হয়েছে।</p>
          <a href="/combos" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-900">
            সব কম্বো দেখুন <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6faf7] pb-16 text-slate-900">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,.22),_transparent_35%),linear-gradient(135deg,#052e1b_0%,#0b5d3c_52%,#0a3f2a_100%)] text-white">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 pb-9 pt-10 sm:px-6 lg:px-8 lg:pb-12 lg:pt-14">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-100/80">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5"><Sparkles className="h-3.5 w-3.5" /> GAZI SEED Combo</span>
            <span className="rounded-full bg-amber-400 px-3 py-1.5 text-amber-950">{currentTier?.badge || 'BEST OFFER'}</span>
            {freeDelivery && <span className="rounded-full bg-lime-300 px-3 py-1.5 text-emerald-950">Free Delivery</span>}
          </div>
          <div className="mt-5 max-w-3xl">
            <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">{combo.title_bn}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/85 sm:text-base">{combo.description_bn || 'একসাথে জনপ্রিয় বীজের স্মার্ট কম্বো—সহজে অর্ডার করুন, একসাথে সাশ্রয় করুন।'}</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold backdrop-blur"><Leaf className="h-4 w-4 text-lime-300" /> {itemCount}টি জনপ্রিয় বীজ</div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold backdrop-blur"><Truck className="h-4 w-4 text-lime-300" /> সারাদেশে হোম ডেলিভারি</div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold backdrop-blur"><ShieldCheck className="h-4 w-4 text-lime-300" /> সহজ অর্ডার প্রসেস</div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-5 grid gap-6 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_20px_70px_-45px_rgba(5,46,22,.7)]">
              <div className="relative aspect-[4/3] overflow-hidden bg-emerald-50 sm:aspect-[16/10]">
                {heroImage ? (
                  <img src={heroImage} alt={combo.title_bn} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-100 to-lime-50">
                    <Leaf className="h-20 w-20 text-emerald-700/40" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent p-5 sm:p-7">
                  <div className="flex flex-wrap items-end justify-between gap-3 text-white">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-200">Your Garden Starter Pack</p>
                      <p className="mt-1 text-lg font-black sm:text-xl">৩ ধরনের বীজ • ১টি স্মার্ট কম্বো</p>
                    </div>
                    {savings > 0 && <span className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-amber-950">সাশ্রয় ৳{savings}</span>}
                  </div>
                </div>
              </div>
              {imageList.length > 1 && (
                <div className="grid grid-cols-3 gap-3 border-t border-slate-100 p-4 sm:p-5">
                  {comboItems.slice(0, 3).map((item: any, index: number) => (
                    <div key={item.product_id || index} className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                      {item.products?.image ? <img src={item.products.image} alt={item.products?.name_bn || 'Product'} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-emerald-50" />}
                      <div className="px-2 py-2 text-center text-[10px] font-bold text-slate-700 line-clamp-2">{item.products?.name_bn || 'বীজ'}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Inside the Combo</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">এই কম্বোতে যা যা থাকছে</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800">{itemCount} items</span>
              </div>

              {comboItems.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {comboItems.map((item: any, idx: number) => {
                    const product = item.products || {};
                    const unit = item.unit_type === 'packet' ? 'প্যাকেট' : 'পিস';
                    const perPack = Number(item.quantity) || 1;
                    const totalQty = perPack * Number(selectedQty || 1);
                    const productRegular = Number(product.regular_price) || 0;
                    const productSale = Number(product.sale_price) || productRegular;
                    return (
                      <div key={item.product_id || idx} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 sm:gap-4 sm:p-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 sm:h-20 sm:w-20">
                          {product.image ? <img src={product.image} alt={product.name_bn || 'Product'} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Leaf className="h-7 w-7 text-emerald-600/40" /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-black text-slate-900 sm:text-base">{product.name_bn || product.name_en || 'বীজ'}</h3>
                          <p className="mt-1 text-xs text-slate-500">এক প্যাকে {perPack} {unit} • {selectedQty} প্যাকে মোট {totalQty} {unit}</p>
                          <p className="mt-1 text-xs font-bold text-emerald-700">রেগুলার ৳{productRegular} <span className="font-semibold text-slate-400">• এখন ৳{productSale}</span></p>
                        </div>
                        <span className="shrink-0 rounded-xl bg-emerald-800 px-3 py-2 text-xs font-black text-white">{totalQty} {unit}</span>
                      </div>
                    );
                  })}
                </div>
              ) : manualItems.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {manualItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <span className="text-sm font-bold text-slate-800">{item.name}</span>
                      {item.qty && <span className="rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">{item.qty}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">এই কম্বোর আইটেম তালিকা এখনো যোগ করা হয়নি।</div>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <PackageCheck className="h-5 w-5 text-emerald-700" />
                <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-emerald-800">Ready Pack</p>
                <p className="mt-1 text-sm font-bold text-emerald-950">একসাথে অর্ডার</p>
              </div>
              <div className="rounded-2xl border border-lime-100 bg-lime-50 p-4">
                <Zap className="h-5 w-5 text-lime-700" />
                <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-lime-800">Smart Savings</p>
                <p className="mt-1 text-sm font-bold text-lime-950">বেশি নিলে বেশি সাশ্রয়</p>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <Truck className="h-5 w-5 text-sky-700" />
                <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-sky-800">Home Delivery</p>
                <p className="mt-1 text-sm font-bold text-sky-950">সারাদেশে পৌঁছে দিই</p>
              </div>
            </section>

            <section className="rounded-[30px] bg-slate-950 p-5 text-white sm:p-7">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-amber-300"><Clock3 className="h-4 w-4" /> অফার শেষ হওয়ার আগে অর্ডার করুন</div>
              <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
                {[
                  ['ঘণ্টা', timer.hours],
                  ['মিনিট', timer.minutes],
                  ['সেকেন্ড', timer.seconds],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center">
                    <div className="text-2xl font-black tracking-tight sm:text-3xl">{value}</div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="rounded-[30px] border border-emerald-100 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(5,46,22,.7)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Choose your pack</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">প্যাকেজের সংখ্যা</h2>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right"><div className="text-[10px] font-bold uppercase text-emerald-700">Best value</div><div className="text-sm font-black text-emerald-950">বেশি নিলে সাশ্রয়</div></div>
              </div>

              <div className="mt-5 grid gap-3">
                {tiers.map((tier: any, idx: number) => {
                  const qty = getTierQty(tier);
                  const offer = getTierOffer(tier);
                  const regular = getTierRegular(tier);
                  const selected = qty === Number(selectedQty);
                  const tierFree = getTierFreeDelivery(tier);
                  const tierSave = Math.max(0, regular - offer);
                  return (
                    <button
                      key={`${qty}-${idx}`}
                      type="button"
                      onClick={() => setSelectedQty(qty)}
                      className={`relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all ${selected ? 'border-emerald-700 bg-emerald-50 shadow-lg shadow-emerald-900/10' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'}`}
                    >
                      {tier.badge && <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${selected ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-600'}`}>{tier.badge}</span>}
                      <div className="flex items-center gap-3 pr-16">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black ${selected ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>{qty}×</div>
                        <div>
                          <div className="text-sm font-black text-slate-900">{qty} প্যাকেট</div>
                          <div className="mt-1 text-[11px] text-slate-500">Regular ৳{regular} {tierSave > 0 && <span className="font-bold text-emerald-700">• Save ৳{tierSave}</span>}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">অফার মূল্য</span><div className="text-2xl font-black text-emerald-800">৳{offer}</div></div>
                        <div className="text-right text-[10px] font-extrabold uppercase tracking-wide">{tierFree ? <span className="text-sky-700">🚚 Free Delivery</span> : <span className="text-slate-500">Delivery Charge</span>}</div>
                      </div>
                      {selected && <div className="mt-3 flex items-center gap-2 text-xs font-extrabold text-emerald-800"><Check className="h-4 w-4" /> এই প্যাকেজটি নির্বাচিত</div>}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between text-sm"><span className="text-slate-300">প্যাকেজ মূল্য</span><span className="font-black">৳{currentComboPrice}</span></div>
                <div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-300">ডেলিভারি</span><span className={`font-black ${deliveryCharge === 0 ? 'text-lime-300' : 'text-white'}`}>{deliveryCharge === 0 ? 'ফ্রি' : `৳${deliveryCharge}`}</span></div>
                <div className="my-3 h-px bg-white/10" />
                <div className="flex items-end justify-between"><div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">মোট পেমেন্ট</div><div className="mt-1 text-3xl font-black text-amber-300">৳{finalTotal}</div></div>{savings > 0 && <span className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-300">সাশ্রয় ৳{savings}</span>}</div>
              </div>

              <a href="#order-form" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900">এখনই অর্ডার করুন <ArrowRight className="h-5 w-5" /></a>
            </section>

            <section id="order-form" className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Quick Checkout</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">অর্ডার কনফার্ম করুন</h2>
                <p className="mt-1 text-xs text-slate-500">ফর্মটি পূরণ করুন—আমরা ফোন করে কনফার্ম করব।</p>
              </div>

              <form onSubmit={handleOrderSubmit} className="space-y-4">
                <Field label="পুরো নাম" icon={<User className="h-4 w-4" />}>
                  <input value={name} onChange={(e) => setName(e.target.value)} required type="text" placeholder="যেমন: মোঃ রহিম" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </Field>
                <Field label="ফোন নাম্বার" icon={<Phone className="h-4 w-4" />}>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </Field>
                <Field label="সম্পূর্ণ ঠিকানা" icon={<MapPin className="h-4 w-4" />}>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={3} placeholder="গ্রাম/মহল্লা, থানা, জেলা" className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" />
                </Field>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800"><ShoppingCart className="h-4 w-4" /> {combo.title_bn}</div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{selectedQty} প্যাকেট</span><span className="font-black text-emerald-900">৳{currentComboPrice}</span></div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">ডেলিভারি</span><span className={`font-black ${deliveryCharge === 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{deliveryCharge === 0 ? 'ফ্রি' : `৳${deliveryCharge}`}</span></div>
                  <div className="mt-3 flex items-center justify-between border-t border-emerald-100 pt-3"><span className="text-sm font-black text-slate-700">মোট</span><span className="text-xl font-black text-red-600">৳{finalTotal}</span></div>
                </div>

                <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-5 py-4 text-base font-black text-white shadow-xl transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">
                  <ShieldCheck className="h-5 w-5" /> {submitting ? 'অর্ডার প্রসেস হচ্ছে...' : `অর্ডার কনফার্ম করুন ৳${finalTotal}`}
                </button>
                <p className="flex items-center justify-center gap-2 text-center text-[11px] font-semibold text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" /> আপনার তথ্য নিরাপদভাবে অর্ডার প্রসেসিংয়ে ব্যবহার হবে</p>
              </form>
            </section>
          </aside>
        </div>
      </div>

      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-5 md:grid-cols-3">
            <TrustItem icon={<Truck className="h-5 w-5" />} title="সারাদেশে ডেলিভারি" text={freeDelivery ? 'এই নির্বাচিত প্যাকেজে ডেলিভারি ফ্রি।' : 'ডেলিভারি চার্জ অর্ডার সারাংশে দেখানো হচ্ছে।'} />
            <TrustItem icon={<Phone className="h-5 w-5" />} title="অর্ডার কনফার্মেশন" text="ফর্ম জমা দেওয়ার পর প্রয়োজন হলে ফোনে অর্ডার নিশ্চিত করা হবে।" />
            <TrustItem icon={<PackageCheck className="h-5 w-5" />} title="Ready Combo Pack" text="একসাথে প্রয়োজনীয় বীজ নেওয়ার সহজ ও দ্রুত উপায়।" />
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-slate-700">{icon}<span>{label}</span></span>
      {children}
    </label>
  );
}

function TrustItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">{icon}</div>
      <div><h3 className="text-sm font-black text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>
    </div>
  );
}
