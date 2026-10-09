'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/components/site/language-provider';
import { useParams, useSearchParams } from 'next/navigation';
import { AddressSelector, formatAddressToString, type AddressValue } from '@/components/site/address-selector';
import { getVisitorCountry, supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { IndiaPaymentMethodSelector, type IndiaPaymentMethod } from '@/components/site/india-payment-method-selector';
import { startIndiaCampaignPayment } from '@/lib/india-campaign-payment';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Gift,
  Loader2,
  LockKeyhole,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Users,
  Wheat,
} from 'lucide-react';

type PackageOption = {
  id: string;
  package_name: string;
  quantity: number;
  offer_price: number;
  compare_price: number | null;
  badge: string | null;
  free_delivery: boolean;
  custom_delivery_charge: number | null;
  is_default_selected: boolean;
};

type StoryStep = { title?: string; text?: string; icon?: string };
type ContentCard = { title?: string; text?: string; icon?: string };
type Testimonial = { name?: string; location?: string; text?: string; rating?: number; image?: string };

const fallbackStory: StoryStep[] = [
  { title: 'সমস্যা', text: 'কম ফলন, দুর্বল গাছ ও অনিশ্চিত ফলনের চিন্তা।', icon: '01' },
  { title: 'সমাধান', text: 'ভালো বীজ বাছাই থেকেই ভালো ফলনের শুরু।', icon: '02' },
  { title: 'আমাদের বীজ', text: 'বাছাইকৃত মানসম্মত বীজ, চাষের জন্য প্রস্তুত।', icon: '03' },
  { title: 'কেন আমাদের', text: 'নিরাপদ প্যাকিং, স্পষ্ট তথ্য ও সহায়ক সেবা।', icon: '04' },
  { title: 'চাষ পদ্ধতি', text: 'সহজ ধাপে কীভাবে চাষ করবেন তা দেখানো হবে।', icon: '05' },
  { title: 'অর্ডার করুন', text: 'পছন্দের প্যাকেজ নিন এবং ঘরে বসে অর্ডার করুন।', icon: '06' },
];

const fallbackBenefits: ContentCard[] = [
  { title: 'উচ্চ ফলনশীল', text: 'সঠিক পরিচর্যায় ভালো ফলনের সম্ভাবনা', icon: '🌱' },
  { title: 'রোগ প্রতিরোধী', text: 'ভালো মানের গাছ তৈরিতে সহায়ক', icon: '🛡️' },
  { title: 'লম্বা ও সরস', text: 'আকর্ষণীয় উৎপাদন ও বাজারজাতকরণে সহায়ক', icon: '🥬' },
  { title: 'সারা বছর চাহিদায়', text: 'বাজারের চাহিদা মাথায় রেখে প্যাকেজ', icon: '🗓️' },
  { title: 'অর্থনৈতিক লাভ', text: 'সঠিক চাষে ভালো রিটার্নের সুযোগ', icon: '💰' },
];

const fallbackCultivation: ContentCard[] = [
  { title: 'বীজ বপন', text: 'উপযুক্ত মাটিতে বীজ বপন করুন', icon: '01' },
  { title: 'সেচ দিন', text: 'প্রয়োজনমতো পানি ও পরিচর্যা দিন', icon: '02' },
  { title: 'সার প্রয়োগ', text: 'সঠিক সময়ে প্রয়োজনীয় সার প্রয়োগ করুন', icon: '03' },
  { title: 'পরিচর্যা', text: 'আগাছা ও পোকামাকড় নিয়মিত দেখুন', icon: '04' },
  { title: 'ফলন সংগ্রহ', text: 'উপযুক্ত সময়ে ফলন সংগ্রহ করুন', icon: '05' },
];

const fallbackTrust = [
  { title: 'সারা দেশে হোম ডেলিভারি', text: 'সুবিধাজনক ও নিরাপদ ডেলিভারি', icon: '🚚' },
  { title: '100% আসল বীজ', text: 'প্যাকেটজাত পণ্যে অরিজিনালিটির প্রতিশ্রুতি', icon: '🛡️' },
  { title: '7 দিনের রিপ্লেসমেন্ট', text: 'প্রযোজ্য ক্ষেত্রে রিপ্লেসমেন্ট সুবিধা', icon: '↺' },
  { title: 'নিরাপদ প্যাকেজিং', text: 'পণ্য সুরক্ষিতভাবে পাঠানোর ব্যবস্থা', icon: '📦' },
];

const ANIMATED_COPY_TRANSLATIONS: Record<string, { en: string; hi: string }> = {
  'সমস্যা': { en: 'The problem', hi: 'समस्या' },
  'সমাধান': { en: 'The solution', hi: 'समाधान' },
  'আমাদের বীজ': { en: 'Our seeds', hi: 'हमारे बीज' },
  'কেন আমাদের': { en: 'Why choose us', hi: 'हमें क्यों चुनें' },
  'চাষ পদ্ধতি': { en: 'Growing guide', hi: 'खेती का तरीका' },
  'অর্ডার করুন': { en: 'Order now', hi: 'ऑर्डर करें' },
  'কম ফলন, দুর্বল গাছ ও অনিশ্চিত ফলনের চিন্তা।': { en: 'Concerned about low yields, weak plants, and uncertain harvests?', hi: 'कम उपज, कमज़ोर पौधों और अनिश्चित फ़सल की चिंता?' },
  'ভালো বীজ বাছাই থেকেই ভালো ফলনের শুরু।': { en: 'A better harvest starts with carefully selected seeds.', hi: 'बेहतर फ़सल की शुरुआत चुने हुए बीजों से होती है।' },
  'বাছাইকৃত মানসম্মত বীজ, চাষের জন্য প্রস্তুত।': { en: 'Quality-selected seeds, ready for cultivation.', hi: 'चुनिंदा गुणवत्ता वाले बीज, खेती के लिए तैयार।' },
  'নিরাপদ প্যাকিং, স্পষ্ট তথ্য ও সহায়ক সেবা।': { en: 'Secure packaging, clear information, and helpful support.', hi: 'सुरक्षित पैकिंग, स्पष्ट जानकारी और उपयोगी सहायता।' },
  'সহজ ধাপে কীভাবে চাষ করবেন তা দেখানো হবে।': { en: 'Simple step-by-step growing instructions.', hi: 'खेती के आसान चरण-दर-चरण निर्देश।' },
  'পছন্দের প্যাকেজ নিন এবং ঘরে বসে অর্ডার করুন।': { en: 'Choose your package and order from home.', hi: 'अपना पैकेज चुनें और घर बैठे ऑर्डर करें।' },
  'উচ্চ ফলনশীল': { en: 'High yielding', hi: 'अधिक उपज देने वाला' },
  'সঠিক পরিচর্যায় ভালো ফলনের সম্ভাবনা': { en: 'Good yield potential with proper care', hi: 'सही देखभाल से बेहतर पैदावार की संभावना' },
  'রোগ প্রতিরোধী': { en: 'Disease resistant', hi: 'रोग प्रतिरोधी' },
  'ভালো মানের গাছ তৈরিতে সহায়ক': { en: 'Supports healthy plant growth', hi: 'स्वस्थ पौधों की बढ़त में सहायक' },
  'লম্বা ও সরস': { en: 'Long and juicy', hi: 'लंबे और रसदार' },
  'আকর্ষণীয় উৎপাদনে সহায়ক': { en: 'Helps produce an attractive harvest', hi: 'आकर्षक फ़सल पाने में सहायक' },
  'আকর্ষণীয় উৎপাদন ও বাজারজাতকরণে সহায়ক': { en: 'Suitable for attractive produce and market sales', hi: 'आकर्षक उपज और बाज़ार बिक्री के लिए उपयुक्त' },
  'সারা বছর চাহিদায়': { en: 'In demand year-round', hi: 'साल भर मांग में' },
  'বাজারের চাহিদা মাথায় রেখে': { en: 'Designed with market demand in mind', hi: 'बाज़ार की मांग को ध्यान में रखकर' },
  'বাজারের চাহিদা মাথায় রেখে প্যাকেজ': { en: 'Packages planned around market demand', hi: 'बाज़ार की मांग के अनुसार पैकेज' },
  'অর্থনৈতিক লাভ': { en: 'Better value', hi: 'बेहतर लाभ' },
  'সঠিক চাষে ভালো রিটার্নের সুযোগ': { en: 'Better return potential with good growing practices', hi: 'अच्छी खेती से बेहतर लाभ की संभावना' },
  'বীজ বপন': { en: 'Sowing', hi: 'बुवाई' },
  'উপযুক্ত মাটিতে বীজ বপন করুন': { en: 'Sow seeds in suitable soil', hi: 'उपयुक्त मिट्टी में बीज बोएँ' },
  'সেচ দিন': { en: 'Watering', hi: 'सिंचाई' },
  'প্রয়োজনমতো পানি দিন': { en: 'Water as needed', hi: 'ज़रूरत के अनुसार पानी दें' },
  'প্রয়োজনমতো পানি ও পরিচর্যা দিন': { en: 'Water and care for the plants as needed', hi: 'ज़रूरत के अनुसार पानी और देखभाल करें' },
  'সার প্রয়োগ': { en: 'Fertilizing', hi: 'खाद डालना' },
  'সঠিক সময়ে প্রয়োজনীয় সার দিন': { en: 'Apply suitable fertilizer at the right time', hi: 'सही समय पर उचित खाद डालें' },
  'সঠিক সময়ে প্রয়োজনীয় সার প্রয়োগ করুন': { en: 'Apply the required fertilizer at the right time', hi: 'सही समय पर आवश्यक खाद डालें' },
  'পরিচর্যা': { en: 'Plant care', hi: 'पौधों की देखभाल' },
  'নিয়মিত গাছ দেখুন': { en: 'Check your plants regularly', hi: 'पौधों की नियमित जाँच करें' },
  'আগাছা ও পোকামাকড় নিয়মিত দেখুন': { en: 'Check regularly for weeds and pests', hi: 'खरपतवार और कीटों की नियमित जाँच करें' },
  'ফলন সংগ্রহ': { en: 'Harvesting', hi: 'कटाई' },
  'উপযুক্ত সময়ে ফলন সংগ্রহ করুন': { en: 'Harvest at the right time', hi: 'सही समय पर कटाई करें' },
  'সারা দেশে হোম ডেলিভারি': { en: 'Home delivery nationwide', hi: 'देशभर में होम डिलीवरी' },
  'নিরাপদ ডেলিভারি': { en: 'Reliable delivery', hi: 'सुरक्षित डिलीवरी' },
  '100% আসল বীজ': { en: '100% genuine seeds', hi: '100% असली बीज' },
  'অরিজিনাল পণ্য': { en: 'Authentic products', hi: 'असली उत्पाद' },
  '7 দিনের রিপ্লেসমেন্ট': { en: '7-day replacement', hi: '7 दिन में रिप्लेसमेंट' },
  'প্রযোজ্য ক্ষেত্রে': { en: 'Where applicable', hi: 'जहाँ लागू हो' },
  'নিরাপদ প্যাকেজিং': { en: 'Secure packaging', hi: 'सुरक्षित पैकेजिंग' },
  'সুরক্ষিতভাবে পাঠানো': { en: 'Packed for safe delivery', hi: 'सुरक्षित डिलीवरी के लिए पैक' },
  'পণ্য সুরক্ষিতভাবে পাঠানোর ব্যবস্থা': { en: 'Carefully packed for safe delivery', hi: 'सुरक्षित डिलीवरी के लिए सावधानी से पैक' },
};

export default function AnimatedLandingPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug || '';

  const [page, setPage] = useState<any | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successNumber, setSuccessNumber] = useState('');
  const [country, setCountry] = useState<'IN' | 'BD'>('BD');
  const [paymentMethod, setPaymentMethod] = useState<IndiaPaymentMethod>('online');
  const [indiaDeliveryQuote, setIndiaDeliveryQuote] = useState<number | null>(null);
  const [indiaDeliveryQuoteLoading, setIndiaDeliveryQuoteLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('story');
  const [form, setForm] = useState({ name: '', phone: '', instructions: '' });
  const [address, setAddress] = useState<AddressValue>({ division: '', district: '', thana: '', detail: '', postalCode: '' });
  const { lang, t } = useLang();

  useEffect(() => {
    const updateCountry = () => setCountry(getVisitorCountry());
    updateCountry();
    window.addEventListener('gazi-country-changed', updateCountry);
    return () => window.removeEventListener('gazi-country-changed', updateCountry);
  }, []);

  const utm = useMemo(() => ({
    source: searchParams.get('utm_source') || '',
    medium: searchParams.get('utm_medium') || '',
    campaign: searchParams.get('utm_campaign') || slug,
    content: searchParams.get('utm_content') || '',
    term: searchParams.get('utm_term') || '',
    fbclid: searchParams.get('fbclid') || '',
    gclid: searchParams.get('gclid') || '',
  }), [searchParams, slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: landing } = await supabase
        .from('animated_landing_pages')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .eq('country_code', getVisitorCountry())
        .maybeSingle();

      if (!landing) {
        if (!cancelled) setLoading(false);
        return;
      }

      const [{ data: prod }, { data: pkg }] = await Promise.all([
        supabase.from('products').select('*').eq('id', landing.product_id).eq('is_active', true).eq('country_code', getVisitorCountry()).maybeSingle(),
        supabase.from('animated_landing_packages')
          .select('*')
          .eq('landing_page_id', landing.id)
          .eq('is_active', true)
          .eq('country_code', getVisitorCountry())
          .order('display_order', { ascending: true }),
      ]);

      if (cancelled) return;
      setPage(landing);
      setProduct(prod);
      const available = (pkg || []) as PackageOption[];
      setPackages(available);
      const defaultPkg = available.find((x) => x.is_default_selected) || available[0];
      if (defaultPkg) setSelectedPackageId(defaultPkg.id);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    const ids = ['story', 'benefits', 'cultivation', 'packages', 'testimonials'];
    const observers = ids.map((id) => {
      const node = document.getElementById(id);
      if (!node) return null;
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) setActiveSection(id);
      }, { rootMargin: '-35% 0px -50% 0px', threshold: 0 });
      observer.observe(node);
      return observer;
    });
    return () => observers.forEach((observer) => observer?.disconnect());
  }, [page]);

  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll('.sk-animate'));
    if (!reveals.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('sk-visible');
      });
    }, { threshold: 0.12 });
    reveals.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [loading, page]);

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) || packages[0] || null;
  const offerPrice = Number(selectedPackage?.offer_price || 0);
  const comparePrice = Number(selectedPackage?.compare_price || 0);
  const savings = Math.max(0, comparePrice - offerPrice);
  const fallbackDeliveryCharge = selectedPackage?.free_delivery
    ? 0
    : selectedPackage?.custom_delivery_charge != null
      ? Number(selectedPackage.custom_delivery_charge)
      : offerPrice >= 600 ? 0 : offerPrice >= 400 ? 50 : offerPrice >= 200 ? 70 : 120;
  const deliveryCharge = country === 'IN' && indiaDeliveryQuote !== null ? indiaDeliveryQuote : fallbackDeliveryCharge;
  const grandTotal = offerPrice + deliveryCharge;
  const codAdvance = deliveryCharge > 0 ? deliveryCharge : 120;
  const codDue = Math.max(0, grandTotal - codAdvance);

  useEffect(() => {
    let active = true;
    const loadIndiaDeliveryQuote = async () => {
      if (country !== 'IN' || !selectedPackage || offerPrice <= 0) {
        setIndiaDeliveryQuote(null);
        setIndiaDeliveryQuoteLoading(false);
        return;
      }
      if (selectedPackage.free_delivery) {
        setIndiaDeliveryQuote(0);
        setIndiaDeliveryQuoteLoading(false);
        return;
      }
      if (selectedPackage.custom_delivery_charge !== null && selectedPackage.custom_delivery_charge !== undefined) {
        setIndiaDeliveryQuote(Math.max(0, Number(selectedPackage.custom_delivery_charge)));
        setIndiaDeliveryQuoteLoading(false);
        return;
      }
      setIndiaDeliveryQuoteLoading(true);
      const { data, error: quoteError } = await supabase.rpc('calculate_delivery_charge', {
        p_order_value: offerPrice,
        p_free_delivery: false,
      });
      if (!active) return;
      const charge = Number(data);
      if (quoteError || data === null || !Number.isFinite(charge) || charge < 0) {
        setIndiaDeliveryQuote(null);
        setError(t('ডেলিভারি চার্জ যাচাই করা যায়নি। আবার চেষ্টা করুন।', 'Could not verify the delivery charge. Please try again.', 'डिलीवरी शुल्क की पुष्टि नहीं हो सकी। फिर कोशिश करें।'));
      } else {
        setIndiaDeliveryQuote(charge);
        setError('');
      }
      setIndiaDeliveryQuoteLoading(false);
    };
    void loadIndiaDeliveryQuote();
    return () => { active = false; };
  }, [country, selectedPackage, offerPrice, t]);

  const pageTranslation = page?.translations?.[lang] || {};
  const productTranslation = product?.translations?.[lang] || {};
  const localizeContent = (value?: string) => {
    if (!value || lang === 'bn') return value;
    return ANIMATED_COPY_TRANSLATIONS[value]?.[lang] || value;
  };
  const translateRows = <T extends { title?: string; text?: string }>(items: T[], prefix: string) => items.map((item, index) => ({
    ...item,
    title: pageTranslation[`${prefix}_${index}_title`] || localizeContent(item.title),
    text: pageTranslation[`${prefix}_${index}_text`] || localizeContent(item.text),
  }));
  const story: StoryStep[] = translateRows(
    Array.isArray(page?.story_steps) && page.story_steps.length ? page.story_steps : fallbackStory,
    'story',
  );
  const benefits: ContentCard[] = translateRows(
    Array.isArray(page?.benefits) && page.benefits.length ? page.benefits : fallbackBenefits,
    'benefit',
  );
  const cultivation: ContentCard[] = translateRows(
    Array.isArray(page?.cultivation_steps) && page.cultivation_steps.length ? page.cultivation_steps : fallbackCultivation,
    'cultivation',
  );
  const testimonials: Testimonial[] = (Array.isArray(page?.testimonials) ? page.testimonials : []).map((review: Testimonial, index: number) => ({
    ...review,
    name: pageTranslation[`testimonial_${index}_name`] || localizeContent(review.name),
    location: pageTranslation[`testimonial_${index}_location`] || localizeContent(review.location),
    text: pageTranslation[`testimonial_${index}_text`] || localizeContent(review.text),
  }));
  const trustItems: ContentCard[] = translateRows(
    Array.isArray(page?.trust_items) && page.trust_items.length ? page.trust_items : fallbackTrust,
    'trust',
  );
  const cleanCopy = (v: unknown) => { const x = typeof v === 'string' ? v.trim() : ''; return /^(?:[A-Z]{4,}(?:\s+[A-Z]{3,})*|TEST\w*|DEMO\w*)$/i.test(x) ? '' : x; };
  const heroTitle = cleanCopy(pageTranslation.hero_title) || cleanCopy(localizeContent(page?.hero_title)) || productTranslation.name || (lang === 'en' ? product?.name_en : lang === 'hi' ? product?.name_hi : product?.name_bn) || product?.name_en || t('মানসম্মত বীজ, ভালো ফলনের শুরু', 'Quality seeds for a better harvest', 'बेहतर फ़सल के लिए गुणवत्ता वाले बीज');
  const heroHighlight = cleanCopy(pageTranslation.hero_highlight) || cleanCopy(localizeContent(page?.hero_highlight)) || t('বেশি ফলন, বেশি লাভ!', 'Higher yield, better returns!', 'बेहतर उपज, बेहतर मुनाफ़ा!');
  const heroSubtitle = cleanCopy(pageTranslation.hero_subtitle) || cleanCopy(localizeContent(page?.hero_subtitle)) || productTranslation.short_description || localizeContent(product?.short_description) || t('সঠিক বীজ ও সঠিক পরিচর্যা—কৃষকের সফলতার প্রথম ধাপ।', 'Quality seeds and careful growing are the first steps to a better harvest.', 'अच्छे बीज और सही देखभाल बेहतर पैदावार की पहली सीढ़ी हैं।');
  const heroImage = page?.hero_image || product?.image || '';
  const heroBadge = cleanCopy(pageTranslation.hero_badge) || cleanCopy(page?.hero_badge) || t('মানসম্মত বীজ', 'Quality seeds', 'गुणवत्ता वाले बीज');
  const ctaLabel = cleanCopy(pageTranslation.cta_text) || t('অর্ডার করুন', 'Order now', 'ऑर्डर करें');
  const productName = pageTranslation.landing_name || productTranslation.name || (lang === 'en' ? product?.name_en : lang === 'hi' ? product?.name_hi : product?.name_bn) || product?.name_en || page?.landing_name || t('পণ্য', 'Product', 'उत्पाद');
  const packageName = (pkg: PackageOption, index: number) => {
    const localized = pageTranslation[`package_${index}_name`];
    if (localized) return localized;
    if (lang === 'en' && /[\u0980-\u09ff\u0966-\u096f]/.test(pkg.package_name || '')) {
      return `${pkg.quantity} ${pkg.quantity === 1 ? 'packet' : 'packets'}`;
    }
    if (lang === 'hi' && /[\u0980-\u09ff\u0966-\u096f]/.test(pkg.package_name || '')) return `${pkg.quantity} पैकेट`;
    return pkg.package_name || t(`${pkg.quantity} প্যাকেট`, `${pkg.quantity} ${pkg.quantity === 1 ? 'packet' : 'packets'}`, `${pkg.quantity} पैकेट`);
  };
  const packageBadge = (pkg: PackageOption, index: number) => pageTranslation[`package_${index}_badge`] || pkg.badge;

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const renderOrderCta = (target: 'packages' | 'order-form' = 'packages') => (
    <div className="flex justify-center px-5 py-6 sm:py-8">
      <button type="button" onClick={() => jump(target)} className="sk-shimmer rounded-2xl bg-gradient-to-r from-amber-300 via-lime-300 to-amber-200 px-7 py-3.5 font-black text-[#06150d] shadow-xl shadow-amber-500/10 transition hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600">
        <span className="relative z-10 inline-flex items-center gap-2">{ctaLabel} <ShoppingCart className="h-4 w-4" /></span>
      </button>
    </div>
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!selectedPackage) { setError(t('একটি প্যাকেজ নির্বাচন করুন', 'Please select a package', 'एक पैकेज चुनें')); return; }
    if (!form.name.trim() || !form.phone.trim()) { setError(t('নাম ও মোবাইল নম্বর দিন', 'Enter your name and mobile number', 'नाम और मोबाइल नंबर दर्ज करें')); return; }
    const phone = form.phone.replace(/[^0-9]/g, '');
    if (country === 'IN' ? !/^[6-9][0-9]{9}$/.test(phone) : !/^01[0-9]{9}$/.test(phone)) {
      setError(country === 'IN'
        ? t('সঠিক ১০ ডিজিটের ভারতীয় মোবাইল নম্বর দিন', 'Enter a valid 10-digit Indian mobile number', 'मान्य 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें')
        : t('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন', 'Enter a valid 11-digit Bangladesh mobile number', 'मान्य 11 अंकों का बांग्लादेशी मोबाइल नंबर दर्ज करें'));
      return;
    }
    if (!address.division || !address.district || !address.thana || !address.detail) { setError(t('সম্পূর্ণ ঠিকানা দিন', 'Enter your complete address', 'पूरा पता दर्ज करें')); return; }
    if (country === 'IN' && (indiaDeliveryQuoteLoading || indiaDeliveryQuote === null)) { setError(t('ডেলিভারি চার্জ যাচাই করা হচ্ছে। একটু পরে চেষ্টা করুন।', 'Delivery charge is being checked. Please try again shortly.', 'डिलीवरी शुल्क जाँचा जा रहा है। थोड़ी देर बाद फिर कोशिश करें।')); return; }

    setSubmitting(true);
    try {
      const fullAddress = formatAddressToString(address);
      if (country === 'IN') {
        if (paymentMethod === 'cod' && codAdvance > grandTotal) {
          setError(t('COD অগ্রিম অর্ডারের মোটের চেয়ে বেশি। অনলাইন পেমেন্ট বেছে নিন।', 'The COD advance is higher than the order total. Choose online payment.', 'COD अग्रिम राशि कुल ऑर्डर से अधिक है। ऑनलाइन भुगतान चुनें।'));
          return;
        }
        await startIndiaCampaignPayment({
          flow: 'animated',
          context: {
            landing_page_id: page.id,
            package_id: selectedPackage.id,
            utm_source: utm.source,
            utm_medium: utm.medium,
            utm_campaign: utm.campaign,
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
      const { data, error: rpcError } = await supabase.rpc('create_animated_landing_order', {
        p_landing_page_id: page.id,
        p_package_id: selectedPackage.id,
        p_customer_name: form.name.trim(),
        p_customer_phone: phone,
        p_delivery_address: fullAddress,
        p_delivery_zone_id: null,
        p_special_instructions: form.instructions.trim(),
        p_order_source: 'animated_landing',
        p_utm_source: utm.source,
        p_utm_medium: utm.medium,
        p_utm_campaign: utm.campaign,
        p_utm_content: utm.content,
        p_utm_term: utm.term,
        p_fbclid: utm.fbclid,
        p_gclid: utm.gclid,
      });
      if (rpcError) throw rpcError;
      if (!data?.success) { setError(data?.error || t('অর্ডার করা সম্ভব হয়নি', 'Could not place the order', 'ऑर्डर नहीं हो सका')); return; }
      setSuccessNumber(data.order_number || '');
      setForm({ name: '', phone: '', instructions: '' });
      setAddress({ division: '', district: '', thana: '', detail: '', postalCode: '' });
    } catch (err: any) {
      setError(err?.message || t('অর্ডার করতে সমস্যা হয়েছে', 'There was a problem placing the order', 'ऑर्डर करते समय समस्या हुई'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#06170f] text-white flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-lime-300" /></div>;
  }

  if (!page || !product) {
    return <div className="min-h-screen flex items-center justify-center bg-[#071b12] p-6 text-white"><div className="max-w-md text-center"><div className="text-6xl mb-4">🌱</div><h1 className="text-2xl font-bold">{t('ল্যান্ডিং পেজ পাওয়া যায়নি', 'Landing page not found', 'लैंडिंग पेज नहीं मिला')}</h1><p className="mt-2 text-white/70">{t('লিঙ্কটি হয়তো আর সক্রিয় নেই।', 'This link may no longer be active.', 'यह लिंक अब सक्रिय नहीं हो सकता।')}</p></div></div>;
  }

  const storyLinks = story.slice(0, 6).map((step, index) => ({ id: index === 0 ? 'story' : index === story.length - 1 ? 'packages' : `story-${index}`, label: step.title || `Scene ${index + 1}` }));

  return (
    <main className="min-h-screen bg-[#f8f4e8] text-[#0b1d13] selection:bg-lime-300 selection:text-[#04120b] overflow-x-hidden">
      <style jsx global>{`
        html { scroll-behavior: smooth; }
        .sk-animate { opacity: 0; transform: translateY(34px); transition: opacity .8s cubic-bezier(.22,.9,.25,1), transform .8s cubic-bezier(.22,.9,.25,1); }
        .sk-visible { opacity: 1; transform: translateY(0); }
        .sk-float { animation: skFloat 5s ease-in-out infinite; }
        .sk-pulse { animation: skPulse 2.4s ease-in-out infinite; }
        .sk-shimmer { position: relative; isolation: isolate; overflow: hidden; }
        .sk-shimmer::before { content: ''; position: absolute; z-index: 0; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,.22) 45%, transparent 65%); background-size: 200% 100%; animation: skShimmer 3.8s linear infinite; }
        .sk-reveal { animation: skReveal 1s cubic-bezier(.22,.9,.25,1) both; }
        .sk-delay-1 { animation-delay: .12s; } .sk-delay-2 { animation-delay: .24s; } .sk-delay-3 { animation-delay: .36s; }
        @keyframes skFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes skPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes skShimmer { from { background-position: -120% 0; } to { background-position: 120% 0; } }
        @keyframes skReveal { from { opacity:0; transform: translateY(22px) scale(.98); } to { opacity:1; transform: translateY(0) scale(1); } }
        @media (max-width: 767px) {
          /* Keep campaign content clear of global floating widgets on phones. */
          body:has(#story) button[aria-label="Change Website Theme"],
          body:has(#story) button[title="Change Website Theme"] { display: none !important; }
          body:has(#story) button[aria-label="এই পণ্য শেয়ার করুন"],
          body:has(#story) button[aria-label="Share this product"],
          body:has(#story) button[title="Share this product"],
          body:has(#story) button[aria-label="इस उत्पाद को शेयर करें"] { display: none !important; }
        }
        @media (max-width: 639px) {
          #story h1 { overflow-wrap: anywhere; }
          #story .sk-float { animation: none; }
          #packages { padding-bottom: 11rem; }
        }
        @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .001ms !important; } }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06140d]/95 backdrop-blur-xl text-white shadow-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300 text-[#062611] shadow-lg shadow-lime-500/20 sk-pulse"><Wheat className="h-6 w-6" /></div>
            <div><p className="text-[11px] uppercase tracking-[0.28em] text-lime-200/80">SUPER KING</p><p className="text-lg font-black tracking-wide">SEED</p></div>
          </div>
          <div className="hidden items-center gap-6 text-xs font-semibold text-white/80 lg:flex">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-lime-300" />{t('100% আসল বীজ', '100% genuine seeds', '100% असली बीज')}</span>
            <span className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-300" />{t('কৃষকের আস্থা', 'Trusted by growers', 'किसानों का भरोसा')}</span>
            <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-lime-300" />{t('৭ দিনের রিপ্লেসমেন্ট', '7-day replacement', '7-दिन का रिप्लेसमेंट')}</span>
          </div>
          <button onClick={() => jump('packages')} className="rounded-full bg-gradient-to-r from-lime-300 to-amber-300 px-4 py-2 text-xs font-extrabold text-[#07170d] shadow-lg shadow-lime-900/30 transition hover:scale-[1.03]">{t('অর্ডার করুন', 'Order now', 'अभी ऑर्डर करें')}</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 xl:grid-cols-[80px_minmax(0,1fr)]">
        <aside className="sticky top-[68px] hidden h-[calc(100vh-68px)] self-start border-r border-[#113221]/10 bg-[#082015] xl:block">
          <div className="flex h-full flex-col items-center py-6">
            <p className="mb-5 text-[10px] font-black tracking-[.25em] text-lime-300 [writing-mode:vertical-rl]">{t('আমাদের গল্প', 'OUR STORY', 'हमारी कहानी')}</p>
            <div className="flex flex-col items-center gap-1">
              {storyLinks.map((item, index) => {
                const active = activeSection === item.id || (index === 0 && activeSection === 'story');
                return <button key={`${item.label}-${index}`} onClick={() => jump(item.id)} className={`group flex w-[72px] flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center transition ${active ? 'bg-lime-300 text-[#06150d] shadow-lg shadow-lime-500/20' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-black ${active ? 'border-[#072010]' : 'border-white/20'}`}>{item.label.slice(0,2).toUpperCase()}</span><span className="text-[10px] font-bold leading-tight">{item.label}</span></button>;
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <section id="story" className="relative overflow-hidden bg-[#06170f] px-4 pb-12 pt-9 text-white sm:px-8 sm:py-14 lg:px-12 lg:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(155,255,71,.12),transparent_30%),radial-gradient(circle_at_10%_20%,rgba(255,199,71,.11),transparent_30%)]" />
            <div className="absolute inset-y-0 right-0 hidden w-2/3 bg-[linear-gradient(90deg,rgba(6,23,15,0),rgba(6,23,15,.06))] lg:block" />
            <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
              <div className="sk-reveal">
                <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-xs font-bold text-lime-200"><Sparkles className="h-4 w-4" />{heroBadge}</span>
                <h1 className="mt-5 max-w-3xl text-[clamp(1.9rem,8.2vw,2.65rem)] font-black leading-[1.16] tracking-tight sm:text-5xl lg:text-[3.5rem]">{heroTitle}<br /><span className="bg-gradient-to-r from-lime-300 via-lime-200 to-amber-200 bg-clip-text text-transparent">{heroHighlight}</span></h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:text-lg sm:leading-8">{heroSubtitle}</p>
                <div className="mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {(benefits.slice(0, 5)).map((item, index) => <div key={index} className={`sk-animate sk-delay-${(index % 3) + 1} rounded-2xl border border-white/10 bg-white/[.04] p-3 text-center backdrop-blur sm:p-4`}><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-xl">{item.icon || '🌱'}</div><p className="mt-2 text-sm font-bold leading-snug text-white/90">{item.title || ''}</p></div>)}
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-4"><button onClick={() => jump('packages')} className="sk-shimmer rounded-2xl bg-gradient-to-r from-amber-300 via-lime-300 to-amber-200 px-6 py-3.5 font-black text-[#06150d] shadow-xl shadow-amber-500/10 transition hover:scale-[1.02]"><span className="relative z-10">{ctaLabel} <ShoppingCart className="ml-2 inline h-4 w-4" /></span></button><button onClick={() => jump('benefits')} className="flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3.5 font-bold text-white/85 transition hover:bg-white/5">{t('বিস্তারিত দেখুন', 'Learn more', 'और जानें')} <ArrowDown className="h-4 w-4" /></button></div>
              </div>
              <div className="relative flex items-center justify-center lg:justify-end">
                <div className="absolute h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />
                <div className="relative w-full max-w-[540px] sk-float">
                  {heroImage ? <img src={heroImage} alt={productName} fetchPriority="high" decoding="async" className="relative z-10 mx-auto h-[min(390px,70vw)] w-full object-contain drop-shadow-[0_30px_70px_rgba(0,0,0,.45)] sm:h-[410px] lg:h-[450px]" /> : <div className="relative z-10 flex h-[420px] items-center justify-center rounded-[32px] border border-lime-300/20 bg-gradient-to-br from-[#103824] to-[#0a2417]"><Package className="h-28 w-28 text-lime-200/30" /></div>}
                  <div className="absolute right-0 top-10 z-20 rounded-3xl border border-amber-200/30 bg-[#09180f]/85 p-5 text-center shadow-2xl backdrop-blur-xl"><div className="text-xs font-black text-amber-200">{t('১০০% আসল', '100% genuine', '100% असली')}<br />{t('বীজ', 'SEED', 'बीज')}</div></div>
                  <div className="absolute bottom-4 left-0 z-20 rounded-3xl border border-lime-200/20 bg-[#0a1d13]/85 p-4 shadow-xl backdrop-blur-xl"><p className="text-2xl font-black text-lime-200">7000+</p><p className="text-xs font-bold text-white/60">{t('কৃষকের আস্থা', 'Farmers trust us', 'किसानों का भरोसा')}</p></div>
                </div>
              </div>
            </div>
          </section>
          {renderOrderCta()}

          <section id="benefits" className="bg-[#f8f4e8] px-5 py-14 sm:px-8 lg:px-12 lg:py-16">
            <div className="mx-auto max-w-6xl"><div className="sk-animate text-center"><span className="text-xs font-black uppercase tracking-[.3em] text-amber-700">{t('উন্নত মান', 'Premium quality', 'बेहतर गुणवत्ता')}</span><h2 className="mt-2 text-3xl font-black text-[#082015] sm:text-4xl">{t('সুপার কিং সীডের বিশেষ সুবিধা', 'Why choose Super King Seed', 'सुपर किंग सीड क्यों चुनें')}</h2><div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-lime-500 to-amber-400" /></div><div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{benefits.map((item, index) => <article key={index} className="sk-animate group rounded-3xl border border-[#113221]/10 bg-white p-6 text-center shadow-sm transition duration-500 hover:-translate-y-2 hover:shadow-xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf6e8] text-2xl transition group-hover:scale-110">{item.icon || '🌱'}</div><h3 className="mt-5 text-lg font-black text-[#0a2418]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#3b5948]">{item.text}</p></article>)}</div></div>
          </section>
          {renderOrderCta()}

          <section id="cultivation" className="border-y border-[#113221]/10 bg-[#fbf8f0] px-5 py-14 sm:px-8 lg:px-12 lg:py-16"><div className="mx-auto max-w-6xl"><div className="sk-animate text-center"><span className="text-xs font-black uppercase tracking-[.3em] text-lime-700">{t('সহজ চাষ', 'Easy cultivation', 'आसान खेती')}</span><h2 className="mt-2 text-3xl font-black text-[#082015] sm:text-4xl">{t('সহজ চাষ পদ্ধতি', 'How to grow', 'उगाने का तरीका')}</h2></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cultivation.map((item, index) => <div key={index} className="sk-animate relative rounded-3xl border border-[#113221]/10 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b6a31] text-xs font-black text-white">{item.icon || String(index + 1).padStart(2,'0')}</span>{index < cultivation.length - 1 && <ArrowRight className="hidden h-5 w-5 text-lime-700 lg:block" />}</div><div className="mt-5 flex h-20 items-center justify-center rounded-2xl bg-[#f2f6eb] text-4xl">{index === 0 ? '🌰' : index === 1 ? '💧' : index === 2 ? '🧺' : index === 3 ? '🌿' : '🥬'}</div><h3 className="mt-4 text-base font-black">{item.title}</h3><p className="mt-1 text-sm leading-6 text-[#56705f]">{item.text}</p></div>)}</div></div></section>
          {renderOrderCta()}

          <section id="packages" className="scroll-mt-24 bg-[#06170f] px-5 pt-14 pb-32 text-white sm:px-8 lg:px-12 lg:py-18 lg:pb-14"><div className="mx-auto max-w-6xl"><div className="sk-animate text-center"><span className="text-xs font-black uppercase tracking-[.3em] text-amber-300">{t('সেরা সাশ্রয়', 'Best value', 'सबसे बेहतर ऑफ़र')}</span><h2 className="mt-2 text-3xl font-black sm:text-4xl">{t('আপনার জন্য সেরা অফার', 'Choose your best offer', 'अपने लिए सबसे अच्छा ऑफ़र चुनें')}</h2><p className="mt-3 text-sm text-white/60">{t('একটি প্যাকেট নেবেন, নাকি বেশি সাশ্রয়ে বড় প্যাকেজ?', 'Choose one packet or save more with a larger pack.', 'एक पैकेट लें या बड़े पैक के साथ ज़्यादा बचत करें।')}</p></div><div className="mt-8 grid items-start gap-6 xl:grid-cols-[1.1fr_.9fr]">
            <div className="grid content-start items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">{packages.map((pkg, index) => { const active = pkg.id === selectedPackageId; const disabled = Number(product?.stock || 0) < pkg.quantity; return <button key={pkg.id} disabled={disabled} onClick={() => setSelectedPackageId(pkg.id)} aria-pressed={active} className={`relative h-fit self-start overflow-hidden rounded-[28px] border p-5 text-left transition duration-500 ${active ? 'border-lime-300 bg-white text-[#0a2418] shadow-2xl shadow-lime-500/10' : 'border-white/10 bg-white/[.03] hover:-translate-y-1 hover:border-lime-300/40'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>{packageBadge(pkg, index) && <span className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-black ${active ? 'bg-[#0b6a31] text-white' : 'bg-amber-300 text-[#1a2b1e]'}`}>{packageBadge(pkg, index)}</span>}<div className="flex items-center gap-3"><span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${active ? 'border-[#0b6a31] bg-[#0b6a31]' : 'border-white/25'}`}>{active && <Check className="h-4 w-4 text-white" />}</span><span className="text-sm font-black">{packageName(pkg, index)}</span></div><div className="mt-5 flex h-32 items-center justify-center rounded-2xl bg-[#edf6e8]">{heroImage ? <img src={heroImage} alt="" className="h-28 w-full object-contain" /> : <Package className="h-12 w-12 text-[#0b6a31]/30" />}</div><p className={`mt-5 text-xs font-semibold ${active ? 'text-[#557060]' : 'text-white/50'}`}>{productName}</p><div className="mt-2 flex items-end gap-2"><span className={`text-3xl font-black ${active ? 'text-[#0b6a31]' : 'text-lime-200'}`}>{formatPrice(pkg.offer_price)}</span>{pkg.compare_price ? <span className={`mb-1 text-sm line-through ${active ? 'text-[#7d8b81]' : 'text-white/35'}`}>{formatPrice(pkg.compare_price)}</span> : null}</div><div className={`mt-3 flex items-center gap-2 text-xs font-bold ${active ? 'text-[#0b6a31]' : 'text-lime-200'}`}>{pkg.free_delivery ? <><Truck className="h-4 w-4" /> {t('ফ্রি ডেলিভারি', 'Free delivery', 'मुफ़्त डिलीवरी')}</> : <><MapPin className="h-4 w-4" /> {t('ডেলিভারি প্রযোজ্য', 'Delivery applies', 'डिलीवरी शुल्क लागू')}</>}</div>{disabled && <div className="mt-3 text-xs font-bold text-red-500">{t('স্টক শেষ', 'Out of stock', 'स्टॉक समाप्त')}</div>}</button>})}</div>
            <button type="button" onClick={() => jump('order-form')} disabled={!selectedPackage || Number(product?.stock || 0) < (selectedPackage?.quantity || 1)} className="mt-2 flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-lime-300 to-amber-300 px-5 py-4 text-left font-black text-[#06170f] shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 xl:hidden"><span><span className="block text-xs font-bold opacity-75">{t('নির্বাচিত প্যাকেজ', 'Selected package', 'चुना गया पैकेज')}</span><span className="mt-1 block">{selectedPackage ? packageName(selectedPackage, packages.indexOf(selectedPackage)) : t('প্যাকেজ নির্বাচন করুন', 'Select a package', 'पैकेज चुनें')} · {formatPrice(offerPrice)}</span></span><span className="ml-3 inline-flex shrink-0 items-center gap-2">{t('চালিয়ে যান', 'Continue', 'आगे बढ़ें')} <ArrowRight className="h-5 w-5" /></span></button>

            <div id="order-form" className="scroll-mt-28 sk-animate rounded-[32px] border border-white/10 bg-[#fbf8f0] p-5 text-[#0a2418] shadow-2xl sm:p-7"><div className="rounded-2xl bg-[#0b6a31] px-5 py-4 text-white"><p className="text-sm font-bold">{t('অর্ডার করতে ফর্ম পূরণ করুন', 'Complete the form to order', 'ऑर्डर करने के लिए फ़ॉर्म भरें')}</p><p className="mt-1 text-xs text-white/70">{selectedPackage ? packageName(selectedPackage, packages.indexOf(selectedPackage)) : t('প্যাকেজ নির্বাচন করুন', 'Select a package', 'पैकेज चुनें')} · {formatPrice(offerPrice)}</p></div><form onSubmit={handleSubmit} className="mt-6 space-y-4"><label className="block text-sm font-bold">{t('নাম *', 'Full name *', 'पूरा नाम *')}<input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#173824]/10 bg-white px-4 py-3 outline-none transition focus:border-[#0b6a31] focus:ring-4 focus:ring-lime-100" placeholder={t('আপনার নাম লিখুন', 'Your full name', 'अपना पूरा नाम दर्ज करें')} /></label><label className="block text-sm font-bold">{t('মোবাইল নম্বর *', 'Mobile number *', 'मोबाइल नंबर *')}<input value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#173824]/10 bg-white px-4 py-3 outline-none transition focus:border-[#0b6a31] focus:ring-4 focus:ring-lime-100" placeholder={country === 'IN' ? '9876543210' : '01XXXXXXXXX'} inputMode="numeric" /></label><div className="rounded-2xl border border-[#173824]/10 bg-white p-3"><p className="mb-3 text-sm font-bold">{t('ডেলিভারি ঠিকানা *', 'Delivery address *', 'डिलीवरी का पता *')}</p><AddressSelector value={address} onChange={setAddress} countryCode={country} /></div>{country === 'IN' && <IndiaPaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} advanceAmount={codAdvance} dueAmount={codDue} codAvailable={!indiaDeliveryQuoteLoading && indiaDeliveryQuote !== null && codAdvance <= grandTotal} language={lang === 'hi' ? 'hi' : lang === 'en' ? 'en' : 'bn'} />}<label className="block text-sm font-bold">{t('বিশেষ নির্দেশনা', 'Special instructions', 'ख़ास निर्देश')}<input value={form.instructions} onChange={(e) => setForm((v) => ({ ...v, instructions: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#173824]/10 bg-white px-4 py-3 outline-none transition focus:border-[#0b6a31] focus:ring-4 focus:ring-lime-100" placeholder={t('প্রয়োজনে লিখুন', 'Add a note if needed', 'ज़रूरत हो तो नोट लिखें')} /></label><div className="rounded-2xl border border-[#173824]/10 bg-[#f3f7ec] p-4"><div className="flex items-center justify-between text-sm"><span>{t('প্যাকেজ', 'Package', 'पैकेज')}</span><strong>{formatPrice(offerPrice)}</strong></div><div className="mt-2 flex items-center justify-between text-sm"><span>{t('ডেলিভারি', 'Delivery', 'डिलीवरी')}</span><strong className={deliveryCharge === 0 ? 'text-[#0b6a31]' : ''}>{country === 'IN' && indiaDeliveryQuoteLoading ? t('হিসাব হচ্ছে…', 'Calculating…', 'गणना जारी…') : deliveryCharge === 0 ? t('ফ্রি', 'Free', 'मुफ़्त') : formatPrice(deliveryCharge)}</strong></div>{savings > 0 && <div className="mt-2 flex items-center justify-between text-sm"><span>{t('সাশ্রয়', 'You save', 'आपकी बचत')}</span><strong className="text-[#b54711]">{formatPrice(savings)}</strong></div>}<div className="mt-4 flex items-center justify-between border-t border-[#173824]/10 pt-4"><span className="font-black">{t('মোট পরিশোধ', 'Total', 'कुल')}</span><span className="text-3xl font-black text-[#0b6a31]">{formatPrice(grandTotal)}</span></div>{country === 'IN' && paymentMethod === 'cod' && <div className="mt-2 flex justify-between text-xs font-bold text-emerald-800"><span>{t('অগ্রিম / ডেলিভারিতে বাকি', 'Advance / due on delivery', 'अग्रिम / डिलीवरी पर बाकी')}</span><span>{formatPrice(codAdvance)} / {formatPrice(codDue)}</span></div>}</div>{error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}<button disabled={submitting || !selectedPackage || Number(product?.stock || 0) < (selectedPackage?.quantity || 1) || (country === 'IN' && indiaDeliveryQuoteLoading)} className="w-full rounded-2xl bg-gradient-to-r from-lime-300 to-amber-300 px-5 py-4 text-base font-black text-[#06170f] shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />{t('অর্ডার হচ্ছে...', 'Starting secure payment…', 'सुरक्षित भुगतान शुरू हो रहा है…')}</> : <><LockKeyhole className="mr-2 inline h-5 w-5" />{country === 'IN' ? (paymentMethod === 'cod' ? `${t('COD অগ্রিম', 'COD advance', 'COD अग्रिम')} ${formatPrice(codAdvance)}` : t('অনলাইনে পেমেন্ট করুন', 'Pay online', 'ऑनलाइन भुगतान करें')) : t('অর্ডার নিশ্চিত করুন', 'Confirm order', 'ऑर्डर की पुष्टि करें')}</>}</button><p className="flex items-center justify-center gap-2 text-[11px] font-semibold text-[#587060]"><ShieldCheck className="h-4 w-4" />{country === 'IN' ? t('Cashfree নিরাপদ পেমেন্ট · COD আছে', 'Cashfree secure payment · COD available', 'Cashfree सुरक्षित भुगतान · COD उपलब्ध') : t('ক্যাশ অন ডেলিভারি · নিরাপদ অর্ডার', 'Cash on delivery · Secure order', 'कैश ऑन डिलीवरी · सुरक्षित ऑर्डर')}</p></form></div>
          </div></div>
          </section>
          {renderOrderCta('order-form')}

          {successNumber && <section className="bg-lime-100 px-5 py-8"><div className="mx-auto flex max-w-3xl items-center gap-4 rounded-3xl border border-lime-200 bg-white p-5 shadow-lg"><CheckCircle2 className="h-10 w-10 text-[#0b6a31]" /><div><p className="text-xs font-black uppercase tracking-[.2em] text-lime-700">{t('অর্ডার নিশ্চিত', 'Order confirmed', 'ऑर्डर की पुष्टि')}</p><h3 className="mt-1 text-xl font-black text-[#082015]">{t('আপনার অর্ডার নম্বর:', 'Your order number:', 'आपका ऑर्डर नंबर:')} {successNumber}</h3><p className="mt-1 text-sm text-[#59705f]">{t('আমাদের টিম শিগগিরই আপনার সঙ্গে যোগাযোগ করবে।', 'Our team will contact you shortly.', 'हमारी टीम जल्द आपसे संपर्क करेगी।')}</p></div></div></section>}

          {testimonials.length > 0 && (
            <section id="testimonials" className="bg-[#fbf8f0] px-5 py-14 sm:px-8 lg:px-12 lg:py-16">
              <div className="mx-auto max-w-6xl">
                <div className="sk-animate text-center">
                  <span className="text-xs font-black uppercase tracking-[.3em] text-amber-700">{t('বিশ্বাস', 'Trusted by growers', 'किसानों का भरोसा')}</span>
                  <h2 className="mt-2 text-3xl font-black sm:text-4xl">{t('কৃষকদের ভালোবাসা', 'What growers say', 'किसानों की राय')}</h2>
                </div>
                <div className="mt-10 grid gap-5 md:grid-cols-3">
                  {testimonials.slice(0, 3).map((review, index) => (
                    <article key={index} className="sk-animate rounded-3xl border border-[#113221]/10 bg-white p-6 shadow-sm">
                      <div className="flex items-center gap-3">
                        {review.image ? <img src={review.image} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#edf6e8] font-black text-[#0b6a31]">{(review.name || t('কৃষক', 'Grower', 'किसान')).slice(0, 1)}</div>}
                        <div><p className="font-black">{review.name || t('কৃষক', 'Grower', 'किसान')}</p><p className="text-xs text-[#63766a]">{review.location || t('বাংলাদেশ', 'Bangladesh', 'बांग्लादेश')}</p></div>
                      </div>
                      <div className="mt-4 flex gap-1 text-amber-400">{Array.from({ length: Math.max(1, Math.min(5, Number(review.rating || 5))) }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                      <p className="mt-4 text-sm leading-7 text-[#486151]">“{review.text || ''}”</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
          {testimonials.length > 0 && renderOrderCta()}
          <section className="bg-[#0a2918] px-5 py-10 text-white sm:px-8 lg:px-12"><div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-4">{trustItems.slice(0,4).map((item, index) => <div key={index} className="sk-animate flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-300/10 text-xl">{item.icon || '✓'}</div><div><p className="text-sm font-black">{item.title}</p><p className="mt-1 text-xs text-white/55">{item.text}</p></div></div>)}</div></section>
          {renderOrderCta()}

          <footer className="bg-[#06170f] px-5 py-6 text-center text-xs text-white/40 sm:px-8"><div className="flex flex-wrap items-center justify-center gap-5"><span className="flex items-center gap-2"><Phone className="h-4 w-4" /> {t('সহায়তা', 'Support', 'सहायता')}</span><span className="flex items-center gap-2"><Truck className="h-4 w-4" /> {t('ডেলিভারি', 'Delivery', 'डिलीवरी')}</span><span className="flex items-center gap-2"><Users className="h-4 w-4" /> {t('কৃষক সেবা', 'Grower care', 'किसान सेवा')}</span><span className="flex items-center gap-2"><Gift className="h-4 w-4" /> {t('বিশেষ অফার', 'Special offers', 'ख़ास ऑफ़र')}</span></div><p className="mt-4">© {new Date().getFullYear()} SUPER KING SEED · Animated Landing Page</p></footer>
        </div>
      </div>

      <div className="fixed bottom-20 left-3 right-3 z-30 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#07180f]/90 p-2 shadow-2xl backdrop-blur-xl lg:hidden"><button onClick={() => jump('story')} className="rounded-full px-3 py-2 text-xs font-bold text-white/70">{t('গল্প', 'Story', 'कहानी')}</button><button onClick={() => jump('benefits')} className="rounded-full px-3 py-2 text-xs font-bold text-white/70">{t('সুবিধা', 'Benefits', 'फ़ायदे')}</button><button onClick={() => jump('packages')} className="rounded-xl bg-lime-300 px-5 py-3 text-sm font-black text-[#07180f]">{t('অর্ডার', 'Order', 'ऑर्डर')}</button></div>
    </main>
  );
}
