'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getProductBySlug, getLandingPageBySlug, getBundleOffers, formatPrice, trackLandingPageView } from '@/lib/data';
import { supabase } from '@/lib/supabase/client';
import { Check, Truck, ShieldCheck, Star, ChevronDown, ChevronLeft, ChevronRight, Loader2, Zap, Package, Sparkles, Clock, ArrowDownCircle, CheckCircle2, Shield, HeartHandshake } from 'lucide-react';
import { AddressSelector, formatAddressToString, type AddressValue } from '@/components/site/address-selector';
import { PromotionalPopup } from '@/components/site/promotional-popup';
import { useLang } from '@/components/site/language-provider';
import { IndiaPaymentMethodSelector, type IndiaPaymentMethod } from '@/components/site/india-payment-method-selector';
import { startIndiaCampaignPayment } from '@/lib/india-campaign-payment';

interface FaqItem {
  question?: string;
  answer?: string;
  question_en?: string;
  answer_en?: string;
  question_hi?: string;
  answer_hi?: string;
  q?: string;
  a?: string;
}

export default function OfferLandingPage() {
  const { lang, t } = useLang();
  const tr = useCallback((bn: string, en: string, hi: string) => t(bn, en, hi), [t]);
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
  const [deliveryCharge, setDeliveryCharge] = useState<number | null>(null);
  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<IndiaPaymentMethod>('online');
  const [form, setForm] = useState({ name: '', phone: '', instructions: '' });
  const [addrValue, setAddrValue] = useState<AddressValue>({ division: '', district: '', thana: '', detail: '', postalCode: '' });

  const isPreview = searchParams.get('preview') === '1';

  // Ads landing pages belong to a specific branch; checkout must use that branch
  // instead of AddressSelector's Bangladesh default.
  const countryCode = String(landing?.country_code || product?.country_code || 'BD').toUpperCase() === 'IN' ? 'IN' : 'BD';

  const offerPrice = Number(
    selectedTier
      ? (selectedTier.offer_price || selectedTier.price || 0)
      : (selectedBundle?.bundle_price || landing?.offer_price || product?.sale_price || product?.regular_price || 0)
  );
  const isFreeDelivery = !!(selectedTier?.free_delivery || selectedTier?.is_free_delivery || selectedBundle?.free_delivery);
  const indiaDelivery = isFreeDelivery ? 0 : Number(deliveryCharge || 0);
  const indiaGrandTotal = offerPrice + indiaDelivery;
  const indiaCodAdvance = indiaDelivery > 0 ? indiaDelivery : 120;
  const indiaCodDue = Math.max(0, indiaGrandTotal - indiaCodAdvance);

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
  }, [slug, isPreview, utm]);

  useEffect(() => {
    let active = true;

    if (isFreeDelivery) {
      setDeliveryCharge(0);
      setDeliveryQuoteLoading(false);
      setDeliveryQuoteError('');
      return () => { active = false; };
    }

    if (!landing || (!selectedTier && !selectedBundle) || !Number.isFinite(offerPrice) || offerPrice <= 0) {
      setDeliveryCharge(null);
      setDeliveryQuoteLoading(false);
      setDeliveryQuoteError('');
      return () => { active = false; };
    }

    setDeliveryCharge(null);
    setDeliveryQuoteError('');
    setDeliveryQuoteLoading(true);

    const loadQuote = async () => {
      try {
        const { data, error: quoteError } = await supabase.rpc('calculate_delivery_charge', {
          p_order_value: offerPrice,
          p_free_delivery: false,
        });
        if (!active) return;

        const charge = Number(data);
        if (quoteError || data === null || !Number.isFinite(charge) || charge < 0) {
          setDeliveryQuoteError(quoteError?.message || tr('ডেলিভারি চার্জ যাচাই করা যায়নি', 'Could not verify delivery charge', 'डिलीवरी शुल्क की पुष्टि नहीं हो सकी'));
          setDeliveryCharge(null);
        } else {
          setDeliveryCharge(charge);
          setDeliveryQuoteError('');
        }
      } catch (quoteError: any) {
        if (!active) return;
        setDeliveryQuoteError(quoteError?.message || tr('ডেলিভারি চার্জ যাচাই করা যায়নি', 'Could not verify delivery charge', 'डिलीवरी शुल्क की पुष्टि नहीं हो सकी'));
        setDeliveryCharge(null);
      } finally {
        if (active) setDeliveryQuoteLoading(false);
      }
    };

    void loadQuote();
    return () => { active = false; };
  }, [landing, selectedTier, selectedBundle, offerPrice, isFreeDelivery, tr]);

  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-emerald-50/40">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      <p className="text-sm font-semibold text-emerald-900">{t('পেজ লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...', 'Loading offer, please wait…', 'ऑफ़र लोड हो रहा है, कृपया प्रतीक्षा करें…')}</p>
    </div>
  );

  if (!product || !landing) {
    return (
      <div className="container-custom py-16 text-center">
        <h1 className="text-2xl font-extrabold text-gray-800">{t('অফারটি পাওয়া যায়নি', 'Offer not found', 'ऑफ़र नहीं मिला')}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('হয়তো অফারের মেয়াদ শেষ অথবা লিঙ্কটি সঠিক নয়।', 'This offer may have expired or the link may be incorrect.', 'ऑफ़र की अवधि समाप्त हो सकती है या लिंक गलत हो सकता है।')}</p>
        <a href="/all-products" className="mt-5 inline-block rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 transition">{t('সকল প্রোডাক্ট দেখুন', 'View all products', 'सभी उत्पाद देखें')}</a>
      </div>
    );
  }

  const tiersList: any[] = landing?.pricing_tiers || landing?.tiers || landing?.quantity_pricing || [];
  const landingTranslation = landing?.translations?.[lang] || {};
  const localized = (field: string, fallback: string) => landingTranslation[field]?.trim?.() || fallback;
  const localizedList = (field: string, fallback: any[]) => {
    const value = landingTranslation[field];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.split('\n').map((item: string) => item.trim()).filter(Boolean);
    return fallback;
  };
  const title = localized('title', lang === 'bn' ? (landing.title || product.name_bn || product.name_en || '') : (product.name_en || landing.title || product.name_bn || ''));
  const subtitle = localized('subtitle', landing.subtitle || '');
  const description = localized('description', landing.description || product.description || '');
  const growingGuide = localized('growing_guide', landing.growing_guide || landing.cultivation_guide || '');
  const deliveryText = localized('delivery_text', landing.delivery_text || t('সারাদেশে হোম ডেলিভারি', 'Home delivery available', 'घर तक डिलीवरी उपलब्ध'));
  const codText = localized('cod_text', landing.cod_text || t('ক্যাশ অন ডেলিভারি', 'Cash on delivery', 'कैश ऑन डिलीवरी'));
  const trustText = localized('trust_text', landing.trust_text || '');
  const offerHeadline = localized('offer_headline', landing.offer_headline || '');
  const discountLabel = localized('discount_label', landing.discount_label || tr('সাশ্রয়', 'You save', 'बचत'));
  const benefitsList = localizedList('benefits', landing?.product_benefits || landing?.benefits || []);
  const images: string[] = landing?.images && landing.images.length > 0 ? landing.images : (product?.image ? [product.image] : []);


  const comparePrice = Number(
    selectedTier
      ? (selectedTier.regular_price || selectedTier.compare_price || (Number(product?.regular_price || 0) * Number(selectedTier.quantity || 1)))
      : (selectedBundle?.compare_price || landing?.compare_price || Number(product?.regular_price || 0) || 0)
  );

  const grandTotal = offerPrice + (isFreeDelivery ? 0 : (deliveryCharge ?? 0));
  const hasDeliveryQuote = isFreeDelivery || deliveryCharge !== null;
  const grandTotalLabel = hasDeliveryQuote
    ? formatPrice(grandTotal)
    : deliveryQuoteLoading ? tr('হিসাব হচ্ছে…', 'Calculating…', 'गणना हो रही है…') : '—';
  const savings = comparePrice > offerPrice ? comparePrice - offerPrice : 0;
  const discountPercent = comparePrice > 0 ? Math.round((savings / comparePrice) * 100) : 0;
  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  const nextImage = () => setActiveImage((prev) => (prev + 1) % images.length);
  const prevImage = () => setActiveImage((prev) => (prev - 1 + images.length) % images.length);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.phone) { setError(tr('সব প্রয়োজনীয় তথ্য পূরণ করুন', 'Please complete all required fields', 'कृपया सभी ज़रूरी जानकारी भरें')); return; }
    if (!addrValue.division || !addrValue.district || !addrValue.thana || !addrValue.detail) { setError(tr('সম্পূর্ণ ঠিকানা নির্বাচন ও প্রদান করুন', 'Please select and enter your full address', 'कृपया पूरा पता चुनें और भरें')); return; }
    if (!selectedTier && !selectedBundle) { setError(tr('একটি অফার প্যাকেজ নির্বাচন করুন', 'Please select an offer package', 'कृपया एक ऑफ़र पैकेज चुनें')); return; }
    if (!isFreeDelivery && (deliveryQuoteLoading || deliveryCharge === null || deliveryQuoteError)) { setError(tr('ডেলিভারি চার্জ যাচাই করা যায়নি। আবার চেষ্টা করুন।', 'Could not verify the delivery charge. Please try again.', 'डिलीवरी शुल्क की पुष्टि नहीं हो सकी। कृपया फिर कोशिश करें।')); return; }
    const phone = form.phone.replace(/[^0-9]/g, '');
    const phoneValid = countryCode === 'IN' ? /^[6-9][0-9]{9}$/.test(phone) : /^01[0-9]{9}$/.test(phone);
    if (!phoneValid) {
      setError(countryCode === 'IN'
        ? tr('সঠিক ১০ সংখ্যার ভারতীয় মোবাইল নম্বর দিন (যেমন: 9876543210)', 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)', 'सही 10 अंकों का भारतीय मोबाइल नंबर डालें (जैसे: 9876543210)')
        : tr('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)', 'Enter a valid 11-digit Bangladesh mobile number (e.g. 01XXXXXXXXX)', 'बांग्लादेश का सही 11 अंकों का मोबाइल नंबर डालें (जैसे: 01XXXXXXXXX)'));
      return;
    }

    setSubmitting(true);
    try {
      const fullAddress = formatAddressToString(addrValue);
      if (countryCode === 'IN') {
        if (paymentMethod === 'cod' && indiaCodAdvance > indiaGrandTotal) {
          setError(tr('এই অর্ডারের মোটের চেয়ে COD অগ্রিম বেশি হচ্ছে। Online payment বেছে নিন।', 'The COD advance is greater than the order total. Choose online payment.', 'COD अग्रिम राशि ऑर्डर की कुल राशि से अधिक है। ऑनलाइन भुगतान चुनें।'));
          return;
        }
        await startIndiaCampaignPayment({
          flow: 'ads',
          context: {
            landing_page_id: landing.id,
            product_id: product.id,
            quantity: selectedTier?.quantity || selectedBundle?.quantity || 1,
            bundle_id: selectedBundle?.id || null,
            utm_source: utm.source,
            utm_medium: utm.medium,
            utm_campaign: utm.campaign || slug,
            utm_content: utm.content,
            utm_term: utm.term,
            fbclid: utm.fbclid,
            gclid: utm.gclid,
          },
          method: paymentMethod,
          customerName: form.name.trim(),
          customerPhone: phone,
          deliveryAddress: fullAddress,
          instructions: form.instructions.trim(),
        });
        return;
      }
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

      if (rpcError) throw rpcError;

      if (data?.error) { setError(data.error); return; }
      window.location.href = `/order-success?number=${data?.order_number || ''}`;
    } catch (err: any) {
      setError(tr('অর্ডার করতে সমস্যা হয়েছে: ', 'Could not place the order: ', 'ऑर्डर नहीं हो सका: ') + (err?.message || tr('আবার চেষ্টা করুন', 'Please try again', 'कृपया फिर कोशिश करें')));
    } finally {
      setSubmitting(false);
    }
  };

  const faqItems: FaqItem[] = faqs.length > 0 ? faqs : (landing?.faq && landing.faq.length > 0 ? landing.faq : [
    {
      q: tr('বীজ কীভাবে বপন করব?', 'How should I sow these seeds?', 'इन बीजों को कैसे बोएँ?'),
      a: tr('প্যাকেটের নির্দেশনা অনুসরণ করুন। ফলাফল বীজ ও পরিবেশ অনুযায়ী ভিন্ন হতে পারে।', 'Follow the instructions on the packet. Results can vary by seed and growing conditions.', 'पैकेट पर दिए निर्देशों का पालन करें। नतीजे बीज और उगाने की परिस्थितियों के अनुसार बदल सकते हैं।'),
    },
    {
      q: tr('ডেলিভারি সম্পর্কে কীভাবে জানব?', 'How can I check delivery details?', 'डिलीवरी की जानकारी कैसे मिलेगी?'),
      a: tr('আপনার ঠিকানা দিয়ে অর্ডার ফর্ম পূরণ করুন। প্রযোজ্য ডেলিভারি চার্জ ও পরবর্তী নির্দেশনা সেখানে দেখানো হবে।', 'Enter your address in the order form to see the applicable delivery charge and instructions.', 'लागू डिलीवरी शुल्क और निर्देश देखने के लिए ऑर्डर फ़ॉर्म में अपना पता भरें।'),
    },
    {
      q: tr('কীভাবে পেমেন্ট করব?', 'How can I pay?', 'भुगतान कैसे करूँ?'),
      a: tr('আপনার ব্রাঞ্চে যে পেমেন্ট পদ্ধতি দেখানো হয়, সেটি বেছে নিন।', 'Choose one of the payment methods shown for your branch.', 'अपने ब्रांच के लिए दिखाए गए भुगतान तरीकों में से एक चुनें।'),
    },
  ]);

  const hasBenefits = Array.isArray(benefitsList) && benefitsList.length > 0;
  const hasDescription = description && description.trim();
  const hasGrowingGuide = growingGuide && growingGuide.trim();

  return (
    <div className="min-h-screen bg-[#fafbfc] text-gray-900 pb-28 lg:pb-12 selection:bg-emerald-500 selection:text-white">
      {/* টপ নোটিফিকেশন বার */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white text-center py-2 px-3 text-xs sm:text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-sm">
        <Sparkles className="h-4 w-4 text-amber-300 animate-pulse shrink-0" />
        <span>{tr('সীমিত সময়ের স্পেশাল অফার — ক্যাশ অন ডেলিভারি সুবিধা!', 'Limited-time special offer — Cash on Delivery available!', 'सीमित समय का विशेष ऑफ़र — कैश ऑन डिलीवरी उपलब्ध!')}</span>
      </div>

      {/* ব্র্যান্ড হেডার */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white font-black text-base shadow-sm group-hover:scale-105 transition">
              S
            </div>
            <span className="font-extrabold text-xl text-emerald-900 tracking-tight">SEED BARI</span>
          </Link>
          <a 
            href="#order-form" 
            className="flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800 transition active:scale-95"
          >
            {tr('অর্ডার করুন', 'Order now', 'अभी ऑर्डर करें')} <ArrowDownCircle className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {isPreview && (
        <div className="bg-amber-500 text-center text-xs font-bold text-white py-1.5 shadow-inner">
          ⚠️ {tr('এডমিন প্রিভিউ মোড', 'Admin preview mode', 'एडमिन प्रीव्यू मोड')}
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
                  alt={title}
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
                  <Zap className="h-3.5 w-3.5 fill-current" /> {discountPercent}% {tr('ছাড়', 'off', 'छूट')}
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
                {localized('offer_badge', landing?.offer_badge || '') ? (
                  <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300/60 px-3 py-0.5 text-xs font-bold uppercase tracking-wider">
                    {localized('offer_badge', landing.offer_badge)}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/60 px-3 py-0.5 text-xs font-bold">
                    {tr('বীজের বিশেষ অফার', 'Seed offer', 'बीजों का विशेष ऑफ़र')}
                  </span>
                )}
                {averageRating && <div className="flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span>{averageRating}/5 ({reviews.length} {tr('রিভিউ', 'reviews', 'समीक्षाएँ')})</span>
                </div>}
              </div>

              {offerHeadline && <p className="text-sm font-semibold text-emerald-800">{offerHeadline}</p>}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {title || landing?.landing_name || product?.name_bn}
              </h1>

              {landing?.subtitle && (
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-medium">
                  {subtitle}
                </p>
              )}
            </div>

            {/* প্রাইসিং কার্ড */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80">
              <div>
                <span className="text-xs font-semibold text-gray-500 block">{tr('বর্তমান অফার মূল্য', 'Current offer price', 'वर्तमान ऑफ़र मूल्य')}</span>
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
                    {discountLabel} {formatPrice(savings)}
                  </span>
                </div>
              )}
            </div>

            {/* ট্রাস্ট ব্যাজ সমূহ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-100 shadow-2xs">
                <Truck className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-gray-700">{deliveryText}</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-100 shadow-2xs">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-gray-700">{codText}</span>
              </div>
              {trustText && <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-100 shadow-2xs col-span-2 sm:col-span-1">
                <HeartHandshake className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-gray-700">{trustText}</span>
              </div>}
            </div>

            {/* বেনিফিট বা সুবিধার তালিকা */}
            {hasBenefits && (
              <div className="rounded-2xl bg-white p-4 border border-gray-200/80 shadow-xs space-y-2.5">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {tr('এই প্রোডাক্টটির বিশেষত্ব:', 'Product benefits:', 'इस उत्पाद के लाभ:')}
                </h3>
                <ul className="space-y-1.5">
                  {benefitsList.map((b: any, idx: number) => (
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
                    <Package className="h-5 w-5 text-emerald-700" /> {tr('প্যাকেজ নির্বাচন করুন:', 'Choose a package:', 'पैकेज चुनें:')}
                  </h3>
                  <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {tr('বেশি নিলে বেশি সাশ্রয়', 'Save more when you buy more', 'ज़्यादा खरीदें, ज़्यादा बचाएँ')}
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
                          <span className="font-extrabold text-sm text-gray-900">{tier.quantity} {tr('টি প্যাকেট', 'packets', 'पैकेट')}</span>
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
                            {tr('সাশ্রয়', 'Save', 'बचत')} {formatPrice(tierSavings)} ({tierPercent}%)
                          </p>
                        )}
                        {(tier.free_delivery || tier.is_free_delivery) && (
                          <span className="mt-1 inline-block text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            ✓ {tr('ফ্রি ডেলিভারি', 'Free delivery', 'मुफ़्त डिलीवरी')}
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
                  {tr('অর্ডার করতে নিচের ফর্মটি পূরণ করুন', 'Complete the form below to order', 'ऑर्डर करने के लिए नीचे दिया फ़ॉर्म भरें')}
                </h2>
                <p className="text-xs text-gray-500 mt-1">{tr('পণ্য হাতে পেয়ে সম্পূর্ণ মূল্য পরিশোধ করার সুবিধা রয়েছে।', 'Payment options are available at checkout for your branch.', 'आपके ब्रांच के लिए भुगतान विकल्प चेकआउट पर उपलब्ध हैं।')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs sm:text-sm font-bold text-gray-700">{tr('আপনার পুরো নাম', 'Full name', 'पूरा नाम')} *</label>
                  <input 
                    type="text" 
                    value={form.name} 
                    onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    className="input-bangla w-full" 
                    placeholder={tr('আপনার নাম লিখুন', 'Enter your name', 'अपना नाम लिखें')}
                    required 
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs sm:text-sm font-bold text-gray-700">{countryCode === 'IN' ? tr('মোবাইল নম্বর (১০ ডিজিট)', 'Mobile number (10 digits)', 'मोबाइल नंबर (10 अंक)') : tr('মোবাইল নম্বর (১১ ডিজিট)', 'Mobile number (11 digits)', 'मोबाइल नंबर (11 अंक)')} *</label>
                  <input 
                    type="tel" 
                    value={form.phone} 
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                    className="input-bangla w-full" 
                    placeholder={countryCode === 'IN' ? '9876543210' : '01XXXXXXXXX'} 
                    required 
                  />
                </div>
<div>
                  <label className="mb-1 block text-xs sm:text-sm font-bold text-gray-700">{tr('সম্পূর্ণ ঠিকানা নির্বাচন করুন', 'Enter your complete address', 'पूरा पता भरें')} *</label>
                  <AddressSelector value={addrValue} onChange={setAddrValue} countryCode={countryCode} />
                </div>

                <div>
                  <label className="mb-1 block text-xs sm:text-semibold text-gray-500">{tr('বিশেষ কোনো নির্দেশনা থাকলে লিখুন (ঐচ্ছিক)', 'Delivery instructions (optional)', 'डिलीवरी के लिए निर्देश (वैकल्पिक)')}</label>
                  <input 
                    type="text" 
                    value={form.instructions} 
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })} 
                    className="input-bangla w-full text-xs" 
                    placeholder={tr('যেমন: বিকাল ৫টার পর ডেলিভারি দিন', 'For example: deliver after 5 PM', 'उदाहरण: शाम 5 बजे के बाद डिलीवर करें')}
                  />
                </div>

                {countryCode === 'IN' && <IndiaPaymentMethodSelector
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  advanceAmount={indiaCodAdvance}
                  dueAmount={indiaCodDue}
                  codAvailable={!deliveryQuoteLoading && !deliveryQuoteError && (isFreeDelivery || deliveryCharge !== null) && indiaCodAdvance <= indiaGrandTotal}
                  language={lang === 'hi' ? 'hi' : lang === 'en' ? 'en' : 'bn'}
                />}

                {/* বিলিং সামারি */}
                <div className="rounded-2xl bg-gray-50 border border-gray-200/70 p-4 text-xs sm:text-sm space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>{tr('নির্বাচিত পণ্য ও পরিমাণ', 'Selected product and quantity', 'चुना गया उत्पाद और मात्रा')}</span>
                    <span className="font-bold text-gray-900">{selectedTier ? `${selectedTier.quantity} ${tr('টি প্যাকেট', 'packets', 'पैकेट')}` : `1 ${tr('টি', 'item', 'वस्तु')}`}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{tr('পণ্যের মূল্য', 'Product price', 'उत्पाद का मूल्य')}</span>
                    <span className="font-semibold text-gray-900">{formatPrice(offerPrice)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{tr('ডেলিভারি চার্জ', 'Delivery charge', 'डिलीवरी शुल्क')}</span>
                    <span>
                      {isFreeDelivery ? (
                        <span className="font-bold text-emerald-700">{tr('ফ্রি', 'Free', 'मुफ़्त')}</span>
                      ) : deliveryQuoteLoading ? (
                        <span className="text-gray-500">{tr('হিসাব হচ্ছে…', 'Calculating…', 'गणना हो रही है…')}</span>
                      ) : deliveryQuoteError || deliveryCharge === null ? (
                        <span className="font-semibold text-red-600">{tr('যাচাই করা যাচ্ছে না', 'Unable to verify', 'पुष्टि नहीं हो सकी')}</span>
                      ) : (
                        formatPrice(deliveryCharge)
                      )}
                    </span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold border-t border-gray-200 pt-2">
                      <span>{tr('মোট সাশ্রয়', 'Total savings', 'कुल बचत')}</span>
                      <span>-{formatPrice(savings)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm sm:text-base font-black text-gray-900 border-t border-gray-200 pt-2">
                    <span>{tr('সর্বমোট প্রদেয় বিল', 'Total amount due', 'कुल देय राशि')}</span>
                    <span className="text-emerald-800 text-lg sm:text-xl font-extrabold">{grandTotalLabel}</span>
                  </div>
                  {countryCode === 'IN' && paymentMethod === 'cod' && <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-emerald-800"><span>{tr('এখন অগ্রিম / ডেলিভারিতে বাকি', 'Pay now / due on delivery', 'अभी भुगतान / डिलीवरी पर बाकी')}</span><span>{formatPrice(indiaCodAdvance)} / {formatPrice(indiaCodDue)}</span></div>}
                </div>

                {error && (
                  <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-700">
                    ⚠️ {error}
                  </p>
                )}

                <button 
                  type="submit" 
                  disabled={submitting || !hasDeliveryQuote || deliveryQuoteLoading || !!deliveryQuoteError} 
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 py-4 text-base sm:text-lg font-extrabold text-white shadow-lg shadow-emerald-700/25 hover:from-emerald-800 hover:to-emerald-900 transition active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> {tr('অর্ডার প্রসেস হচ্ছে...', 'Processing your order…', 'आपका ऑर्डर प्रोसेस हो रहा है…')}</>
                  ) : (
                    <><Zap className="h-5 w-5 fill-current text-amber-300" /> {countryCode === 'IN' ? (paymentMethod === 'cod' ? tr('COD অগ্রিম পরিশোধ', 'Pay COD advance', 'COD अग्रिम भुगतान करें') : tr('অনলাইনে পেমেন্ট করুন', 'Pay online', 'ऑनलाइन भुगतान करें')) : localized('cta_text', landing?.cta_text || tr('অর্ডার কনফার্ম করুন', 'Confirm order', 'ऑर्डर की पुष्टि करें'))} — {countryCode === 'IN' && paymentMethod === 'cod' ? formatPrice(indiaCodAdvance) : grandTotalLabel}</>
                  )}
                </button>

                <p className="text-center text-[11px] font-semibold text-gray-500 flex items-center justify-center gap-1.5 pt-1">
                  <Shield className="h-3.5 w-3.5 text-emerald-700" /> {tr('আপনার তথ্য শতভাগ নিরাপদ ও সুরক্ষিত', 'Your information is secure', 'आपकी जानकारी सुरक्षित है')}
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
            <h2 className="mb-4 text-xl sm:text-2xl font-extrabold text-gray-900">{tr('পণ্যের বিস্তারিত বিবরণ', 'Product details', 'उत्पाद का विवरण')}</h2>
            <div className="whitespace-pre-line text-sm sm:text-base text-gray-700 leading-relaxed space-y-2">
              {description}
            </div>
          </section>
        )}

        {hasGrowingGuide && (
          <section className="max-w-4xl mx-auto px-4 py-6">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-50/60 p-6 sm:p-8">
                <h2 className="mb-3 text-xl font-extrabold text-emerald-950 flex items-center gap-2">
                🌱 {tr('সঠিক চাষ ও যত্ন নেওয়ার নিয়ম', 'Growing and care instructions', 'उगाने और देखभाल के निर्देश')}
              </h2>
              <div className="whitespace-pre-line text-sm sm:text-base text-emerald-900 leading-relaxed">
                {growingGuide}
              </div>
            </div>
          </section>
        )}

        {/* কাস্টমার রিভিউ */}
        {reviews.length > 0 && (
          <section className="max-w-4xl mx-auto px-4 py-8 border-t border-gray-100">
            <h2 className="mb-6 text-xl sm:text-2xl font-extrabold text-gray-900 text-center">{tr('গ্রাহকদের চমৎকার মতামত', 'Customer reviews', 'ग्राहकों की समीक्षाएँ')}</h2>
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
                        <p className="text-[10px] text-gray-400">{tr('ভেরিফায়েড ক্রেতা', 'Verified buyer', 'सत्यापित खरीदार')}</p>
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
          <h2 className="mb-6 text-xl sm:text-2xl font-extrabold text-gray-900 text-center">{tr('সাধারণ জিজ্ঞাসা (FAQ)', 'Frequently asked questions', 'अक्सर पूछे जाने वाले सवाल')}</h2>
          <div className="space-y-3">
            {faqItems.map((item: FaqItem, idx: number) => (
              <details key={idx} className="group rounded-2xl border border-gray-200 bg-white p-4 transition-all open:border-emerald-500">
                <summary className="flex cursor-pointer items-center justify-between font-bold text-sm sm:text-base text-gray-800">
                  {(lang === 'en' ? item.question_en : lang === 'hi' ? (item.question_hi || item.question_en) : item.question) || item.question || item.q}
                  <ChevronDown className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180 group-open:text-emerald-700" />
                </summary>
                <p className="mt-3 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-2.5">
                  {(lang === 'en' ? item.answer_en : lang === 'hi' ? (item.answer_hi || item.answer_en) : item.answer) || item.answer || item.a}
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
              <p className="text-xs text-gray-500 font-semibold">{selectedTier ? `${selectedTier.quantity} ${tr('টি প্যাকেট', 'packets', 'पैकेट')}` : tr('প্যাকেজ', 'Package', 'पैकेज')}</p>
              <p className="text-xl font-black text-emerald-800">{grandTotalLabel}</p>
            </div>
            <a 
              href="#order-form" 
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-700/30 active:scale-95 transition"
            >
              <Zap className="h-4 w-4 fill-current text-amber-300" />
              {tr('অর্ডার করুন', 'Order now', 'अभी ऑर्डर करें')}
            </a>
          </div>
        </div>
      )}

      <PromotionalPopup location="offers" />
    </div>
  );
}
