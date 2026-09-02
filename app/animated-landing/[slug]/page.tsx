'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AddressSelector, formatAddressToString, type AddressValue } from '@/components/site/address-selector';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
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
  const [activeSection, setActiveSection] = useState('story');
  const [form, setForm] = useState({ name: '', phone: '', instructions: '' });
  const [address, setAddress] = useState<AddressValue>({ division: '', district: '', thana: '', detail: '', postalCode: '' });

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
        .maybeSingle();

      if (!landing) {
        if (!cancelled) setLoading(false);
        return;
      }

      const [{ data: prod }, { data: pkg }] = await Promise.all([
        supabase.from('products').select('*').eq('id', landing.product_id).eq('is_active', true).maybeSingle(),
        supabase.from('animated_landing_packages')
          .select('*')
          .eq('landing_page_id', landing.id)
          .eq('is_active', true)
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
  const deliveryCharge = selectedPackage?.free_delivery
    ? 0
    : selectedPackage?.custom_delivery_charge != null
      ? Number(selectedPackage.custom_delivery_charge)
      : offerPrice >= 600 ? 0 : offerPrice >= 400 ? 50 : offerPrice >= 200 ? 70 : 120;
  const grandTotal = offerPrice + deliveryCharge;

  const story: StoryStep[] = Array.isArray(page?.story_steps) && page.story_steps.length ? page.story_steps : fallbackStory;
  const benefits: ContentCard[] = Array.isArray(page?.benefits) && page.benefits.length ? page.benefits : fallbackBenefits;
  const cultivation: ContentCard[] = Array.isArray(page?.cultivation_steps) && page.cultivation_steps.length ? page.cultivation_steps : fallbackCultivation;
  const testimonials: Testimonial[] = Array.isArray(page?.testimonials) ? page.testimonials : [];
  const trustItems: ContentCard[] = Array.isArray(page?.trust_items) && page.trust_items.length ? page.trust_items : fallbackTrust;
  const heroTitle = page?.hero_title || product?.name_bn || 'মানসম্মত বীজ, ভালো ফলনের শুরু';
  const heroHighlight = page?.hero_highlight || 'বেশি ফলন, বেশি লাভ!';
  const heroSubtitle = page?.hero_subtitle || product?.short_description || 'সঠিক বীজ ও সঠিক পরিচর্যা—কৃষকের সফলতার প্রথম ধাপ।';
  const heroImage = page?.hero_image || product?.image || '';
  const productName = product?.name_bn || product?.name_en || 'SUPER KING SEED';

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!selectedPackage) { setError('একটি প্যাকেজ নির্বাচন করুন'); return; }
    if (!form.name.trim() || !form.phone.trim()) { setError('নাম ও মোবাইল নম্বর দিন'); return; }
    const phone = form.phone.replace(/[^0-9]/g, '');
    if (!/^01[0-9]{9}$/.test(phone)) { setError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন'); return; }
    if (!address.division || !address.district || !address.thana || !address.detail) { setError('সম্পূর্ণ ঠিকানা দিন'); return; }

    setSubmitting(true);
    try {
      const fullAddress = formatAddressToString(address);
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
      if (!data?.success) { setError(data?.error || 'অর্ডার করা সম্ভব হয়নি'); return; }
      setSuccessNumber(data.order_number || '');
      setForm({ name: '', phone: '', instructions: '' });
      setAddress({ division: '', district: '', thana: '', detail: '', postalCode: '' });
    } catch (err: any) {
      setError(err?.message || 'অর্ডার করতে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#06170f] text-white flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-lime-300" /></div>;
  }

  if (!page || !product) {
    return <div className="min-h-screen flex items-center justify-center bg-[#071b12] p-6 text-white"><div className="max-w-md text-center"><div className="text-6xl mb-4">🌱</div><h1 className="text-2xl font-bold">ল্যান্ডিং পেজ পাওয়া যায়নি</h1><p className="mt-2 text-white/70">লিঙ্কটি হয়তো আর সক্রিয় নেই।</p></div></div>;
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
        .sk-shimmer { background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,.15) 45%, transparent 65%); background-size: 200% 100%; animation: skShimmer 3.8s linear infinite; }
        .sk-reveal { animation: skReveal 1s cubic-bezier(.22,.9,.25,1) both; }
        .sk-delay-1 { animation-delay: .12s; } .sk-delay-2 { animation-delay: .24s; } .sk-delay-3 { animation-delay: .36s; }
        @keyframes skFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes skPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes skShimmer { from { background-position: -120% 0; } to { background-position: 120% 0; } }
        @keyframes skReveal { from { opacity:0; transform: translateY(22px) scale(.98); } to { opacity:1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .001ms !important; } }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06140d]/95 backdrop-blur-xl text-white shadow-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300 text-[#062611] shadow-lg shadow-lime-500/20 sk-pulse"><Wheat className="h-6 w-6" /></div>
            <div><p className="text-[11px] uppercase tracking-[0.28em] text-lime-200/80">SUPER KING</p><p className="text-lg font-black tracking-wide">SEED</p></div>
          </div>
          <div className="hidden items-center gap-6 text-xs font-semibold text-white/80 lg:flex">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-lime-300" />100% Original Seed</span>
            <span className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-300" />Farmers Trusted</span>
            <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-lime-300" />7 Days Replacement</span>
          </div>
          <button onClick={() => jump('packages')} className="rounded-full bg-gradient-to-r from-lime-300 to-amber-300 px-4 py-2 text-xs font-extrabold text-[#07170d] shadow-lg shadow-lime-900/30 transition hover:scale-[1.03]">অর্ডার করুন</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[112px_minmax(0,1fr)]">
        <aside className="sticky top-[68px] hidden h-[calc(100vh-68px)] self-start border-r border-[#113221]/10 bg-[#082015] lg:block">
          <div className="flex h-full flex-col items-center py-6">
            <p className="mb-5 text-[10px] font-black tracking-[.25em] text-lime-300 [writing-mode:vertical-rl]">OUR STORY</p>
            <div className="flex flex-col items-center gap-1">
              {storyLinks.map((item, index) => {
                const active = activeSection === item.id || (index === 0 && activeSection === 'story');
                return <button key={`${item.label}-${index}`} onClick={() => jump(item.id)} className={`group flex w-20 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition ${active ? 'bg-lime-300 text-[#06150d] shadow-lg shadow-lime-500/20' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-black ${active ? 'border-[#072010]' : 'border-white/20'}`}>{item.label.slice(0,2).toUpperCase()}</span><span className="text-[10px] font-bold leading-tight">{item.label}</span></button>;
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <section id="story" className="relative overflow-hidden bg-[#06170f] px-5 py-14 text-white sm:px-8 lg:min-h-[680px] lg:px-16 lg:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(155,255,71,.12),transparent_30%),radial-gradient(circle_at_10%_20%,rgba(255,199,71,.11),transparent_30%)]" />
            <div className="absolute inset-y-0 right-0 hidden w-2/3 bg-[linear-gradient(90deg,rgba(6,23,15,0),rgba(6,23,15,.06))] lg:block" />
            <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
              <div className="sk-reveal">
                <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-xs font-bold text-lime-200"><Sparkles className="h-4 w-4" />{page?.hero_badge || 'বিশেষ অফার'}</span>
                <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.04] sm:text-5xl lg:text-6xl">{heroTitle}<br /><span className="bg-gradient-to-r from-lime-300 via-lime-200 to-amber-200 bg-clip-text text-transparent">{heroHighlight}</span></h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">{heroSubtitle}</p>
                <div className="mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-5">
                  {(benefits.slice(0, 5)).map((item, index) => <div key={index} className={`sk-animate sk-delay-${(index % 3) + 1} rounded-2xl border border-white/10 bg-white/[.04] p-4 text-center backdrop-blur`}><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-xl">{item.icon || '🌱'}</div><p className="mt-2 text-xs font-bold leading-tight text-white/90">{item.title || ''}</p></div>)}
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-4"><button onClick={() => jump('packages')} className="sk-shimmer rounded-2xl bg-gradient-to-r from-amber-300 via-lime-300 to-amber-200 px-6 py-3.5 font-black text-[#06150d] shadow-xl shadow-amber-500/10 transition hover:scale-[1.02]">অর্ডার করুন এখনই <ShoppingCart className="ml-2 inline h-4 w-4" /></button><button onClick={() => jump('benefits')} className="flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3.5 font-bold text-white/85 transition hover:bg-white/5">বিস্তারিত দেখুন <ArrowDown className="h-4 w-4" /></button></div>
              </div>
              <div className="relative flex items-center justify-center lg:justify-end">
                <div className="absolute h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />
                <div className="relative w-full max-w-[540px] sk-float">
                  {heroImage ? <img src={heroImage} alt={productName} className="relative z-10 mx-auto h-[390px] w-full object-contain drop-shadow-[0_30px_70px_rgba(0,0,0,.45)] sm:h-[460px]" /> : <div className="relative z-10 flex h-[420px] items-center justify-center rounded-[32px] border border-lime-300/20 bg-gradient-to-br from-[#103824] to-[#0a2417]"><Package className="h-28 w-28 text-lime-200/30" /></div>}
                  <div className="absolute right-0 top-10 z-20 rounded-3xl border border-amber-200/30 bg-[#09180f]/85 p-5 text-center shadow-2xl backdrop-blur-xl"><div className="text-xs font-black text-amber-200">100%<br />ORIGINAL</div><div className="mt-1 text-[10px] uppercase tracking-[.22em] text-white/50">SEED</div></div>
                  <div className="absolute bottom-4 left-0 z-20 rounded-3xl border border-lime-200/20 bg-[#0a1d13]/85 p-4 shadow-xl backdrop-blur-xl"><p className="text-2xl font-black text-lime-200">7000+</p><p className="text-xs font-bold text-white/60">কৃষকের আস্থা</p></div>
                </div>
              </div>
            </div>
          </section>

          <section id="benefits" className="bg-[#f8f4e8] px-5 py-14 sm:px-8 lg:px-12 lg:py-16">
            <div className="mx-auto max-w-6xl"><div className="sk-animate text-center"><span className="text-xs font-black uppercase tracking-[.3em] text-amber-700">Premium quality</span><h2 className="mt-2 text-3xl font-black text-[#082015] sm:text-4xl">সুপার কিং সীডের বিশেষ সুবিধা</h2><div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-lime-500 to-amber-400" /></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{benefits.map((item, index) => <article key={index} className="sk-animate group rounded-3xl border border-[#113221]/10 bg-white p-6 text-center shadow-sm transition duration-500 hover:-translate-y-2 hover:shadow-xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf6e8] text-2xl transition group-hover:scale-110">{item.icon || '🌱'}</div><h3 className="mt-5 text-lg font-black text-[#0a2418]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#3b5948]">{item.text}</p></article>)}</div></div>
          </section>

          <section id="cultivation" className="border-y border-[#113221]/10 bg-[#fbf8f0] px-5 py-14 sm:px-8 lg:px-12 lg:py-16"><div className="mx-auto max-w-6xl"><div className="sk-animate text-center"><span className="text-xs font-black uppercase tracking-[.3em] text-lime-700">Easy cultivation</span><h2 className="mt-2 text-3xl font-black text-[#082015] sm:text-4xl">সহজ চাষ পদ্ধতি</h2></div><div className="mt-10 grid gap-5 lg:grid-cols-5">{cultivation.map((item, index) => <div key={index} className="sk-animate relative rounded-3xl border border-[#113221]/10 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b6a31] text-xs font-black text-white">{item.icon || String(index + 1).padStart(2,'0')}</span>{index < cultivation.length - 1 && <ArrowRight className="hidden h-5 w-5 text-lime-700 lg:block" />}</div><div className="mt-5 flex h-20 items-center justify-center rounded-2xl bg-[#f2f6eb] text-4xl">{index === 0 ? '🌰' : index === 1 ? '💧' : index === 2 ? '🧺' : index === 3 ? '🌿' : '🥬'}</div><h3 className="mt-4 text-base font-black">{item.title}</h3><p className="mt-1 text-sm leading-6 text-[#56705f]">{item.text}</p></div>)}</div></div></section>

          <section id="packages" className="scroll-mt-24 bg-[#06170f] px-5 py-14 text-white sm:px-8 lg:px-12 lg:py-18"><div className="mx-auto max-w-6xl"><div className="sk-animate text-center"><span className="text-xs font-black uppercase tracking-[.3em] text-amber-300">Best value</span><h2 className="mt-2 text-3xl font-black sm:text-4xl">আপনার জন্য সেরা অফার</h2><p className="mt-3 text-sm text-white/60">একটি প্যাকেট নেবেন, নাকি বেশি সাশ্রয়ে বড় প্যাকেজ?</p></div><div className="mt-10 grid gap-7 xl:grid-cols-[1.1fr_.9fr]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{packages.map((pkg, index) => { const active = pkg.id === selectedPackageId; const disabled = Number(product?.stock || 0) < pkg.quantity; return <button key={pkg.id} disabled={disabled} onClick={() => setSelectedPackageId(pkg.id)} className={`sk-animate relative overflow-hidden rounded-[28px] border p-5 text-left transition duration-500 ${active ? 'border-lime-300 bg-white text-[#0a2418] shadow-2xl shadow-lime-500/10' : 'border-white/10 bg-white/[.03] hover:-translate-y-1 hover:border-lime-300/40'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>{pkg.badge && <span className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-black ${active ? 'bg-[#0b6a31] text-white' : 'bg-amber-300 text-[#1a2b1e]'}`}>{pkg.badge}</span>}<div className="flex items-center gap-3"><span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${active ? 'border-[#0b6a31] bg-[#0b6a31]' : 'border-white/25'}`}>{active && <Check className="h-4 w-4 text-white" />}</span><span className="text-sm font-black">{pkg.package_name || `${pkg.quantity} প্যাকেট`}</span></div><div className="mt-5 flex h-32 items-center justify-center rounded-2xl bg-[#edf6e8]">{heroImage ? <img src={heroImage} alt="" className="h-28 w-full object-contain" /> : <Package className="h-12 w-12 text-[#0b6a31]/30" />}</div><p className={`mt-5 text-xs font-semibold ${active ? 'text-[#557060]' : 'text-white/50'}`}>{productName}</p><div className="mt-2 flex items-end gap-2"><span className={`text-3xl font-black ${active ? 'text-[#0b6a31]' : 'text-lime-200'}`}>{formatPrice(pkg.offer_price)}</span>{pkg.compare_price ? <span className={`mb-1 text-sm line-through ${active ? 'text-[#7d8b81]' : 'text-white/35'}`}>{formatPrice(pkg.compare_price)}</span> : null}</div><div className={`mt-3 flex items-center gap-2 text-xs font-bold ${active ? 'text-[#0b6a31]' : 'text-lime-200'}`}>{pkg.free_delivery ? <><Truck className="h-4 w-4" /> ফ্রি ডেলিভারি</> : <><MapPin className="h-4 w-4" /> ডেলিভারি প্রযোজ্য</>}</div>{disabled && <div className="mt-3 text-xs font-bold text-red-500">স্টক শেষ</div>}</button>})}</div>

            <div className="sk-animate rounded-[32px] border border-white/10 bg-[#fbf8f0] p-5 text-[#0a2418] shadow-2xl sm:p-7"><div className="rounded-2xl bg-[#0b6a31] px-5 py-4 text-white"><p className="text-sm font-bold">অর্ডার করতে ফর্ম পূরণ করুন</p><p className="mt-1 text-xs text-white/70">{selectedPackage?.package_name || 'প্যাকেজ নির্বাচন করুন'} · {formatPrice(offerPrice)}</p></div><form onSubmit={handleSubmit} className="mt-6 space-y-4"><label className="block text-sm font-bold">নাম *<input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#173824]/10 bg-white px-4 py-3 outline-none transition focus:border-[#0b6a31] focus:ring-4 focus:ring-lime-100" placeholder="আপনার নাম লিখুন" /></label><label className="block text-sm font-bold">মোবাইল নম্বর *<input value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#173824]/10 bg-white px-4 py-3 outline-none transition focus:border-[#0b6a31] focus:ring-4 focus:ring-lime-100" placeholder="01XXXXXXXXX" inputMode="numeric" /></label><div className="rounded-2xl border border-[#173824]/10 bg-white p-3"><p className="mb-3 text-sm font-bold">ডেলিভারি ঠিকানা *</p><AddressSelector value={address} onChange={setAddress} /></div><label className="block text-sm font-bold">বিশেষ নির্দেশনা<input value={form.instructions} onChange={(e) => setForm((v) => ({ ...v, instructions: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#173824]/10 bg-white px-4 py-3 outline-none transition focus:border-[#0b6a31] focus:ring-4 focus:ring-lime-100" placeholder="প্রয়োজনে লিখুন" /></label><div className="rounded-2xl border border-[#173824]/10 bg-[#f3f7ec] p-4"><div className="flex items-center justify-between text-sm"><span>প্যাকেজ</span><strong>{formatPrice(offerPrice)}</strong></div><div className="mt-2 flex items-center justify-between text-sm"><span>ডেলিভারি</span><strong className={deliveryCharge === 0 ? 'text-[#0b6a31]' : ''}>{deliveryCharge === 0 ? 'ফ্রি' : formatPrice(deliveryCharge)}</strong></div>{savings > 0 && <div className="mt-2 flex items-center justify-between text-sm"><span>সাশ্রয়</span><strong className="text-[#b54711]">{formatPrice(savings)}</strong></div>}<div className="mt-4 flex items-center justify-between border-t border-[#173824]/10 pt-4"><span className="font-black">মোট পরিশোধ</span><span className="text-3xl font-black text-[#0b6a31]">{formatPrice(grandTotal)}</span></div></div>{error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}<button disabled={submitting || !selectedPackage || Number(product?.stock || 0) < (selectedPackage?.quantity || 1)} className="w-full rounded-2xl bg-gradient-to-r from-lime-300 to-amber-300 px-5 py-4 text-base font-black text-[#06170f] shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />অর্ডার হচ্ছে...</> : <><LockKeyhole className="mr-2 inline h-5 w-5" />অর্ডার নিশ্চিত করুন</>}</button><p className="flex items-center justify-center gap-2 text-[11px] font-semibold text-[#587060]"><ShieldCheck className="h-4 w-4" /> ক্যাশ অন ডেলিভারি · নিরাপদ অর্ডার</p></form></div>
          </div></div>
          </section>

          {successNumber && <section className="bg-lime-100 px-5 py-8"><div className="mx-auto flex max-w-3xl items-center gap-4 rounded-3xl border border-lime-200 bg-white p-5 shadow-lg"><CheckCircle2 className="h-10 w-10 text-[#0b6a31]" /><div><p className="text-xs font-black uppercase tracking-[.2em] text-lime-700">Order confirmed</p><h3 className="mt-1 text-xl font-black text-[#082015]">আপনার অর্ডার নম্বর: {successNumber}</h3><p className="mt-1 text-sm text-[#59705f]">আমাদের টিম শিগগিরই আপনার সঙ্গে যোগাযোগ করবে।</p></div></div></section>}

          <section id="testimonials" className="bg-[#fbf8f0] px-5 py-14 sm:px-8 lg:px-12 lg:py-16"><div className="mx-auto max-w-6xl"><div className="sk-animate text-center"><span className="text-xs font-black uppercase tracking-[.3em] text-amber-700">Trust</span><h2 className="mt-2 text-3xl font-black sm:text-4xl">কৃষকদের ভালোবাসা</h2></div>{testimonials.length ? <div className="mt-10 grid gap-5 md:grid-cols-3">{testimonials.slice(0,3).map((review, index) => <article key={index} className="sk-animate rounded-3xl border border-[#113221]/10 bg-white p-6 shadow-sm"><div className="flex items-center gap-3">{review.image ? <img src={review.image} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#edf6e8] font-black text-[#0b6a31]">{(review.name || 'কৃ').slice(0,1)}</div>}<div><p className="font-black">{review.name || 'কৃষক'}</p><p className="text-xs text-[#63766a]">{review.location || 'বাংলাদেশ'}</p></div></div><div className="mt-4 flex gap-1 text-amber-400">{Array.from({ length: Math.max(1, Math.min(5, Number(review.rating || 5))) }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div><p className="mt-4 text-sm leading-7 text-[#486151]">“{review.text || ''}”</p></article>)}</div> : <div className="mt-10 rounded-3xl border border-dashed border-[#113221]/15 bg-white p-10 text-center text-sm text-[#5c6f62]">Admin থেকে customer testimonial যোগ করলে এখানে সুন্দরভাবে দেখাবে।</div>}</div></section>

          <section className="bg-[#0a2918] px-5 py-10 text-white sm:px-8 lg:px-12"><div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-4">{trustItems.slice(0,4).map((item, index) => <div key={index} className="sk-animate flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-300/10 text-xl">{item.icon || '✓'}</div><div><p className="text-sm font-black">{item.title}</p><p className="mt-1 text-xs text-white/55">{item.text}</p></div></div>)}</div></section>

          <footer className="bg-[#06170f] px-5 py-6 text-center text-xs text-white/40 sm:px-8"><div className="flex flex-wrap items-center justify-center gap-5"><span className="flex items-center gap-2"><Phone className="h-4 w-4" /> সহায়তা</span><span className="flex items-center gap-2"><Truck className="h-4 w-4" /> ডেলিভারি</span><span className="flex items-center gap-2"><Users className="h-4 w-4" /> কৃষক সেবা</span><span className="flex items-center gap-2"><Gift className="h-4 w-4" /> বিশেষ অফার</span></div><p className="mt-4">© {new Date().getFullYear()} SUPER KING SEED · Animated Landing Page</p></footer>
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#07180f]/90 p-2 shadow-2xl backdrop-blur-xl lg:hidden"><button onClick={() => jump('story')} className="rounded-full px-3 py-2 text-xs font-bold text-white/70">Story</button><button onClick={() => jump('benefits')} className="rounded-full px-3 py-2 text-xs font-bold text-white/70">Benefits</button><button onClick={() => jump('packages')} className="rounded-full bg-lime-300 px-4 py-2 text-xs font-black text-[#07180f]">Order</button></div>
    </main>
  );
}
