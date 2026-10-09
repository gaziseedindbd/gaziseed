'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/components/site/language-provider';
import { supabase, getVisitorCountry } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { comboCopy, localizedField } from '@/lib/combo-localization';
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
import { IndiaPaymentMethodSelector, type IndiaPaymentMethod } from '@/components/site/india-payment-method-selector';
import { startIndiaCampaignPayment } from '@/lib/india-campaign-payment';

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
  const [paymentMethod, setPaymentMethod] = useState<IndiaPaymentMethod>('online');
  const [indiaDeliveryQuote, setIndiaDeliveryQuote] = useState<number | null>(null);
  const [indiaDeliveryQuoteLoading, setIndiaDeliveryQuoteLoading] = useState(false);
  const { lang, t } = useLang();

  useEffect(() => {
    setCountry(getVisitorCountry());
    const onCountryChange = () => setCountry(getVisitorCountry());
    window.addEventListener('gazi-country-changed', onCountryChange);
    return () => window.removeEventListener('gazi-country-changed', onCountryChange);
  }, []);


  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('combo_packs')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .eq('country_code', getVisitorCountry())
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

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
  const currentTier = useMemo(
    () => tiers.find((tier: any) => getQty(tier) === Number(selectedQty)) || tiers[0] || {},
    [tiers, selectedQty],
  );

  const offer = Number(currentTier?.offer) || Number(combo?.combo_price) || 0;
  const regular = Number(currentTier?.regular) || Number(combo?.regular_total) || 0;
  const savings = Math.max(0, regular - offer);
  // India quotes use the same explicit free-delivery flag as the database.
  const currentTierFreeValue = currentTier?.freeDelivery ?? currentTier?.free_delivery;
  const freeDelivery = typeof currentTierFreeValue === 'boolean'
    ? currentTierFreeValue
    : combo?.free_delivery === true || (country === 'BD' && offer >= 600);
  const fallbackDelivery = freeDelivery ? 0 : country === 'IN' ? (offer >= 499 ? 60 : 90) : offer >= 400 ? 50 : offer >= 200 ? 70 : 120;
  const delivery = country === 'IN' && indiaDeliveryQuote !== null ? indiaDeliveryQuote : fallbackDelivery;
  const total = offer + delivery;
  const codAdvance = delivery > 0 ? delivery : 120;
  const codDue = Math.max(0, total - codAdvance);

  useEffect(() => {
    let active = true;
    const loadQuote = async () => {
      if (country !== 'IN' || offer <= 0) {
        setIndiaDeliveryQuote(null);
        setIndiaDeliveryQuoteLoading(false);
        return;
      }
      if (freeDelivery) {
        setIndiaDeliveryQuote(0);
        setIndiaDeliveryQuoteLoading(false);
        return;
      }
      setIndiaDeliveryQuoteLoading(true);
      const { data, error } = await supabase.rpc('calculate_delivery_charge', {
        p_order_value: offer,
        p_free_delivery: false,
      });
      if (!active) return;
      const charge = Number(data);
      if (error || data === null || !Number.isFinite(charge) || charge < 0) {
        setIndiaDeliveryQuote(null);
        toast('Delivery charge could not be verified. Please try again.', 'error');
      } else setIndiaDeliveryQuote(charge);
      setIndiaDeliveryQuoteLoading(false);
    };
    void loadQuote();
    return () => { active = false; };
  }, [country, offer, freeDelivery]);
  const heroImages = useMemo(() => (combo ? getComboHeroImages(combo, items) : []), [combo, items]);

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
      if (country === 'IN') {
        if (indiaDeliveryQuoteLoading || indiaDeliveryQuote === null) throw new Error('Delivery charge is still being verified');
        if (paymentMethod === 'cod' && codAdvance > total) throw new Error('COD advance is higher than the payable total. Choose online payment.');
        await startIndiaCampaignPayment({
          flow: 'combo',
          context: { combo_id: combo?.id, quantity: selectedQty },
          method: paymentMethod,
          customerName: name.trim(),
          customerPhone: cleanPhone,
          deliveryAddress: address.trim(),
        });
        return;
      }
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
      toast('আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!');
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

  const translatedCombo = (combo as any)?.translations?.[lang] || {};
  const comboTitle = localizedField(combo, lang, 'title');
  const comboDescription = localizedField(combo, lang, 'description');
  // Locale follows the customer's language choice, independently of the branch.
  const copy = (en: string, bn: string, hi: string) => comboCopy(lang, en, bn, hi);


  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8f4] pb-28 text-slate-900">
      <style jsx global>{`
        @media (max-width: 1023px) {
          /* Leave room for the site-wide mobile navigation below the order CTA. */
          .combo-detail-showcase { scroll-margin-top: 6rem; }
          #quick-checkout, #deal { scroll-margin-top: 7rem; }
        }
        /* The combo checkout sidebar is narrow even on large desktop viewports. */
        .combo-payment-selector fieldset > div { grid-template-columns: minmax(0, 1fr) !important; }
        .combo-payment-selector fieldset button { min-width: 0; overflow-wrap: anywhere; }
        /* Keep floating global utility widgets off this focused campaign checkout. */
        body:has(main .combo-detail-showcase) button[aria-label="Change Website Theme"],
        body:has(main .combo-detail-showcase) button[title="Change Website Theme"],
        body:has(main .combo-detail-showcase) button[aria-label="এই পণ্য শেয়ার করুন"],
        body:has(main .combo-detail-showcase) button[aria-label="Share this product"],
        body:has(main .combo-detail-showcase) button[title="Share this product"],
        body:has(main .combo-detail-showcase) button[aria-label="इस उत्पाद को शेयर करें"] {
          display: none !important;
        }
      `}</style>
      <section className="combo-detail-showcase relative overflow-hidden bg-[#063d2c] text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-lime-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-[32rem] w-[32rem] rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-20 lg:pt-14">
          <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_.98fr] lg:gap-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.18em] text-emerald-100">
                <Sparkles className="h-4 w-4 text-lime-300" /> GAZI SEED • SMART COMBO
              </div>
              <h1 className="mt-5 max-w-3xl text-[clamp(2rem,5vw,3.8rem)] font-black leading-[1.14] tracking-tight sm:text-[3.2rem] lg:text-[3.8rem]">{comboTitle}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/85 sm:text-base">
                {comboDescription || (country === 'IN' ? 'Everything you need to start a beautiful home garden, bundled at a smarter price.' : 'প্রয়োজনীয় বীজ একসাথে নিন, স্মার্ট দামে বাগান শুরু করুন।')}
              </p>

              <div className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"><Leaf className="h-4 w-4 text-lime-300" /><p className="mt-2 text-lg font-black">{items.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/65">{copy('Varieties', 'বীজের ধরন', 'बीज की किस्में')}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"><Gift className="h-4 w-4 text-lime-300" /><p className="mt-2 text-lg font-black">{selectedQty}×</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/65">{copy('Pack', 'প্যাক', 'पैक')}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"><Zap className="h-4 w-4 text-amber-300" /><p className="mt-2 text-lg font-black">{formatPrice(savings)}</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/65">{copy('You save', 'সাশ্রয়', 'आपकी बचत')}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm"><Truck className="h-4 w-4 text-sky-300" /><p className="mt-2 text-lg font-black">{freeDelivery ? 'FREE' : formatPrice(delivery)}</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/65">{copy('Delivery', 'ডেলিভারি', 'डिलीवरी')}</p></div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#deal" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-lime-300 px-6 text-sm font-black text-emerald-950 shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:bg-lime-200">{copy('Choose your deal', 'আপনার প্যাক বেছে নিন', 'अपना पैक चुनें')}<ArrowRight className="h-4 w-4" /></a>
                <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-xs font-bold text-emerald-50/80"><ShieldCheck className="h-4 w-4 text-lime-300" />{copy('Secure order • COD available', 'নিরাপদ অর্ডার • ক্যাশ অন ডেলিভারি', 'सुरक्षित ऑर्डर • कैश ऑन डिलीवरी')}</div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[610px]">
              <div className="absolute -left-8 top-8 h-28 w-28 rounded-full bg-lime-200/20 blur-3xl" />
              <div className="absolute -right-8 bottom-10 h-36 w-36 rounded-full bg-emerald-200/20 blur-3xl" />
              <div className="relative rounded-[44px] border border-white/20 bg-white/[0.06] p-2.5 shadow-[0_30px_90px_rgba(0,0,0,.28)] backdrop-blur-sm">
                <div className="relative min-h-[360px] overflow-hidden rounded-[36px] border border-white/75 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,1),rgba(246,250,247,.98)_50%,rgba(224,237,228,.98))] px-4 py-6 sm:min-h-[470px] sm:px-8 sm:py-8">
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/70 blur-2xl sm:h-72 sm:w-72" />
                  <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full border border-emerald-900/10 bg-emerald-100/40" />
                  <div className="pointer-events-none absolute -bottom-16 left-8 h-36 w-36 rounded-full bg-lime-100/70 blur-xl" />

                  {heroImages.length > 0 ? (
                    <div className="relative flex min-h-[300px] items-center justify-center sm:min-h-[405px]">
                      {heroImages.slice(0, 3).map((image, index) => {
                        const positions = [
                          'left-[3%] top-[20%] -rotate-3 sm:left-[3%] sm:top-[19%]',
                          'left-1/2 top-[11%] -translate-x-1/2 sm:top-[10%]',
                          'right-[3%] top-[20%] rotate-3 sm:right-[3%] sm:top-[19%]',
                        ];
                        const sizes = [
                          'w-[36%] sm:w-[32%]',
                          'w-[37%] sm:w-[34%]',
                          'w-[36%] sm:w-[32%]',
                        ];
                        return (
                          <div key={`${image}-${index}`} className={`absolute ${positions[index] || positions[2]} ${sizes[index] || sizes[2]} z-10 ${index === 1 ? 'z-20' : ''}`}>
                            <div className={`relative overflow-hidden rounded-[24px] border border-white/90 bg-white/95 p-2 shadow-[0_22px_40px_rgba(15,23,42,.16)] sm:rounded-[30px] sm:p-2.5 ${index === 1 ? 'shadow-[0_28px_55px_rgba(15,23,42,.2)]' : ''}`}>
                              <div className="absolute left-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[9px] font-black text-emerald-900 shadow-sm sm:h-8 sm:w-8 sm:text-[10px]">0{index + 1}</div>
                              <img src={image} alt={`${combo.title_bn} product ${index + 1}`} className={`aspect-[4/5] w-full object-contain ${index === 1 ? 'p-1.5 sm:p-2' : 'p-2 sm:p-3'}`} loading={index === 0 ? 'eager' : 'lazy'} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="absolute bottom-[6%] left-1/2 z-30 hidden -translate-x-1/2 rounded-full border border-white/90 bg-white/90 px-4 py-2 text-[10px] font-black text-emerald-900 shadow-lg backdrop-blur sm:bottom-[5%] sm:px-5 sm:py-2.5 sm:text-xs">
                        {country === 'IN' ? '3 curated seed varieties' : '৩টি বাছাই করা বীজ একসাথে'}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[300px] items-center justify-center sm:min-h-[405px]"><div className="max-w-xs text-center"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] bg-emerald-100 text-emerald-700 shadow-inner"><Leaf className="h-11 w-11" /></div><p className="mt-5 text-sm font-black text-slate-800">{country === 'IN' ? 'Add product images to build the combo showcase.' : 'পণ্যের ছবি যোগ করলেই এখানে কম্বো শোকেস তৈরি হবে।'}</p></div></div>
                  )}
                  <div className="absolute left-5 top-5 z-40 rounded-[20px] bg-amber-400 px-4 py-2.5 text-center text-amber-950 shadow-[0_14px_28px_rgba(0,0,0,.14)] sm:left-7 sm:top-7 sm:px-5 sm:py-3"><div className="text-[8px] font-black uppercase tracking-[.18em]">SAVE</div><div className="mt-0.5 text-2xl font-black leading-none sm:text-[1.7rem]">{formatPrice(savings)}</div></div>
                  
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-6 grid gap-4 sm:grid-cols-3">
          {[{ icon: PackageCheck, title: copy('Combo contents','প্যাকেজে থাকছে','कॉम्बो में शामिल'), value: `${items.length} ${copy('seed varieties','টি বীজ','बीज किस्में')}`, tone: 'emerald' }, { icon: Zap, title: copy('Smart saving','স্মার্ট সাশ্রয়','अच्छी बचत'), value: `${formatPrice(savings)} ${copy('saved','সাশ্রয়','बचत')}`, tone: 'amber' }, { icon: Truck, title: copy('Delivery','ডেলিভারি','डिलीवरी'), value: freeDelivery ? (copy('Free delivery','ফ্রি ডেলিভারি','मुफ़्त डिलीवरी')) : formatPrice(delivery), tone: 'sky' }].map(({ icon: Icon, title, value, tone }) => (
            <div key={title} className="group rounded-[28px] border border-white bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,.09)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(15,23,42,.12)]"><div className="flex items-center gap-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone === 'emerald' ? 'bg-emerald-100 text-emerald-800' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className={`text-[10px] font-black uppercase tracking-[.16em] ${tone === 'emerald' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-sky-700'}`}>{title}</p><p className="mt-1 text-lg font-black tracking-tight text-slate-900">{value}</p></div></div></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-8">
            <section className="rounded-[34px] border border-emerald-100 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-emerald-700">{copy("WHAT'S INSIDE", 'প্যাকেজে যা আছে', 'पैक में शामिल')}</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{copy('What you get', 'এই প্যাকেজে যা পাবেন', 'इस पैक में क्या मिलेगा')}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{country === 'IN' ? 'Every seed in this bundle is selected to complement the pack.' : 'একটি প্যাকের মধ্যে আপনার দরকারি বীজগুলো সুন্দরভাবে সাজানো।'}</p></div><span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">{items.length} items</span></div>
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {items.map((item, index) => {
                  const product = item.products || {};
                  const image = getProductImage(product);
                  const per = Number(item.quantity) || 1;
                  const totalQty = per * Number(selectedQty || 1);
                  return (
                    <article key={item.product_id || index} className="group overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fbf7] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
                      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#ffffff,#eef7f0)]">
                        {image ? <img src={image} alt={localizedField(product, lang, 'name', copy('Seed', 'বীজ', 'बीज'))} className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105" loading="lazy" /> : <Leaf className="h-14 w-14 text-emerald-700/25" />}
                        <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black text-emerald-900 shadow-sm">0{index + 1}</span>
                        {index === items.length - 1 && <span className="absolute right-3 top-3 rounded-full bg-emerald-800 px-2.5 py-1 text-[9px] font-black text-white">FEATURED</span>}
                      </div>
                      <div className="p-4">
                        <h3 className="line-clamp-2 text-[15px] font-black leading-6 text-slate-900">{product.name_bn || product.name_en || 'বীজ'}</h3>
                        <p className="mt-1 text-xs text-slate-500">{per} {copy('packet in combo','প্যাকেট / কম্বো','कॉम्बो में पैकेट')}</p>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3"><span className="text-xs font-semibold text-slate-500">{copy('In your pack','আপনার প্যাকে','आपके पैक में')}</span><span className="rounded-full bg-emerald-800 px-2.5 py-1 text-[10px] font-black text-white">{totalQty} {copy('packs','প্যাকেট','पैकेट')}</span></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-[34px] bg-[#073d2b] p-5 text-white shadow-xl sm:p-8"><p className="text-[11px] font-black uppercase tracking-[.2em] text-lime-300">{copy('COMBO OFFER', 'কম্বো অফার', 'कॉम्बो ऑफर')}</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{copy('Choose the right bundle for your garden', 'আপনার বাগানের জন্য উপযুক্ত কম্বো বেছে নিন', 'अपने बगीचे के लिए सही कॉम्बो चुनें')}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-emerald-100/75">{copy('Choose a package to review its current price and delivery charge before ordering.', 'অর্ডারের আগে প্যাকেজ বেছে নিয়ে বর্তমান দাম ও ডেলিভারি চার্জ দেখুন।', 'ऑर्डर से पहले पैक चुनकर कीमत और डिलीवरी शुल्क देखें।')}</p></section>

            <section className="grid gap-4 sm:grid-cols-3">
              {[{ icon: BadgeCheck, title: copy('Curated combo','বাছাই করা কম্বো','चुना हुआ कॉम्बो'), copy: copy('Useful seed varieties bundled for convenience.','একসাথে দরকারি বীজ, সহজ ও সুবিধাজনক।','सुविधा के लिए उपयोगी बीज एक साथ।') }, { icon: ShieldCheck, title: copy('Secure ordering','নিরাপদ অর্ডার','सुरक्षित ऑर्डर'), copy: copy('Your order details are handled securely.','আপনার অর্ডারের তথ্য নিরাপদে প্রক্রিয়া করা হয়।','आपके ऑर्डर की जानकारी सुरक्षित रूप से संसाधित होती है।') }, { icon: Truck, title: copy('Doorstep delivery','হোম ডেলিভারি','घर तक डिलीवरी'), copy: country === 'IN' ? copy('Delivery to serviceable addresses across India.','ভারতের সার্ভিসযোগ্য ঠিকানায় ডেলিভারি।','भारत में सेवा योग्य पतों पर डिलीवरी।') : copy('Delivery to serviceable addresses in Bangladesh.','বাংলাদেশের সার্ভিসযোগ্য ঠিকানায় ডেলিভারি।','बांग्लादेश में सेवा योग्य पतों पर डिलीवरी।') }].map(({ icon: Icon, title, copy }) => <div key={title} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-emerald-700" /><h3 className="mt-4 text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p></div>)}
            </section>
          </div>

          <aside id="deal" className="lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-[34px] border border-emerald-100 bg-white shadow-[0_24px_65px_rgba(15,23,42,.12)]">
              <div className="bg-[#086447] px-5 py-6 text-white sm:px-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-100">{copy('CHOOSE YOUR DEAL', 'অফার বেছে নিন', 'ऑफ़र चुनें')}</p><h2 className="mt-2 text-2xl font-black">{copy('Pick your pack', 'প্যাকেজ বেছে নিন', 'अपना पैक चुनें')}</h2></div><span className="rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black text-amber-950">{copy('BEST VALUE','সেরা মূল্য','बेहतरीन मूल्य')}</span></div></div>
              <div className="space-y-3 p-4 sm:p-5">
                {tiers.map((tier: any) => {
                  const qty = getQty(tier);
                  const tierOffer = Number(tier?.offer) || offer;
                  const tierRegular = Number(tier?.regular) || tierOffer;
                  const tierSavings = Math.max(0, tierRegular - tierOffer);
                  const tierFreeValue = tier?.freeDelivery ?? tier?.free_delivery;
                  const tierFree = typeof tierFreeValue === 'boolean'
                    ? tierFreeValue
                    : combo?.free_delivery === true || (country === 'BD' && tierOffer >= 600);
                  const selected = qty === selectedQty;
                  return (
                    <button key={qty} type="button" onClick={() => setSelectedQty(qty)} className={`group w-full rounded-[26px] border-2 p-4 text-left transition-all ${selected ? 'border-emerald-600 bg-emerald-50 shadow-[0_14px_35px_rgba(5,150,105,.14)]' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'}`}>
                      <div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${selected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{qty}×</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{qty} {copy('Pack','প্যাকেট','पैक')}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatPrice(tierRegular)} {copy('regular','নিয়মিত','नियमित')}</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${selected ? 'bg-amber-300 text-amber-950' : 'bg-slate-100 text-slate-600'}`}>{qty === 1 ? copy('BEST','সেরা','सबसे अच्छा') : qty >= 3 ? copy('MEGA DEAL','মেগা অফার','मेगा डील') : copy('SAVE MORE','আরও সাশ্রয়','अधिक बचत')}</span></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{copy('OFFER PRICE', 'অফার মূল্য', 'ऑफ़र मूल्य')}</p><p className="mt-0.5 text-3xl font-black tracking-tight text-emerald-800">{formatPrice(tierOffer)}</p></div><div className="text-right"><p className="text-[10px] font-bold text-emerald-700">{copy('Save','সাশ্রয়','बचत')} {formatPrice(tierSavings)}</p><p className="mt-1 text-[9px] font-black uppercase text-slate-400">{tierFree ? copy('FREE DELIVERY', 'ফ্রি ডেলিভারি', 'मुफ़्त डिलीवरी') : copy('DELIVERY APPLIES', 'ডেলিভারি চার্জ প্রযোজ্য', 'डिलीवरी शुल्क लागू')}</p></div></div>{selected && <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-700"><Check className="h-3.5 w-3.5" /> {copy('This pack is selected', 'এই প্যাকটি নির্বাচিত', 'यह पैक चुना गया है')}</div>}</div></div>
                    </button>
                  );
                })}

                <div className="rounded-[26px] bg-slate-950 p-5 text-white shadow-xl" aria-label={copy('Order price breakdown', 'অর্ডারের মূল্য বিবরণ', 'ऑर्डर मूल्य विवरण')}><div className="flex justify-between gap-3 text-sm"><span className="text-slate-300">{copy('Combo offer price', 'কম্বো অফার মূল্য', 'कॉम्बो ऑफर की कीमत')}</span><span className="font-bold">{formatPrice(offer)}</span></div><div className="mt-3 flex justify-between gap-3 text-sm"><span className="text-slate-300">{copy('Delivery charge', 'ডেলিভারি চার্জ', 'डिलीवरी शुल्क')}</span><span className="font-bold text-lime-300">{freeDelivery ? copy('FREE', 'ফ্রি', 'मुफ़्त') : country === 'IN' && (indiaDeliveryQuoteLoading || indiaDeliveryQuote === null) ? '—' : formatPrice(delivery)}</span></div>{country === 'IN' && indiaDeliveryQuoteLoading && <p role="status" className="mt-2 text-xs text-amber-200">{copy('Verifying delivery charge…', 'ডেলিভারি চার্জ যাচাই হচ্ছে…', 'डिलीवरी शुल्क की पुष्टि हो रही है…')}</p>}{country === 'IN' && !indiaDeliveryQuoteLoading && indiaDeliveryQuote === null && <p role="alert" className="mt-2 text-xs text-amber-200">{copy('Delivery charge could not be verified.', 'ডেলিভারি চার্জ নিশ্চিত হয়নি।', 'डिलीवरी शुल्क की पुष्टि नहीं हुई।')}</p>}<div className="my-4 border-t border-white/20"/><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-300">{copy('Total payable', 'মোট পরিশোধযোগ্য', 'कुल देय राशि')}</p><p className="mt-1 text-3xl font-black text-white">{country === 'IN' && (indiaDeliveryQuoteLoading || indiaDeliveryQuote === null) ? '—' : formatPrice(total)}</p></div><span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-[10px] font-black text-emerald-300">{copy('Save', 'সাশ্রয়', 'बचत')} {formatPrice(savings)}</span></div><p className="mt-3 text-[11px] text-slate-300">{copy('Delivery is added separately to the combo price.', 'কম্বো মূল্যের সঙ্গে ডেলিভারি আলাদাভাবে যোগ হয়।', 'डिलीवरी शुल्क कॉम्बो कीमत में अलग से जोड़ा जाता है।')}</p></div>

                <a href="#quick-checkout" className="flex min-h-14 items-center justify-center gap-2 rounded-[20px] bg-emerald-700 px-5 text-sm font-black text-white shadow-xl shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800">{copy('Order this pack', 'এই প্যাকেজ অর্ডার করুন', 'इस पैक का ऑर्डर करें')}<ArrowRight className="h-4 w-4" /></a>
              </div>

              <div id="quick-checkout" className="border-t border-slate-200 bg-white p-5 sm:p-6">
                <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">{copy('QUICK CHECKOUT', 'দ্রুত অর্ডার', 'त्वरित चेकआउट')}</p><h3 className="mt-2 text-2xl font-black">{copy('Complete your order', 'আপনার অর্ডার সম্পন্ন করুন', 'अपना ऑर्डर पूरा करें')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{copy('Just your name, phone and delivery address.','শুধু নাম, ফোন ও ঠিকানা দিলেই হবে।','केवल नाम, फोन और डिलीवरी पता भरें।')}</p></div>
                <form onSubmit={submitOrder} className="space-y-4">
                  <div className="space-y-1.5"><label htmlFor="combo-name" className="flex items-center gap-1.5 text-xs font-black text-slate-700"><User className="h-3.5 w-3.5 text-emerald-700" />{copy('Full name', 'পুরো নাম', 'पूरा नाम')} <span className="text-rose-500">*</span></label><input id="combo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={copy('Your full name','আপনার পুরো নাম','आपका पूरा नाम')} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" required /></div>
                  <div className="space-y-1.5"><label htmlFor="combo-phone" className="flex items-center gap-1.5 text-xs font-black text-slate-700"><Phone className="h-3.5 w-3.5 text-emerald-700" />{copy('Mobile number', 'মোবাইল নম্বর', 'मोबाइल नंबर')} <span className="text-rose-500">*</span></label><input id="combo-phone" type="tel" inputMode="tel" maxLength={country === 'IN' ? 10 : 11} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={country === 'IN' ? copy('10-digit mobile number','১০ সংখ্যার মোবাইল নম্বর','10 अंकों का मोबाइल नंबर') : copy('11-digit mobile number','১১ সংখ্যার মোবাইল নম্বর','11 अंकों का मोबाइल नंबर')} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" required /></div>
                  <div className="space-y-1.5"><label htmlFor="combo-address" className="flex items-center gap-1.5 text-xs font-black text-slate-700"><MapPin className="h-3.5 w-3.5 text-emerald-700" />{copy('Delivery address', 'ডেলিভারির ঠিকানা', 'डिलीवरी का पता')} <span className="text-rose-500">*</span></label><textarea id="combo-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={copy('House / road / area / city / PIN','বাড়ি / রাস্তা / এলাকা / শহর / পিন','घर / सड़क / क्षेत्र / शहर / पिन')} className="min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" required /></div>
                  {country === 'IN' && <div className="combo-payment-selector"><IndiaPaymentMethodSelector
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    advanceAmount={codAdvance}
                    dueAmount={codDue}
                    codAvailable={!indiaDeliveryQuoteLoading && indiaDeliveryQuote !== null && codAdvance <= total}
                    language={lang === 'hi' ? 'hi' : lang === 'en' ? 'en' : 'bn'}
                  /></div>}
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600"><span className="inline-flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-emerald-700" />{selectedQty}× {copy('Pack','প্যাকেট','पैक')}</span><span className="font-black text-emerald-800">{formatPrice(total)}</span></div><div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">{copy('Delivery', 'ডেলিভারি', 'डिलीवरी')}</span><span className="font-black text-emerald-700">{freeDelivery ? (country === 'IN' ? 'FREE' : 'ফ্রি') : formatPrice(delivery)}</span></div>{country === 'IN' && paymentMethod === 'cod' && <div className="mt-2 flex items-center justify-between gap-3 border-t border-emerald-200 pt-2 text-xs"><span className="font-bold text-slate-600">{copy('Advance now · due on delivery','এখন অগ্রিম · ডেলিভারিতে বাকি','अभी अग्रिम · डिलीवरी पर शेष')}</span><span className="font-black text-emerald-800">{formatPrice(codAdvance)} · {formatPrice(codDue)}</span></div>}</div>
                  <button disabled={submitting || (country === 'IN' && (indiaDeliveryQuoteLoading || indiaDeliveryQuote === null || (paymentMethod === 'cod' && codAdvance > total)))} type="submit" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-amber-400 px-5 text-sm font-black text-amber-950 shadow-xl shadow-amber-900/10 transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"><ShieldCheck className="h-5 w-5" />{submitting ? (copy('Starting secure checkout…','নিরাপদ পেমেন্ট শুরু হচ্ছে…','सुरक्षित भुगतान शुरू हो रहा है…')) : country === 'IN' ? (paymentMethod === 'cod' ? `${copy('Pay advance','অগ্রিম পরিশোধ করুন','अग्रिम भुगतान करें')} ${formatPrice(codAdvance)}` : `${copy('Pay online','অনলাইনে পরিশোধ করুন','ऑनलाइन भुगतान करें')} ${formatPrice(total)}`) : `${copy('Confirm order','অর্ডার নিশ্চিত করুন','ऑर्डर की पुष्टि करें')} ${formatPrice(total)}`}</button>
                  <div className="flex items-center justify-center gap-3 pt-1 text-[10px] font-bold text-slate-500"><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />Secure</span><span className="h-1 w-1 rounded-full bg-slate-300"/><span className="inline-flex items-center gap-1"><WalletCards className="h-3.5 w-3.5 text-emerald-700"/>COD</span><span className="h-1 w-1 rounded-full bg-slate-300"/><span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-emerald-700"/>{country === 'IN' ? 'India' : 'Bangladesh'}</span></div>
                </form>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <div className="fixed inset-x-3 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-40 lg:hidden"><div className="flex items-center gap-3 rounded-[22px] border border-slate-200/90 bg-white/95 p-3 shadow-[0_20px_55px_rgba(15,23,42,.22)] backdrop-blur-xl" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}><div className="min-w-0 flex-1 pl-1"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{copy('Selected pack', 'নির্বাচিত প্যাক', 'चुना हुआ पैक')}</p><p className="truncate text-lg font-black text-emerald-800">{formatPrice(total)}</p></div><a href="#quick-checkout" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-5 text-xs font-black text-white shadow-lg shadow-emerald-900/15 active:scale-[.98]">{copy('Order now', 'অর্ডার করুন', 'अभी ऑर्डर करें')} <ArrowRight className="h-4 w-4" /></a></div></div>
    </main>
  );
}
