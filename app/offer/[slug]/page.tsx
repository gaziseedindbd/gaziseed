'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductBySlug, getLandingPageBySlug, getBundleOffers, formatPrice, trackLandingPageView } from '@/lib/data';
import { supabase } from '@/lib/supabase/client';
import { Check, Truck, ShieldCheck, Star, ChevronDown, ChevronLeft, ChevronRight, Loader2, Zap, Package, Sparkles, Clock, ArrowDownCircle, CheckCircle2, Shield, HeartHandshake } from 'lucide-react';
import { AddressSelector, formatAddressToString, type AddressValue } from '@/components/site/address-selector';
import { PromotionalPopup } from '@/components/site/promotional-popup';

interface FaqItem {
  question?: string;
  answer?: string;
  q?: string;
  a?: string;
}

export default function OfferLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = (params?.slug as string) || '';

  const [product, setProduct] = useState<any | null>(null);
  const [landing, setLanding] = useState<any | null>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tiers ও প্যাকেজ স্টেট
  const [selectedTier, setSelectedTier] = useState<any | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<any | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', instructions: '' });
  const [addrValue, setAddrValue] = useState<AddressValue>({ division: '', district: '', thana: '', detail: '', postalCode: '' });

  const isPreview = searchParams.get('preview') === '1';

  const utm = useMemo(() => ({
    source: searchParams.get('utm_source') || '',
    medium: searchParams.get('utm_medium') || '',
    campaign: searchParams.get('utm_campaign') || '',
    content: searchParams.get('utm_content') || '',
    term: searchParams.get('utm_term') || '',
    fbclid: searchParams.get('fbclid') || '',
    gclid: searchParams.get('gclid') || '',
  }), [searchParams]);

  useEffect(() => {
    (async () => {
      let includeAll = false;
      if (isPreview) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: adminCheck } = await supabase.rpc('is_admin');
          includeAll = !!adminCheck;
        }
      }

      const result = await getLandingPageBySlug(slug, includeAll);
      if (result.landing && result.product) {
        setLanding(result.landing);
        setProduct(result.product);
        trackLandingPageView(result.landing.id, utm);

        const directTiers = (result.landing as any)?.pricing_tiers || (result.landing as any)?.tiers || [];

        const [bo, rv, fq, qo] = await Promise.all([
          getBundleOffers(result.product.id),
          supabase.from('landing_reviews').select('*').eq('landing_page_id', result.landing.id).eq('is_active', true).order('display_order'),
          supabase.from('landing_faqs').select('*').eq('landing_page_id', result.landing.id).eq('is_active', true).order('display_order'),
          supabase.from('quantity_offers').select('*').eq('landing_page_id', result.landing.id).eq('is_active', true).order('display_order'),
        ]);

        setBundles(bo || []);
        setReviews(rv.data || []);
        setFaqs(fq.data || []);

        const allAvailableTiers = directTiers.length > 0 ? directTiers : (qo.data || []);
        if (allAvailableTiers.length > 0) {
          const defaultT = allAvailableTiers.find((q: any) => q.is_default_selected || q.is_default || q.default_selected) || allAvailableTiers[0];
          setSelectedTier(defaultT);
        } else {
          const defaultBundle = bo?.find((b: any) => b.is_default_selected) || bo?.[0];
          if (defaultBundle) setSelectedBundle(defaultBundle);
        }
      } else {
        const p = await getProductBySlug(slug);
        if (p) {
          setProduct(p);
          const { data: lp } = await supabase.from('landing_pages').select('*').eq('product_id', p.id).in('status', ['active', 'Active']).maybeSingle();
          if (lp) {
            setLanding(lp);
            trackLandingPageView(lp.id, utm);
            const directTiers = (lp as any)?.pricing_tiers || (lp as any)?.tiers || [];
            const bo = await getBundleOffers(p.id);
            setBundles(bo || []);
            const { data: qoData } = await supabase.from('quantity_offers').select('*').eq('landing_page_id', lp.id).eq('is_active', true).order('display_order');

            const allAvailableTiers = directTiers.length > 0 ? directTiers : (qoData || []);
            if (allAvailableTiers.length > 0) {
              const defaultT = allAvailableTiers.find((q: any) => q.is_default_selected || q.is_default || q.default_selected) || allAvailableTiers[0];
              setSelectedTier(defaultT);
            } else {
              const defaultBundle = bo?.find((b: any) => b.is_default_selected) || bo?.[0];
              if (defaultBundle) setSelectedBundle(defaultBundle);
            }
          }
        }
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-emerald-50/40">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      <p className="text-sm font-semibold text-emerald-900">পেজ লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
    </div>
  );

  if (!product || !landing) {
    return (
      <div className="container-custom py-16 text-center">
        <h1 className="text-2xl font-extrabold text-gray-800">অফারটি পাওয়া যায়নি</h1>
        <p className="mt-2 text-sm text-gray-500">হয়তো অফারের মেয়াদ শেষ অথবা লিঙ্কটি সঠিক নয়।</p>
        <a href="/all-products" className="mt-5 inline-block rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 transition">সকল প্রোডাক্ট দেখুন</a>
      </div>
    );
  }

  const tiersList: any[] = landing?.pricing_tiers || landing?.tiers || landing?.quantity_pricing || [];
  const images: string[] = landing?.images && landing.images.length > 0 ? landing.images : (product?.image ? [product.image] : []);

  const offerPrice = Number(
    selectedTier
      ? (selectedTier.offer_price || selectedTier.price || 0)
      : (selectedBundle?.bundle_price || landing?.offer_price || product?.sale_price || product?.regular_price || 0)
  );

  const comparePrice = Number(
    selectedTier
      ? (selectedTier.regular_price || selectedTier.compare_price || (Number(product?.regular_price || 0) * Number(selectedTier.quantity || 1)))
      : (selectedBundle?.compare_price || landing?.compare_price || Number(product?.regular_price || 0) || 0)
  );

  const isFreeDelivery = !!(selectedTier?.free_delivery || selectedTier?.is_free_delivery || selectedBundle?.free_delivery);
  const deliveryCharge = isFreeDelivery ? 0 : (offerPrice >= 600 ? 0 : offerPrice >= 400 ? 50 : offerPrice >= 200 ? 70 : 120);
  const grandTotal = offerPrice + deliveryCharge;
  const savings = comparePrice > offerPrice ? comparePrice - offerPrice : 0;
  const discountPercent = comparePrice > 0 ? Math.round((savings / comparePrice) * 100) : 0;

  const nextImage = () => setActiveImage((prev) => (prev + 1) % images.length);
  const prevImage = () => setActiveImage((prev) => (prev - 1 + images.length) % images.length);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.phone) { setError('সব প্রয়োজনীয় তথ্য পূরণ করুন'); return; }
    if (!addrValue.division || !addrValue.district || !addrValue.thana || !addrValue.detail) { setError('সম্পূর্ণ ঠিকানা নির্বাচন ও প্রদান করুন'); return; }
    if (!selectedTier && !selectedBundle) { setError('একটি অফার প্যাকেজ নির্বাচন করুন'); return; }
    const phone = form.phone.replace(/[^0-9]/g, '');
    if (!/^01[0-9]{9}$/.test(phone)) { setError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)'); return; }

    setSubmitting(true);
    try {
      const fullAddress = formatAddressToString(addrValue);
      const itemsPayload = [{
        product_id: product.id,
        landing_id: landing.id,
        quantity: selectedTier?.quantity || 1,
        title: landing.title || landing.landing_name || product.name_bn,
        tier_badge: selectedTier?.badge || null,
        unit_price: offerPrice,
        total_price: offerPrice
      }];

      const { data, error: rpcError } = await supabase.rpc('create_order', {
        p_customer_name: form.name.trim(),
        p_customer_phone: phone,
        p_delivery_address: fullAddress,
        p_special_instructions: form.instructions.trim(),
        p_order_source: utm.source || 'ads',
        p_items: itemsPayload,
        p_utm_source: utm.source,
        p_utm_medium: utm.medium,
        p_utm_campaign: utm.campaign || slug,
        p_utm_content: utm.content,
        p_utm_term: utm.term,
        p_fbclid: utm.fbclid,
        p_gclid: utm.gclid,
      });

      if (rpcError) {
        const { error: directErr } = await supabase.from('orders').insert([{
          customer_name: form.name.trim(),
          customer_phone: phone,
          customer_address: fullAddress,
          subtotal: offerPrice,
          shipping_fee: deliveryCharge,
          total_amount: grandTotal,
          items: itemsPayload,
          order_source: 'ads',
          utm_campaign: slug,
          order_status: 'pending'
        }]);
        if (directErr) throw directErr;
        window.location.href = `/order-success?number=ORD-${Date.now().toString().slice(-6)}`;
        return;
      }

      if (data?.error) { setError(data.error); return; }
      window.location.href = `/order-success?number=${data?.order_number || ''}`;
    } catch (err: any) {
      setError('অর্ডার করতে সমস্যা হয়েছে: ' + (err?.message || 'আবার চেষ্টা করুন'));
    } finally {
      setSubmitting(false);
    }
  };

  const faqItems: FaqItem[] = faqs.length > 0 ? faqs : (landing?.faq && landing.faq.length > 0 ? landing.faq : [
    { q: 'বীজের কোয়ালিটি কেমন ও অঙ্কুরোদগম হার কত?', a: 'আমাদের সকল বীজ ৯৫%+ অঙ্কুরোদগম ক্ষমতাসম্পন্ন ও শতভাগ পরীক্ষিত।' },
    { q: 'ডেলিভারি পেতে কত দিন সময় লাগবে?', a: 'ঢাকার সিটির ভেতর ২৪-৪৮ ঘণ্টা এবং ঢাকার বাইরে ২-৩ দিনের মধ্যে ডেলিভারি পেয়ে যাবেন।' },
    { q: 'পেমেন্ট কিভাবে করতে হবে?', a: 'সম্পূর্ণ ক্যাশ অন ডেলিভারি (Cash on Delivery)। পণ্য হাতে পেয়ে যাচাই করে তারপর টাকা পরিশোধ করবেন।' },
  ]);

  const rawBenefits = landing?.product_benefits || landing?.benefits || [];
  const rawFeatures = landing?.product_features || landing?.features || [];
  const hasBenefits = Array.isArray(rawBenefits) && rawBenefits.length > 0;
  const hasFeatures = Array.isArray(rawFeatures) && rawFeatures.length > 0;
  const hasDescription = (landing?.description || product?.description) && (landing?.description || product?.description).trim();
  const hasGrowingGuide = (landing?.growing_guide || landing?.cultivation_guide) && (landing?.growing_guide || landing?.cultivation_guide).trim();

  return (
    <div className="min-h-screen bg-[#fafbfc] text-gray-900 pb-28 lg:pb-12 selection:bg-emerald-500 selection:text-white">
      {/* টপ নোটিফিকেশন বার */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white text-center py-2 px-3 text-xs sm:text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-sm">
        <Sparkles className="h-4 w-4 text-amber-300 animate-pulse shrink-0" />
        <span>সীমিত সময়ের স্পেশাল অফার — ক্যাশ অন ডেলিভারি সুবিধা!</span>
      </div>

      {/* ব্র্যান্ড হেডার */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between py-3">
          <a href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white font-black text-base shadow-sm group-hover:scale-105 transition">
              S
            </div>
            <span className="font-extrabold text-xl text-emerald-900 tracking-tight">SEED BARI</span>
          </a>
          <a 
            href="#order-form" 
            className="flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800 transition active:scale-95"
          >
            অর্ডার করুন <ArrowDownCircle className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {isPreview && (
        <div className="bg-amber-500 text-center text-xs font-bold text-white py-1.5 shadow-inner">
          ⚠️ এডমিন প্রিভিউ মোড
        </div>
      )}

      {/* মূল সেকশন */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="grid gap-6 lg:grid-cols-[48%_52%] lg:gap-8 items-start">
          
          {/* বাম পাশ: ফটো গ্যালারি ও ভিডিও */}
          <div className="lg:sticky lg:top-20 space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-lg">
              {images.length > 0 ? (
                <Image 
                  src={images[activeImage] || images[0]} 
                  alt={landing?.title || product?.name_bn || ''} 
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  className="h-full w-full object-cover transition duration-300 hover:scale-105" 
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-7xl bg-emerald-50/50">🌱</div>
              )}

              {/* ডিসকাউন্ট ব্যাজ */}
              {discountPercent > 0 && (
                <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-red-600 to-rose-500 text-white text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 fill-current" /> {discountPercent}% ছাড়
                </div>
              )}

              {/* গ্যালারি নেভিগেশন */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={prevImage} 
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 p-2 text-gray-800 shadow-md hover:bg-white transition"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={nextImage} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 p-2 text-gray-800 shadow-md hover:bg-white transition"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* থাম্বনেইল ছবি */}
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {images.map((img: string, idx: number) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveImage(idx)} 
                    className={`relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border-2 transition-all ${
                      activeImage === idx ? 'border-emerald-600 shadow-md ring-2 ring-emerald-500/20' : 'border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Image src={img} alt="" fill sizes="80px" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* ভিডিও ফ্রেম (যদি থাকে) */}
            {landing?.video_url && (
              <div className="mt-4 rounded-3xl overflow-hidden border border-gray-200 shadow-md bg-black">
                <video src={landing.video_url} controls className="w-full aspect-video" poster={images[0]} />
              </div>
            )}
          </div>

          {/* ডান পাশ: প্রোডাক্ট বিবরণ, কোয়ান্টিটি সিলেক্টর ও অর্ডার ফর্ম */}
          <div className="space-y-4 sm:space-y-5">
            
            {/* হেডলাইন ও রেটিং */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {landing?.offer_badge ? (
                  <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300/60 px-3 py-0.5 text-xs font-bold uppercase tracking-wider">
                    {landing.offer_badge}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/60 px-3 py-0.5 text-xs font-bold">
                    ১০০% খাঁটি ও পরীক্ষিত বীজ
                  </span>
                )}
                <div className="flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span>৪.৯/৫ (১৫০+ রিভিউ)</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {landing?.title || landing?.landing_name || product?.name_bn}
              </h1>

              {landing?.subtitle && (
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-medium">
                  {landing.subtitle}
                </p>
              )}
            </div>

            {/* প্রাইসিং কার্ড */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80">
              <div>
                <span className="text-xs font-semibold text-gray-500 block">বর্তমান অফার মূল্য</span>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-3xl font-black text-emerald-800">{formatPrice(offerPrice)}</span>
                  {comparePrice > offerPrice && (
                    <span className="text-base text-gray-400 line-through font-semibold">{formatPrice(comparePrice)}</span>
                  )}
                </div>
              </div>
              {savings > 0 && (
                <div className="text-right">
                  <span className="inline-block bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-xs">
                    সাশ্রয় {formatPrice(savings)}
                  </span>
                </div>
              )}
            </div>

            {/* ট্রাস্ট ব্যাজ সমূহ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-100 shadow-2xs">
                <Truck className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-gray-700">{landing?.delivery_text || 'সারাদেশে হোম ডেলিভারি'}</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-100 shadow-2xs">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-gray-700">{landing?.cod_text || 'ক্যাশ অন ডেলিভারি'}</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-100 shadow-2xs col-span-2 sm:col-span-1">
                <HeartHandshake className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-gray-700">১০০% গ্যারান্টিযুক্ত</span>
              </div>
            </div>

            {/* বেনিফিট বা সুবিধার তালিকা */}
            {hasBenefits && (
              <div className="rounded-2xl bg-white p-4 border border-gray-200/80 shadow-xs space-y-2.5">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> এই প্রোডাক্টটির বিশেষত্ব:
                </h3>
                <ul className="space-y-1.5">
                  {rawBenefits.map((b: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-gray-700 font-medium">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{typeof b === 'string' ? b : b.text || b.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* কোয়ান্টিটি অফার প্যাক সিলেক্টর */}
            {tiersList.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-700" /> প্যাকেজ নির্বাচন করুন:
                  </h3>
                  <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    বেশি নিলে বেশি সাশ্রয়
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {tiersList.map((tier: any, idx: number) => {
                    const isSelected = (selectedTier?.quantity === tier.quantity) || (!selectedTier && idx === 0);
                    const tierReg = Number(tier.regular_price || tier.compare_price || (Number(product?.regular_price || 0) * Number(tier.quantity || 1)));
                    const tierOff = Number(tier.offer_price || tier.price || 0);
                    const tierSavings = tierReg > tierOff ? tierReg - tierOff : 0;
                    const tierPercent = tierReg > 0 ? Math.round((tierSavings / tierReg) * 100) : 0;

                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => { setSelectedTier(tier); setSelectedBundle(null); }}
                        className={`relative rounded-2xl border-2 p-3.5 text-left transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                            : 'border-gray-200 bg-white hover:border-emerald-300'
                        }`}
                      >
                        {tier.badge && (
                          <span className="absolute -top-2.5 right-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[10px] font-black text-white uppercase shadow-sm">
                            {tier.badge}
                          </span>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-sm text-gray-900">{tier.quantity} টি প্যাকেট</span>
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                        </div>

                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-emerald-800">{formatPrice(tierOff)}</span>
                          {tierReg > tierOff && (
                            <span className="text-xs text-gray-400 line-through font-semibold">{formatPrice(tierReg)}</span>
                          )}
                        </div>

                        {tierSavings > 0 && (
                          <p className="mt-1 text-[11px] font-bold text-emerald-700">
                            সাশ্রয় {formatPrice(tierSavings)} ({tierPercent}%)
                          </p>
                        )}
                        {(tier.free_delivery || tier.is_free_delivery) && (
                          <span className="mt-1 inline-block text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            ✓ ফ্রি ডেলিভারি
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* সম্পূর্ণ অর্ডার ফর্ম */}
            <div id="order-form" className="rounded-3xl border-2 border-emerald-600/30 bg-white p-4 sm:p-6 shadow-xl space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-white text-xs">১</span>
                  অর্ডার করতে নিচের ফর্মটি পূরণ করুন
                </h2>
                <p className="text-xs text-gray-500 mt-1">পণ্য হাতে পেয়ে সম্পূর্ণ মূল্য পরিশোধ করার সুবিধা রয়েছে।</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs sm:text-sm font-bold text-gray-700">আপনার পুরো নাম *</label>
                  <input 
                    type="text" 
                    value={form.name} 
                    onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    className="input-bangla w-full" 
                    placeholder="আপনার নাম লিখুন" 
                    required 
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs sm:text-sm font-bold text-gray-700">মোবাইল নম্বর (১১ ডিজিট) *</label>
                  <input 
                    type="tel" 
                    value={form.phone} 
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                    className="input-bangla w-full" 
                    placeholder="01XXXXXXXXX" 
                    required 
                  />
                </div>
<div>
                  <label className="mb-1 block text-xs sm:text-sm font-bold text-gray-700">সম্পূর্ণ ঠিকানা নির্বাচন করুন *</label>
                  <AddressSelector value={addrValue} onChange={setAddrValue} />
                </div>

                <div>
                  <label className="mb-1 block text-xs sm:text-semibold text-gray-500">বিশেষ কোনো নির্দেশনা থাকলে লিখুন (ঐচ্ছিক)</label>
                  <input 
                    type="text" 
                    value={form.instructions} 
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })} 
                    className="input-bangla w-full text-xs" 
                    placeholder="যেমন: বিকাল ৫টার পর ডেলিভারি দিন" 
                  />
                </div>

                {/* বিলিং সামারি */}
                <div className="rounded-2xl bg-gray-50 border border-gray-200/70 p-4 text-xs sm:text-sm space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>নির্বাচিত পণ্য ও পরিমাণ</span>
                    <span className="font-bold text-gray-900">{selectedTier ? `${selectedTier.quantity} টি প্যাকেট` : '১টি'}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>পণ্যের মূল্য</span>
                    <span className="font-semibold text-gray-900">{formatPrice(offerPrice)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>ডেলিভারি চার্জ</span>
                    <span>
                      {isFreeDelivery ? (
                        <span className="font-bold text-emerald-700">ফ্রি</span>
                      ) : (
                        formatPrice(deliveryCharge)
                      )}
                    </span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold border-t border-gray-200 pt-2">
                      <span>মোট সাশ্রয়</span>
                      <span>-{formatPrice(savings)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm sm:text-base font-black text-gray-900 border-t border-gray-200 pt-2">
                    <span>সর্বমোট প্রদেয় বিল</span>
                    <span className="text-emerald-800 text-lg sm:text-xl font-extrabold">{formatPrice(grandTotal)}</span>
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-700">
                    ⚠️ {error}
                  </p>
                )}

                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 py-4 text-base sm:text-lg font-extrabold text-white shadow-lg shadow-emerald-700/25 hover:from-emerald-800 hover:to-emerald-900 transition active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> অর্ডার প্রসেস হচ্ছে...</>
                  ) : (
                    <><Zap className="h-5 w-5 fill-current text-amber-300" /> {landing?.cta_text || 'অর্ডার কনফার্ম করুন'} — {formatPrice(grandTotal)}</>
                  )}
                </button>

                <p className="text-center text-[11px] font-semibold text-gray-500 flex items-center justify-center gap-1.5 pt-1">
                  <Shield className="h-3.5 w-3.5 text-emerald-700" /> আপনার তথ্য শতভাগ নিরাপদ ও সুরক্ষিত
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* বিস্তারিত বিবরণ ও চাষের গাইড */}
      <div className="border-t border-gray-200 bg-white mt-10">
        {hasDescription && (
          <section className="max-w-4xl mx-auto px-4 py-8">
            <h2 className="mb-4 text-xl sm:text-2xl font-extrabold text-gray-900">পণ্যের বিস্তারিত বিবরণ</h2>
            <div className="whitespace-pre-line text-sm sm:text-base text-gray-700 leading-relaxed space-y-2">
              {landing?.description || product?.description}
            </div>
          </section>
        )}

        {hasGrowingGuide && (
          <section className="max-w-4xl mx-auto px-4 py-6">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-50/60 p-6 sm:p-8">
              <h2 className="mb-3 text-xl font-extrabold text-emerald-950 flex items-center gap-2">
                🌱 সঠিক চাষ ও যত্ন নেওয়ার নিয়ম
              </h2>
              <div className="whitespace-pre-line text-sm sm:text-base text-emerald-900 leading-relaxed">
                {landing?.growing_guide || landing?.cultivation_guide}
              </div>
            </div>
          </section>
        )}

        {/* কাস্টমার রিভিউ */}
        {reviews.length > 0 && (
          <section className="max-w-4xl mx-auto px-4 py-8 border-t border-gray-100">
            <h2 className="mb-6 text-xl sm:text-2xl font-extrabold text-gray-900 text-center">গ্রাহকদের চমৎকার মতামত</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {reviews.map((r: any) => (
                <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">
                        {r.customer_name ? r.customer_name.charAt(0) : 'U'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{r.customer_name}</p>
                        <p className="text-[10px] text-gray-400">ভেরিফায়েড ক্রেতা</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-current' : 'text-gray-200'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{r.review}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* সচরাচর জিজ্ঞাসা (FAQ) */}
        <section className="max-w-4xl mx-auto px-4 py-8 border-t border-gray-100">
          <h2 className="mb-6 text-xl sm:text-2xl font-extrabold text-gray-900 text-center">সাধারণ জিজ্ঞাসা (FAQ)</h2>
          <div className="space-y-3">
            {faqItems.map((item: FaqItem, idx: number) => (
              <details key={idx} className="group rounded-2xl border border-gray-200 bg-white p-4 transition-all open:border-emerald-500">
                <summary className="flex cursor-pointer items-center justify-between font-bold text-sm sm:text-base text-gray-800">
                  {item.question || item.q}
                  <ChevronDown className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180 group-open:text-emerald-700" />
                </summary>
                <p className="mt-3 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-2.5">
                  {item.answer || item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </div>

      {/* মোবাইল স্টিকি বটম বার (Mobile Sticky Action Bar) */}
      {(selectedTier || selectedBundle) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md p-3 shadow-2xl lg:hidden">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 font-semibold">{selectedTier ? `${selectedTier.quantity}টি প্যাকেট` : 'প্যাকেজ'}</p>
              <p className="text-xl font-black text-emerald-800">{formatPrice(grandTotal)}</p>
            </div>
            <a 
              href="#order-form" 
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-700/30 active:scale-95 transition"
            >
              <Zap className="h-4 w-4 fill-current text-amber-300" />
              অর্ডার করুন
            </a>
          </div>
        </div>
      )}

      <PromotionalPopup location="offers" />
    </div>
  );
}
