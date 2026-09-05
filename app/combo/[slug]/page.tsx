'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Check, Clock3, Leaf, MapPin, PackageCheck, Phone, ShieldCheck, ShoppingCart, Sparkles, Truck, User } from 'lucide-react';
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
    const timer = setInterval(() => setTimeLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('combo_packs').select('*').eq('slug', slug).eq('is_active', true).single();
      if (error || !data) { setLoading(false); return; }
      const { data: items } = await supabase.from('combo_items').select('quantity, unit_type, products(*)').eq('combo_id', data.id);
      setCombo({ ...data, combo_items: items || [] });
      const tiers = Array.isArray(data.tier_pricing) ? data.tier_pricing : [];
      setSelectedQty(Number(tiers[0]?.qty ?? tiers[0]?.quantity ?? 1));
      setLoading(false);
    };
    if (slug) void load();
  }, [slug]);

  const tiers = Array.isArray(combo?.tier_pricing) ? combo.tier_pricing : [];
  const items = Array.isArray(combo?.combo_items) ? combo.combo_items : [];
  const getQty = (tier: any) => Number(tier?.qty ?? tier?.quantity ?? 1);
  const getFree = (tier: any) => tier?.freeDelivery === true || tier?.free_delivery === true;
  const currentTier = useMemo(() => tiers.find((t: any) => getQty(t) === Number(selectedQty)) || tiers[0] || {}, [tiers, selectedQty]);
  const offer = Number(currentTier?.offer) || Number(combo?.combo_price) || 0;
  const regular = Number(currentTier?.regular) || Number(combo?.regular_total) || 0;
  const savings = Math.max(0, regular - offer);
  const freeDelivery = getFree(currentTier);
  const delivery = freeDelivery ? 0 : offer >= 600 ? 0 : offer >= 400 ? 50 : offer >= 200 ? 70 : 120;
  const total = offer + delivery;
  const hero = combo?.image || combo?.images?.[0] || items[0]?.products?.image || '';
  const timer = { h: String(Math.floor(timeLeft / 3600)).padStart(2, '0'), m: String(Math.floor((timeLeft % 3600) / 60)).padStart(2, '0'), s: String(timeLeft % 60).padStart(2, '0') };

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!name.trim() || !address.trim() || !cleanPhone) return toast('দয়া করে নাম, ঠিকানা ও ফোন নাম্বার দিন', 'error');
    if (!/^01[0-9]{9}$/.test(cleanPhone)) return toast('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন', 'error');
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_combo_order', {
        p_combo_id: combo.id, p_quantity: selectedQty, p_customer_name: name.trim(), p_customer_phone: cleanPhone, p_delivery_address: address.trim(), p_special_instructions: null,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast('আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!');
      router.push(`/order-success?number=${data.order_number}`);
    } catch (error: any) {
      toast('অর্ডার করতে সমস্যা হয়েছে: ' + (error?.message || ''), 'error');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#f4f8f2] p-6 pt-28"><div className="mx-auto max-w-6xl animate-pulse space-y-6"><div className="h-80 rounded-[40px] bg-emerald-100"/><div className="h-24 rounded-3xl bg-emerald-50"/></div></div>;
  if (!combo) return <div className="min-h-[70vh] bg-[#f4f8f2] px-4 py-28 text-center"><div className="mx-auto max-w-md rounded-[32px] bg-white p-10 shadow-xl"><PackageCheck className="mx-auto h-14 w-14 text-emerald-700"/><h2 className="mt-5 text-2xl font-black">কম্বো প্যাকটি পাওয়া যায়নি</h2><a href="/combos" className="mt-6 inline-flex rounded-2xl bg-emerald-800 px-5 py-3 font-bold text-white">সব কম্বো দেখুন</a></div></div>;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f8f2] pb-24 text-slate-900">
      <section className="relative overflow-hidden bg-[#063b29] text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.16em] text-emerald-100"><Sparkles className="h-4 w-4 text-lime-300"/> GAZI SEED • SMART COMBO</div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">{combo.title_bn}</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/80 sm:text-base">{combo.description_bn || 'প্রয়োজনীয় বীজ একসাথে নিন, স্মার্ট দামে বাগান শুরু করুন।'}</p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold"><Leaf className="mr-1 inline h-3.5 w-3.5 text-lime-300"/>{items.length}টি বীজ</span>
                <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold"><Truck className="mr-1 inline h-3.5 w-3.5 text-lime-300"/>হোম ডেলিভারি</span>
                <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-lime-300"/>Cash on Delivery</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="relative aspect-square overflow-hidden rounded-[42px] border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-sm">
                <div className="h-full overflow-hidden rounded-[34px] bg-emerald-950">
                  {hero ? <img src={hero} alt={combo.title_bn} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center"><Leaf className="h-28 w-28 text-lime-300/30"/></div>}
                </div>
                <div className="absolute left-7 top-7 rounded-2xl bg-amber-400 px-4 py-3 text-center text-amber-950 shadow-xl"><div className="text-[10px] font-black uppercase tracking-wider">Save</div><div className="text-2xl font-black">৳{savings}</div></div>
                <div className="absolute bottom-7 right-7 rounded-2xl border border-white/20 bg-slate-950/85 px-4 py-3 text-white shadow-xl backdrop-blur"><div className="text-[10px] uppercase text-slate-300">Selected pack</div><div className="text-lg font-black">{selectedQty}× Pack</div></div>
              </div>
              <div className="absolute -bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full bg-white px-5 py-2 text-xs font-black text-emerald-900 shadow-xl sm:block">এক অর্ডারে একসাথে প্রয়োজনীয় বীজ</div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-xl"><div className="flex items-center gap-3"><span className="rounded-2xl bg-emerald-100 p-3 text-emerald-800"><PackageCheck className="h-5 w-5"/></span><div><div className="text-xs font-black uppercase tracking-wider text-emerald-700">Combo contents</div><div className="mt-1 text-lg font-black">{items.length} seed varieties</div></div></div></div>
          <div className="rounded-3xl border border-amber-100 bg-white p-5 shadow-xl"><div className="flex items-center gap-3"><span className="rounded-2xl bg-amber-100 p-3 text-amber-700"><ZapIcon/></span><div><div className="text-xs font-black uppercase tracking-wider text-amber-700">Smart saving</div><div className="mt-1 text-lg font-black">সাশ্রয় ৳{savings}</div></div></div></div>
          <div className="rounded-3xl border border-sky-100 bg-white p-5 shadow-xl"><div className="flex items-center gap-3"><span className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Truck className="h-5 w-5"/></span><div><div className="text-xs font-black uppercase tracking-wider text-sky-700">Delivery</div><div className="mt-1 text-lg font-black">{freeDelivery ? 'Free Delivery' : `৳${delivery}`}</div></div></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8 lg:pt-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-8">
            <section className="rounded-[34px] border border-emerald-100 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">What's inside</p><h2 className="mt-2 text-3xl font-black tracking-tight">এই প্যাকেজে যা পাবেন</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">{items.length} items</span></div>
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {items.map((item: any, index: number) => {
                  const product = item.products || {};
                  const per = Number(item.quantity) || 1;
                  const totalQty = per * Number(selectedQty || 1);
                  return <article key={item.product_id || index} className="group overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fbf7] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl"><div className="relative aspect-[4/3] overflow-hidden bg-emerald-50">{product.image ? <img src={product.image} alt={product.name_bn || 'Seed'} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/> : <div className="flex h-full items-center justify-center"><Leaf className="h-12 w-12 text-emerald-700/30"/></div>}<span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-emerald-900">0{index+1}</span></div><div className="p-4"><h3 className="line-clamp-2 text-sm font-black">{product.name_bn || product.name_en || 'বীজ'}</h3><p className="mt-1 text-xs text-slate-500">{per} প্যাকেট / কম্বো</p><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">বর্তমান প্যাকে</span><span className="rounded-full bg-emerald-800 px-2.5 py-1 text-[10px] font-black text-white">{totalQty} প্যাকেট</span></div></div></article>;
                })}
              </div>
            </section>

            <section className="rounded-[34px] bg-[#073c29] p-5 text-white shadow-xl sm:p-8">
              <div className="grid gap-7 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-black uppercase tracking-[.18em] text-lime-300">Limited-time offer</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">আজকের অফারটি মিস করবেন না</h2><p className="mt-2 max-w-xl text-sm leading-6 text-emerald-100/75">যে প্যাকেজটি নেবেন, সেটি সিলেক্ট করলেই দাম ও ডেলিভারি সঙ্গে সঙ্গে আপডেট হবে।</p></div><div className="grid grid-cols-3 gap-2">{[['ঘণ্টা',timer.h],['মিনিট',timer.m],['সেকেন্ড',timer.s]].map(([label,value])=><div key={label} className="min-w-[72px] rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center"><div className="text-2xl font-black">{value}</div><div className="mt-1 text-[9px] font-bold uppercase text-emerald-200/60">{label}</div></div>)}</div></div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-[34px] border border-emerald-100 bg-white shadow-[0_24px_80px_-45px_rgba(5,46,22,.6)]">
              <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 px-5 py-5 text-white sm:px-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-200">Choose your deal</p><h2 className="mt-1 text-xl font-black">প্যাকেজ বেছে নিন</h2></div><span className="rounded-full bg-amber-400 px-3 py-1.5 text-[10px] font-black text-amber-950">BEST VALUE</span></div></div>
              <div className="space-y-3 p-5 sm:p-6">
                {tiers.map((tier: any, index: number) => { const qty=getQty(tier), selected=qty===Number(selectedQty), tierOffer=Number(tier.offer)||0, tierRegular=Number(tier.regular)||0, tierSave=Math.max(0,tierRegular-tierOffer), tierFree=getFree(tier); return <button key={`${qty}-${index}`} type="button" onClick={()=>setSelectedQty(qty)} className={`w-full rounded-[26px] border-2 p-4 text-left transition-all ${selected?'border-emerald-700 bg-emerald-50 shadow-lg':'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black ${selected?'bg-emerald-800 text-white':'bg-slate-100 text-slate-700'}`}>{qty}×</span><div><div className="text-sm font-black">{qty} প্যাকেট</div><div className="mt-1 text-[11px] text-slate-500">৳{tierRegular} regular</div></div></div>{tier.badge&&<span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${selected?'bg-amber-400 text-amber-950':'bg-slate-100 text-slate-600'}`}>{tier.badge}</span>}</div><div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Offer price</div><div className="text-3xl font-black text-emerald-800">৳{tierOffer}</div></div><div className="text-right"><div className="text-[10px] font-black text-emerald-700">Save ৳{tierSave}</div><div className="mt-1 text-[9px] font-bold uppercase text-slate-400">{tierFree?'Free Delivery':'Delivery applies'}</div></div></div>{selected&&<div className="mt-3 flex items-center gap-2 text-xs font-black text-emerald-800"><Check className="h-4 w-4"/>এই প্যাকেজটি নির্বাচিত</div>}</button>; })}
              </div>
              <div className="mx-5 rounded-[24px] bg-slate-950 p-5 text-white sm:mx-6"><div className="flex items-center justify-between text-sm"><span className="text-slate-400">প্যাকেজ মূল্য</span><b>৳{offer}</b></div><div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-400">ডেলিভারি</span><b className={delivery===0?'text-lime-300':''}>{delivery===0?'ফ্রি':`৳${delivery}`}</b></div><div className="my-4 h-px bg-white/10"/><div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</div><div className="text-4xl font-black text-amber-300">৳{total}</div></div><span className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300">সাশ্রয় ৳{savings}</span></div></div>
              <a href="#order-form" className="mx-5 mb-5 mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-base font-black text-white transition hover:bg-emerald-800 sm:mx-6 sm:mb-6">এখনই অর্ডার করুন <ArrowRight className="h-5 w-5"/></a>

              <div id="order-form" className="border-t border-slate-100 p-5 sm:p-6">
                <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700">Quick checkout</p><h3 className="mt-1 text-2xl font-black">অর্ডারটি কনফার্ম করুন</h3><p className="mt-1 text-xs text-slate-500">শুধু নাম, ফোন ও ঠিকানা দিন।</p></div>
                <form onSubmit={submitOrder} className="space-y-3">
                  <Field icon={<User className="h-4 w-4"/>} label="পুরো নাম"><input value={name} onChange={e=>setName(e.target.value)} required placeholder="মোঃ রহিম" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"/></Field>
                  <Field icon={<Phone className="h-4 w-4"/>} label="ফোন নাম্বার"><input value={phone} onChange={e=>setPhone(e.target.value)} required inputMode="numeric" placeholder="01XXXXXXXXX" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"/></Field>
                  <Field icon={<MapPin className="h-4 w-4"/>} label="সম্পূর্ণ ঠিকানা"><textarea value={address} onChange={e=>setAddress(e.target.value)} required rows={3} placeholder="গ্রাম/মহল্লা, থানা, জেলা" className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"/></Field>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-xs font-black text-emerald-800"><ShoppingCart className="h-4 w-4"/>{selectedQty} প্যাকেট • ৳{offer}</div><div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-500">ডেলিভারি</span><span className="font-black text-emerald-800">{delivery===0?'ফ্রি':`৳${delivery}`}</span></div><div className="mt-2 flex items-center justify-between border-t border-emerald-100 pt-2"><span className="font-black">মোট</span><span className="text-xl font-black text-red-600">৳{total}</span></div></div>
                  <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d89b17] px-5 py-4 text-base font-black text-slate-950 shadow-lg transition hover:bg-[#e8ab24] disabled:opacity-60"><ShieldCheck className="h-5 w-5"/>{submitting?'অর্ডার প্রসেস হচ্ছে...':`অর্ডার কনফার্ম করুন ৳${total}`}</button>
                  <p className="text-center text-[10px] font-semibold text-slate-400">🔒 আপনার তথ্য শুধুমাত্র অর্ডার প্রসেসিংয়ের জন্য ব্যবহার হবে।</p>
                </form>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8"><div className="rounded-[34px] border border-emerald-100 bg-white p-5 shadow-sm sm:p-8"><div className="grid gap-5 md:grid-cols-3"><Info icon={<Truck className="h-5 w-5"/>} title="সারাদেশে ডেলিভারি" text={freeDelivery?'এই প্যাকেজে ডেলিভারি ফ্রি।':'ডেলিভারি চার্জ অর্ডার সারাংশে স্পষ্ট দেখানো হচ্ছে।'}/><Info icon={<Phone className="h-5 w-5"/>} title="সহজ অর্ডার" text="নাম, ফোন ও ঠিকানা দিয়ে দ্রুত অর্ডার কনফার্ম করুন।"/><Info icon={<PackageCheck className="h-5 w-5"/>} title="Ready Combo" text="একসাথে প্রয়োজনীয় বীজ নেওয়ার ঝামেলাহীন উপায়।"/></div></div></section>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 p-3 shadow-[0_-15px_40px_-25px_rgba(5,46,22,.6)] backdrop-blur md:hidden"><div className="mx-auto flex max-w-xl items-center gap-3"><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-bold text-slate-500">{selectedQty} প্যাকেট • {freeDelivery?'Free Delivery':`৳${delivery} delivery`}</div><div className="text-xl font-black text-emerald-800">৳{total}</div></div><a href="#order-form" className="flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-800 px-5 py-3 text-sm font-black text-white">অর্ডার <ArrowRight className="h-4 w-4"/></a></div></div>
    </main>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-slate-700">{icon}{label}</span>{children}</label>; }
function Info({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">{icon}</span><div><h3 className="text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div></div>; }
function ZapIcon(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>; }
