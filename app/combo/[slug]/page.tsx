'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, getVisitorCountry } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Gift,
  Leaf,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  User,
  WalletCards,
  Zap,
} from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

type Country = 'BD' | 'IN';

type ComboItem = {
  product_id?: string;
  quantity?: number;
  unit_type?: string;
  products?: Record<string, any> | null;
};

function getProductImage(product: Record<string, any> | null | undefined): string {
  if (!product) return '';

  const isUsableImage = (value: unknown): value is string => {
    if (typeof value !== 'string' || !value.trim()) return false;
    const normalized = value.trim().toLowerCase();
    return !normalized.includes('placehold.co') && !normalized.includes('placeholder');
  };

  const gallery = Array.isArray(product.product_images)
    ? [...product.product_images]
        .filter((item: any) => isUsableImage(item?.image_url))
        .sort((a: any, b: any) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
        .map((item: any) => item.image_url.trim())
    : [];

  const candidates = [
    ...gallery,
    product.image_url,
    product.featured_image,
    product.primary_image,
    product.image,
    Array.isArray(product.images) ? product.images[0] : '',
    Array.isArray(product.gallery) ? product.gallery[0] : '',
  ];

  return candidates.find(isUsableImage)?.trim() || '';
}

function getComboHeroImages(combo: Record<string, any>, items: ComboItem[]): string[] {
  const comboImages = [
    ...(Array.isArray(combo?.images) ? combo.images : []),
    combo?.image_url,
    combo?.featured_image,
    combo?.image,
  ].filter((value) => typeof value === 'string' && value.trim() && !value.includes('placehold.co'));

  const productImages = items
    .map((item) => getProductImage(item.products))
    .filter((value) => value && !value.includes('placehold.co'));

  return Array.from(new Set([...productImages, ...comboImages]));
}

export default function ComboLandingPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [combo, setCombo] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQty, setSelectedQty] = useState(1);
  const [country, setCountry] = useState<Country>('BD');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3 * 3600);

  useEffect(() => {
    setCountry(getVisitorCountry());
    const onCountryChange = () => setCountry(getVisitorCountry());
    window.addEventListener('gazi-country-changed', onCountryChange);
    return () => window.removeEventListener('gazi-country-changed', onCountryChange);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('combo_packs')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Load combo items separately from the product gallery. This avoids losing all
      // combo items when a nested relationship query is unavailable to the client.
      const { data: items } = await supabase
        .from('combo_items')
        .select('product_id, quantity, unit_type, products(*)')
        .eq('combo_id', data.id);

      const productIds = (items || []).map((item: any) => item.product_id).filter(Boolean);
      const { data: galleryRows } = productIds.length
        ? await supabase
            .from('product_images')
            .select('product_id, image_url, display_order')
            .in('product_id', productIds)
            .order('display_order', { ascending: true })
        : { data: [] };

      const galleryByProduct = new Map<string, any[]>();
      (galleryRows || []).forEach((row: any) => {
        const current = galleryByProduct.get(row.product_id) || [];
        current.push({ image_url: row.image_url, display_order: row.display_order });
        galleryByProduct.set(row.product_id, current);
      });

      const enrichedItems = (items || []).map((item: any) => ({
        ...item,
        products: item.products
          ? { ...item.products, product_images: galleryByProduct.get(item.product_id) || [] }
          : item.products,
      }));

      setCombo({ ...data, combo_items: enrichedItems });
      const tiers = Array.isArray(data.tier_pricing) ? data.tier_pricing : [];
      setSelectedQty(Number(tiers[0]?.qty ?? tiers[0]?.quantity ?? 1));
      setLoading(false);
    };

    if (slug) void load();
  }, [slug]);

  const tiers = Array.isArray(combo?.tier_pricing) ? (combo?.tier_pricing ?? []) : [];
  const items: ComboItem[] = Array.isArray(combo?.combo_items) ? (combo?.combo_items ?? []) : [];
  const getQty = (tier: any) => Number(tier?.qty ?? tier?.quantity ?? 1);
  const getFree = (tier: any) => tier?.freeDelivery === true || tier?.free_delivery === true;

  const currentTier = useMemo(
    () => tiers.find((tier: any) => getQty(tier) === Number(selectedQty)) || tiers[0] || {},
    [tiers, selectedQty],
  );

  const offer = Number(currentTier?.offer) || Number(combo?.combo_price) || 0;
  const regular = Number(currentTier?.regular) || Number(combo?.regular_total) || 0;
  const savings = Math.max(0, regular - offer);
  const freeDelivery = getFree(currentTier) || (country === 'IN' ? offer >= 999 : offer >= 600);
  const delivery = freeDelivery ? 0 : country === 'IN' ? (offer >= 499 ? 60 : 90) : offer >= 400 ? 50 : offer >= 200 ? 70 : 120;
  const total = offer + delivery;
  const heroImages = useMemo(() => (combo ? getComboHeroImages(combo, items) : []), [combo, items]);
  const timer = {
    h: String(Math.floor(timeLeft / 3600)).padStart(2, '0'),
    m: String(Math.floor((timeLeft % 3600) / 60)).padStart(2, '0'),
    s: String(timeLeft % 60).padStart(2, '0'),
  };

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneValid = country === 'IN' ? /^[6-9][0-9]{9}$/.test(cleanPhone) : /^01[0-9]{9}$/.test(cleanPhone);

    if (!name.trim() || !address.trim() || !cleanPhone) {
      return toast(country === 'IN' ? 'Please enter your name, address and phone number' : 'দয়া করে নাম, ঠিকানা ও ফোন নাম্বার দিন', 'error');
    }
    if (!phoneValid) {
      return toast(country === 'IN' ? 'Enter a valid 10-digit Indian mobile number' : 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন', 'error');
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_combo_order', {
        p_combo_id: combo?.id,
        p_quantity: selectedQty,
        p_customer_name: name.trim(),
        p_customer_phone: cleanPhone,
        p_delivery_address: address.trim(),
        p_special_instructions: null,
        p_order_source: 'combo',
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast(country === 'IN' ? 'Your order has been received successfully!' : 'আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!');
      router.push(`/order-success?number=${data.order_number}`);
    } catch (error: any) {
      toast((country === 'IN' ? 'Order failed: ' : 'অর্ডার করতে সমস্যা হয়েছে: ') + (error?.message || ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f8f4] p-6 pt-28">
        <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
          <div className="h-[520px] rounded-[38px] bg-emerald-100" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-28 rounded-3xl bg-white" />
            <div className="h-28 rounded-3xl bg-white" />
            <div className="h-28 rounded-3xl bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (!combo) {
    return (
      <div className="min-h-[70vh] bg-[#f5f8f4] px-4 py-28 text-center">
        <div className="mx-auto max-w-md rounded-[32px] border border-emerald-100 bg-white p-10 shadow-xl">
          <PackageCheck className="mx-auto h-14 w-14 text-emerald-700" />
          <h2 className="mt-5 text-2xl font-black">{country === 'IN' ? 'Combo pack not found' : 'কম্বো প্যাকটি পাওয়া যায়নি'}</h2>
          <a href="/combos" className="mt-6 inline-flex rounded-2xl bg-emerald-800 px-5 py-3 font-bold text-white">
            {country === 'IN' ? 'View all combos' : 'সব কম্বো দেখুন'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8f4] pb-28 text-slate-900">
      <section className="relative overflow-hidden bg-[#063d2c] text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-lime-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-[32rem] w-[32rem] rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-20 lg:pt-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_.98fr] lg:gap-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.18em] text-emerald-100">
                <Sparkles className="h-4 w-4 text-lime-300" /> GAZI SEED • SMART COMBO
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-[4.35rem]">{combo.title_bn}</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/80 sm:text-base">
                {combo.description_bn || (country === 'IN' ? 'Everything you need to start a beautiful home garden, bundled at a smarter price.' : 'প্রয়োজনীয় বীজ একসাথে নিন, স্মার্ট দামে বাগান শুরু করুন।')}
              </p>

              <div className="mt-7 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"><Leaf className="h-4 w-4 text-lime-300" /><p className="mt-2 text-lg font-black">{items.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/65">Varieties</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"><Gift className="h-4 w-4 text-lime-300" /><p className="mt-2 text-lg font-black">{selectedQty}×</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/65">Pack</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"><Zap className="h-4 w-4 text-amber-300" /><p className="mt-2 text-lg font-black">{formatPrice(savings)}</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/65">You save</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"><Truck className="h-4 w-4 text-sky-300" /><p className="mt-2 text-lg font-black">{freeDelivery ? 'FREE' : formatPrice(delivery)}</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/65">Delivery</p></div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#deal" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-lime-300 px-6 text-sm font-black text-emerald-950 shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:bg-lime-200">{country === 'IN' ? 'Choose your deal' : 'আপনার প্যাক বেছে নিন'}<ArrowRight className="h-4 w-4" /></a>
                <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-xs font-bold text-emerald-50/80"><ShieldCheck className="h-4 w-4 text-lime-300" />{country === 'IN' ? 'Secure order • COD available' : 'নিরাপদ অর্ডার • Cash on Delivery'}</div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[590px]">
              <div className="relative rounded-[38px] border border-white/15 bg-white/[0.06] p-3 shadow-[0_28px_80px_rgba(0,0,0,.28)] backdrop-blur-sm">
                <div className="relative overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.98),rgba(240,246,242,.98)_55%,rgba(221,233,226,.98))] p-5 sm:p-7">
                  {heroImages.length > 0 ? (
                    <div className="grid min-h-[360px] items-center gap-4 sm:min-h-[440px] sm:grid-cols-3 sm:gap-5">
                      {heroImages.slice(0, 3).map((image, index) => (
                        <div key={`${image}-${index}`} className={`relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_35px_rgba(15,23,42,.12)] ${index === 0 ? 'sm:-rotate-3 sm:-translate-y-1' : index === 1 ? 'sm:-translate-y-8 sm:scale-[1.08] sm:z-10' : 'sm:rotate-3 sm:translate-y-3'}`}>
                          <div className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black text-emerald-900 shadow-sm">0{index + 1}</div>
                          <img src={image} alt={`${combo.title_bn} product ${index + 1}`} className="aspect-[4/5] h-full w-full object-contain p-3" loading={index === 0 ? 'eager' : 'lazy'} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[360px] items-center justify-center sm:min-h-[440px]"><div className="max-w-sm text-center"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-emerald-100 text-emerald-700"><Leaf className="h-12 w-12" /></div><p className="mt-5 text-sm font-black text-slate-800">{country === 'IN' ? 'Add a combo image or product gallery images to show the pack here.' : 'কম্বো বা পণ্যের ছবি যোগ করলে এখানে প্যাক ভিজ্যুয়াল দেখা যাবে।'}</p></div></div>
                  )}
                  <div className="absolute left-6 top-6 rounded-2xl bg-amber-400 px-4 py-3 text-center text-amber-950 shadow-xl"><div className="text-[9px] font-black uppercase tracking-widest">SAVE</div><div className="text-2xl font-black leading-none">{formatPrice(savings)}</div></div>
                  <div className="absolute bottom-6 right-6 rounded-2xl border border-slate-200 bg-slate-950/92 px-4 py-3 text-white shadow-xl backdrop-blur"><div className="text-[9px] uppercase tracking-wider text-slate-300">Selected pack</div><div className="mt-0.5 text-lg font-black">{selectedQty}× Pack</div></div>
                </div>
              </div>
              <div className="absolute -bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full border border-emerald-100 bg-white px-5 py-2.5 text-xs font-black text-emerald-900 shadow-xl sm:block">{country === 'IN' ? 'Three useful seed varieties in one smart bundle' : 'এক অর্ডারে প্রয়োজনীয় বীজ একসাথে'}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-6 grid gap-4 sm:grid-cols-3">
          {[{ icon: PackageCheck, title: country === 'IN' ? 'Combo contents' : 'প্যাকেজে থাকছে', value: `${items.length} ${country === 'IN' ? 'seed varieties' : 'টি বীজ'}`, tone: 'emerald' }, { icon: Zap, title: country === 'IN' ? 'Smart saving' : 'স্মার্ট সাশ্রয়', value: `${formatPrice(savings)} ${country === 'IN' ? 'saved' : 'সাশ্রয়'}`, tone: 'amber' }, { icon: Truck, title: country === 'IN' ? 'Delivery' : 'ডেলিভারি', value: freeDelivery ? (country === 'IN' ? 'Free delivery' : 'ফ্রি ডেলিভারি') : formatPrice(delivery), tone: 'sky' }].map(({ icon: Icon, title, value, tone }) => (
            <div key={title} className="group rounded-[28px] border border-white bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,.09)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(15,23,42,.12)]"><div className="flex items-center gap-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone === 'emerald' ? 'bg-emerald-100 text-emerald-800' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className={`text-[10px] font-black uppercase tracking-[.16em] ${tone === 'emerald' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-sky-700'}`}>{title}</p><p className="mt-1 text-lg font-black tracking-tight text-slate-900">{value}</p></div></div></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-8">
            <section className="rounded-[34px] border border-emerald-100 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-emerald-700">WHAT'S INSIDE</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{country === 'IN' ? 'What you get' : 'এই প্যাকেজে যা পাবেন'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{country === 'IN' ? 'Every seed in this bundle is selected to complement the pack.' : 'একটি প্যাকের মধ্যে আপনার দরকারি বীজগুলো সুন্দরভাবে সাজানো।'}</p></div><span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">{items.length} items</span></div>
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {items.map((item, index) => {
                  const product = item.products || {};
                  const image = getProductImage(product);
                  const per = Number(item.quantity) || 1;
                  const totalQty = per * Number(selectedQty || 1);
                  return (
                    <article key={item.product_id || index} className="group overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fbf7] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
                      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#ffffff,#eef7f0)]">
                        {image ? <img src={image} alt={product.name_bn || product.name_en || 'Seed'} className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105" loading="lazy" /> : <Leaf className="h-14 w-14 text-emerald-700/25" />}
                        <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black text-emerald-900 shadow-sm">0{index + 1}</span>
                        {index === items.length - 1 && <span className="absolute right-3 top-3 rounded-full bg-emerald-800 px-2.5 py-1 text-[9px] font-black text-white">FEATURED</span>}
                      </div>
                      <div className="p-4">
                        <h3 className="line-clamp-2 text-[15px] font-black leading-6 text-slate-900">{product.name_bn || product.name_en || 'বীজ'}</h3>
                        <p className="mt-1 text-xs text-slate-500">{per} {country === 'IN' ? 'packet in combo' : 'প্যাকেট / কম্বো'}</p>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3"><span className="text-xs font-semibold text-slate-500">{country === 'IN' ? 'In your pack' : 'বর্তমান প্যাকে'}</span><span className="rounded-full bg-emerald-800 px-2.5 py-1 text-[10px] font-black text-white">{totalQty} {country === 'IN' ? 'packs' : 'প্যাকেট'}</span></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-[34px] bg-[#073d2b] p-5 text-white shadow-xl sm:p-8">
              <div className="grid gap-7 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-lime-300">LIMITED-TIME OFFER</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{country === 'IN' ? "Don't miss today's offer" : 'আজকের অফারটি মিস করবেন না'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-emerald-100/75">{country === 'IN' ? 'Choose a pack and the price, savings and delivery update instantly.' : 'যে প্যাকেজটি নেবেন, সেটি সিলেক্ট করলেই দাম, সাশ্রয় ও ডেলিভারি সঙ্গে সঙ্গে আপডেট হবে।'}</p></div><div className="grid grid-cols-3 gap-2">{[['Hours', timer.h], ['Min', timer.m], ['Sec', timer.s]].map(([label, value]) => <div key={label} className="min-w-[70px] rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-center"><div className="text-2xl font-black leading-none sm:text-3xl">{value}</div><div className="mt-1 text-[9px] font-black uppercase tracking-wider text-emerald-100/55">{label}</div></div>)}</div></div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              {[{ icon: BadgeCheck, title: country === 'IN' ? 'Curated combo' : 'বাছাই করা কম্বো', copy: country === 'IN' ? 'Useful seed varieties bundled for convenience.' : 'একসাথে দরকারি বীজ, সহজ ও সুবিধাজনক।' }, { icon: ShieldCheck, title: country === 'IN' ? 'Secure ordering' : 'নিরাপদ অর্ডার', copy: country === 'IN' ? 'Your order details are handled securely.' : 'আপনার অর্ডারের তথ্য নিরাপদে প্রক্রিয়া করা হয়।' }, { icon: Truck, title: country === 'IN' ? 'Doorstep delivery' : 'হোম ডেলিভারি', copy: country === 'IN' ? 'Delivery to serviceable addresses across India.' : 'সার্ভিসেবল ঠিকানায় সারাদেশে ডেলিভারি।' }].map(({ icon: Icon, title, copy }) => <div key={title} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-emerald-700" /><h3 className="mt-4 text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p></div>)}
            </section>
          </div>

          <aside id="deal" className="lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-[34px] border border-emerald-100 bg-white shadow-[0_24px_65px_rgba(15,23,42,.12)]">
              <div className="bg-[#086447] px-5 py-6 text-white sm:px-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-100">CHOOSE YOUR DEAL</p><h2 className="mt-2 text-2xl font-black">{country === 'IN' ? 'Pick your pack' : 'প্যাকেজ বেছে নিন'}</h2></div><span className="rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black text-amber-950">BEST VALUE</span></div></div>
              <div className="space-y-3 p-4 sm:p-5">
                {tiers.map((tier: any) => {
                  const qty = getQty(tier);
                  const tierOffer = Number(tier?.offer) || offer;
                  const tierRegular = Number(tier?.regular) || tierOffer;
                  const tierSavings = Math.max(0, tierRegular - tierOffer);
                  const tierFree = getFree(tier) || (country === 'IN' ? tierOffer >= 999 : tierOffer >= 600);
                  const selected = qty === selectedQty;
                  return (
                    <button key={qty} type="button" onClick={() => setSelectedQty(qty)} className={`group w-full rounded-[26px] border-2 p-4 text-left transition-all ${selected ? 'border-emerald-600 bg-emerald-50 shadow-[0_14px_35px_rgba(5,150,105,.14)]' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'}`}>
                      <div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${selected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{qty}×</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{qty} {country === 'IN' ? 'Pack' : 'প্যাকেট'}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatPrice(tierRegular)} regular</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${selected ? 'bg-amber-300 text-amber-950' : 'bg-slate-100 text-slate-600'}`}>{qty === 1 ? 'BEST' : qty >= 3 ? 'MEGA DEAL' : 'SAVE MORE'}</span></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">OFFER PRICE</p><p className="mt-0.5 text-3xl font-black tracking-tight text-emerald-800">{formatPrice(tierOffer)}</p></div><div className="text-right"><p className="text-[10px] font-bold text-emerald-700">Save {formatPrice(tierSavings)}</p><p className="mt-1 text-[9px] font-black uppercase text-slate-400">{tierFree ? 'FREE DELIVERY' : 'DELIVERY APPLIES'}</p></div></div>{selected && <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-700"><Check className="h-3.5 w-3.5" /> {country === 'IN' ? 'This pack is selected' : 'এই প্যাকেজটি নির্বাচিত'}</div>}</div></div>
                    </button>
                  );
                })}

                <div className="rounded-[26px] bg-slate-950 p-5 text-white shadow-xl"><div className="flex justify-between text-sm"><span className="text-slate-400">{country === 'IN' ? 'Pack price' : 'প্যাকেজ মূল্য'}</span><span className="font-bold">{formatPrice(offer)}</span></div><div className="mt-2 flex justify-between text-sm"><span className="text-slate-400">{country === 'IN' ? 'Delivery' : 'ডেলিভারি'}</span><span className="font-bold text-lime-300">{freeDelivery ? (country === 'IN' ? 'FREE' : 'ফ্রি') : formatPrice(delivery)}</span></div><div className="my-4 border-t border-white/10"/><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">TOTAL</p><p className="mt-1 text-3xl font-black text-white">{formatPrice(total)}</p></div><span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-[10px] font-black text-emerald-300">Save {formatPrice(savings)}</span></div></div>

                <a href="#quick-checkout" className="flex min-h-14 items-center justify-center gap-2 rounded-[20px] bg-emerald-700 px-5 text-sm font-black text-white shadow-xl shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800">{country === 'IN' ? 'Order this pack' : 'এখনই অর্ডার করুন'}<ArrowRight className="h-4 w-4" /></a>
              </div>

              <div id="quick-checkout" className="border-t border-slate-200 bg-white p-5 sm:p-6">
                <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">QUICK CHECKOUT</p><h3 className="mt-2 text-2xl font-black">{country === 'IN' ? 'Complete your order' : 'অর্ডারটি কনফার্ম করুন'}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{country === 'IN' ? 'Just your name, phone and delivery address.' : 'শুধু নাম, ফোন ও ঠিকানা দিলেই হবে।'}</p></div>
                <form onSubmit={submitOrder} className="space-y-4">
                  <div className="space-y-1.5"><label htmlFor="combo-name" className="flex items-center gap-1.5 text-xs font-black text-slate-700"><User className="h-3.5 w-3.5 text-emerald-700" />{country === 'IN' ? 'Full name' : 'পুরো নাম'} <span className="text-rose-500">*</span></label><input id="combo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={country === 'IN' ? 'Your full name' : 'যেমন: মো: আরিফুল ইসলাম'} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" required /></div>
                  <div className="space-y-1.5"><label htmlFor="combo-phone" className="flex items-center gap-1.5 text-xs font-black text-slate-700"><Phone className="h-3.5 w-3.5 text-emerald-700" />{country === 'IN' ? 'Mobile number' : 'মোবাইল নম্বর'} <span className="text-rose-500">*</span></label><input id="combo-phone" type="tel" inputMode="tel" maxLength={country === 'IN' ? 10 : 11} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={country === 'IN' ? '10-digit mobile number' : '01XXXXXXXXX'} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" required /></div>
                  <div className="space-y-1.5"><label htmlFor="combo-address" className="flex items-center gap-1.5 text-xs font-black text-slate-700"><MapPin className="h-3.5 w-3.5 text-emerald-700" />{country === 'IN' ? 'Delivery address' : 'সম্পূর্ণ ঠিকানা'} <span className="text-rose-500">*</span></label><textarea id="combo-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={country === 'IN' ? 'House / road / area / city / PIN' : 'গ্রাম/মহল্লা, থানা, জেলা, বিস্তারিত ঠিকানা'} className="min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" required /></div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600"><span className="inline-flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-emerald-700" />{selectedQty}× {country === 'IN' ? 'Pack' : 'প্যাকেট'}</span><span className="font-black text-emerald-800">{formatPrice(total)}</span></div><div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">{country === 'IN' ? 'Delivery' : 'ডেলিভারি'}</span><span className="font-black text-emerald-700">{freeDelivery ? (country === 'IN' ? 'FREE' : 'ফ্রি') : formatPrice(delivery)}</span></div></div>
                  <button disabled={submitting} type="submit" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-amber-400 px-5 text-sm font-black text-amber-950 shadow-xl shadow-amber-900/10 transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"><ShieldCheck className="h-5 w-5" />{submitting ? (country === 'IN' ? 'Placing order…' : 'অর্ডার নেওয়া হচ্ছে…') : `${country === 'IN' ? 'Confirm order' : 'অর্ডার কনফার্ম করুন'} ${formatPrice(total)}`}</button>
                  <div className="flex items-center justify-center gap-3 pt-1 text-[10px] font-bold text-slate-500"><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />Secure</span><span className="h-1 w-1 rounded-full bg-slate-300"/><span className="inline-flex items-center gap-1"><WalletCards className="h-3.5 w-3.5 text-emerald-700"/>COD</span><span className="h-1 w-1 rounded-full bg-slate-300"/><span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-emerald-700"/>{country === 'IN' ? 'India' : 'Bangladesh'}</span></div>
                </form>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <div className="fixed inset-x-3 bottom-3 z-40 lg:hidden"><div className="flex items-center gap-3 rounded-[22px] border border-slate-200/90 bg-white/95 p-3 shadow-[0_20px_55px_rgba(15,23,42,.22)] backdrop-blur-xl" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}><div className="min-w-0 flex-1 pl-1"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{country === 'IN' ? 'Selected pack' : 'নির্বাচিত প্যাক'}</p><p className="truncate text-lg font-black text-emerald-800">{formatPrice(total)}</p></div><a href="#quick-checkout" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-5 text-xs font-black text-white shadow-lg shadow-emerald-900/15 active:scale-[.98]">{country === 'IN' ? 'Order now' : 'অর্ডার করুন'} <ArrowRight className="h-4 w-4" /></a></div></div>
    </main>
  );
}
