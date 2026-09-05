'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, ChevronDown, ShieldCheck, ShoppingCart, Sparkles, Star, Truck, Zap } from 'lucide-react';
import { getEffectivePrice, getLandingPageBySlug, getProductBySlug, getReviews, trackLandingPageView } from '@/lib/data';
import { addToCart } from '@/lib/cart';
import type { LandingPage, Product, Review } from '@/lib/supabase/types';
import { toast } from '@/components/site/toast-provider';

export default function AdsLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [landing, setLanding] = useState<LandingPage | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);

      let resolvedLanding: LandingPage | null = null;
      let resolvedProduct: Product | null = null;

      const byLanding = await getLandingPageBySlug(slug);
      if (byLanding.landing && byLanding.product) {
        resolvedLanding = byLanding.landing;
        resolvedProduct = byLanding.product;
      } else {
        resolvedProduct = await getProductBySlug(slug);
      }

      if (!active) return;
      setLanding(resolvedLanding);
      setProduct(resolvedProduct);

      if (resolvedProduct) {
        getReviews(resolvedProduct.id).then((items) => active && setReviews(items));
      }

      if (resolvedLanding) {
        const utm: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          if (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'].includes(key)) {
            utm[key] = value;
          }
        });
        trackLandingPageView(resolvedLanding.id, utm);
      }

      setLoading(false);
    };

    if (slug) void load();
    return () => { active = false; };
  }, [slug, searchParams]);

  const price = product ? (landing?.offer_price ?? getEffectivePrice(product)) : 0;
  const comparePrice = product ? (landing?.compare_price ?? (product.regular_price > price ? product.regular_price : 0)) : 0;
  const discount = comparePrice > price ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  const images = product?.images?.length ? product.images : product?.image ? [product.image] : [];
  const heroImage = landing?.images?.[0] || images[0] || '';
  const productName = product?.name_bn || product?.name_en || 'Premium Seed';
  const headline = landing?.offer_headline || landing?.title || 'ভালো ফলনের শুরু হোক ভালো বীজ দিয়ে';
  const subtitle = landing?.subtitle || product?.short_description || 'নির্বাচিত মানসম্মত বীজ, সহজ অর্ডার এবং সারাদেশে ডেলিভারি।';
  const ctaText = landing?.cta_text || 'এখনই অর্ডার করুন';
  const benefits = landing?.benefits?.length ? landing.benefits : (product?.benefits?.length ? product.benefits : ['মানসম্মত ও বাছাই করা বীজ', 'সহজ অর্ডার প্রসেস', 'সারাদেশে হোম ডেলিভারি']);
  const features = landing?.features?.length ? landing.features : (product?.features?.length ? product.features : []);
  const faqs = landing?.faq || [];
  const rating = reviews.length ? (reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const total = price * quantity;

  const handleBuyNow = () => {
    if (!product) return;
    if (product.stock <= 0) {
      toast('এই পণ্যটি বর্তমানে স্টকে নেই', 'error');
      return;
    }
    addToCart(product, quantity, { unit_price: price, name: productName });
    router.push('/checkout');
  };

  const scrollToOrder = () => document.getElementById('order-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5faf7] px-4 py-16">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-10 w-40 rounded-full bg-emerald-100" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square rounded-[36px] bg-emerald-100" />
            <div className="space-y-5"><div className="h-10 rounded-2xl bg-emerald-100" /><div className="h-24 rounded-2xl bg-emerald-100" /><div className="h-40 rounded-[30px] bg-emerald-100" /></div>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-[#f5faf7] px-4 py-24 text-center">
        <div className="mx-auto max-w-md rounded-[32px] border border-emerald-100 bg-white p-10 shadow-xl">
          <Zap className="mx-auto h-12 w-12 text-emerald-700" />
          <h1 className="mt-5 text-2xl font-black">অফারটি পাওয়া যায়নি</h1>
          <p className="mt-2 text-sm text-slate-500">লিংকটি হয়তো পরিবর্তন হয়েছে অথবা অফারটি বর্তমানে সক্রিয় নয়।</p>
          <button onClick={() => router.push('/all-products')} className="mt-6 rounded-2xl bg-emerald-800 px-6 py-3 font-black text-white">সকল পণ্য দেখুন</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5faf7] pb-28 text-slate-900">
      <section className="relative overflow-hidden bg-[#063b25] text-white">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-lime-200/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-14 lg:pt-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.16em] text-emerald-100"><Sparkles className="h-3.5 w-3.5 text-lime-300" /> GAZI SEED Exclusive Offer</span>
            {landing?.offer_badge && <span className="rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-amber-950">{landing.offer_badge}</span>}
          </div>
          <div className="mt-6 max-w-4xl">
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">{headline}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/85 sm:text-lg">{subtitle}</p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-bold text-emerald-50/90">
            <span className="rounded-2xl bg-white/10 px-4 py-2.5">✓ ১০০% ফোকাসড অ্যাড ল্যান্ডিং</span>
            <span className="rounded-2xl bg-white/10 px-4 py-2.5">✓ COD Available</span>
            <span className="rounded-2xl bg-white/10 px-4 py-2.5">✓ Nationwide Delivery</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-7 lg:grid-cols-[1.08fr_.92fr] lg:items-start">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[34px] border border-emerald-100 bg-white shadow-[0_30px_80px_-45px_rgba(6,59,37,.65)]">
              <div className="relative aspect-square bg-[radial-gradient(circle_at_30%_20%,rgba(110,231,183,.22),transparent_34%),#effaf3] sm:aspect-[5/4]">
                {heroImage ? <img src={heroImage} alt={productName} className="h-full w-full object-contain p-5 sm:p-8" /> : <div className="flex h-full items-center justify-center text-8xl">🌱</div>}
                {discount > 0 && <span className="absolute left-4 top-4 rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-lg">-{discount}% OFF</span>}
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 rounded-2xl border border-white/20 bg-slate-950/65 p-4 text-white backdrop-blur-xl">
                  <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-200">Premium Seed</p><p className="mt-1 text-lg font-black">{productName}</p></div>
                  {rating && <div className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-black"><Star className="h-4 w-4 fill-amber-300 text-amber-300" /> {rating}</div>}
                </div>
              </div>
              {images.length > 1 && <div className="grid grid-cols-4 gap-2 border-t border-slate-100 p-3">{images.slice(0,4).map((img, i) => <div key={i} className="overflow-hidden rounded-2xl bg-slate-50"><img src={img} alt="" className="aspect-square w-full object-cover" /></div>)}</div>}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[['মান', 'বাছাই করা বীজ'], ['সার্ভিস', 'সারাদেশে ডেলিভারি'], ['পেমেন্ট', 'Cash on Delivery']].map(([a,b]) => <div key={a} className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">{a}</p><p className="mt-1 text-sm font-black text-slate-900">{b}</p></div>)}
            </div>
          </div>

          <aside id="order-box" className="lg:sticky lg:top-24">
            <div className="rounded-[34px] border border-emerald-100 bg-white p-5 shadow-[0_28px_80px_-42px_rgba(6,59,37,.72)] sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Special Ad Price</p><h2 className="mt-1 text-2xl font-black">{productName}</h2></div>
                {landing?.discount_label && <span className="rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700">{landing.discount_label}</span>}
              </div>

              <div className="mt-5 flex items-end gap-3"><div><p className="text-xs font-bold text-slate-400 line-through">৳{comparePrice || product.regular_price}</p><p className="text-4xl font-black text-emerald-800">৳{price}</p></div>{comparePrice > price && <span className="mb-1 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">সাশ্রয় ৳{comparePrice - price}</span>}</div>

              <div className="mt-5 rounded-[24px] bg-slate-50 p-4">
                <p className="text-xs font-extrabold text-slate-700">কত প্যাকেট নিতে চান?</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[1,2,3].map((qty) => <button key={qty} type="button" onClick={() => setQuantity(qty)} className={`rounded-2xl border-2 px-3 py-3 text-sm font-black transition ${quantity === qty ? 'border-emerald-700 bg-emerald-700 text-white shadow-lg' : 'border-white bg-white text-slate-700 hover:border-emerald-300'}`}>{qty}× প্যাক</button>)}
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">পণ্যের মূল্য</span><span className="font-black">৳{total}</span></div><div className="flex justify-between"><span className="text-slate-500">ডেলিভারি</span><span className="font-black text-emerald-700">৳0–120</span></div></div>

              <button onClick={handleBuyNow} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-5 py-4 text-base font-black text-white shadow-[0_14px_30px_-12px_rgba(6,95,70,.7)] transition hover:-translate-y-0.5 hover:bg-emerald-900"><ShoppingCart className="h-5 w-5" /> {ctaText}</button>
              <button onClick={scrollToOrder} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800">অফারের বিস্তারিত দেখুন <ArrowRight className="h-4 w-4" /></button>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500"><div className="rounded-2xl bg-slate-50 p-3"><ShieldCheck className="mx-auto h-5 w-5 text-emerald-700" /><p className="mt-1">নিরাপদ অর্ডার</p></div><div className="rounded-2xl bg-slate-50 p-3"><Truck className="mx-auto h-5 w-5 text-emerald-700" /><p className="mt-1">হোম ডেলিভারি</p></div><div className="rounded-2xl bg-slate-50 p-3"><Check className="mx-auto h-5 w-5 text-emerald-700" /><p className="mt-1">COD</p></div></div>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-14"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Why this offer</p><h2 className="mt-2 text-3xl font-black tracking-tight">কেন এই অফারটি নেবেন?</h2></div><div className="mt-6 grid gap-4 md:grid-cols-2">{benefits.slice(0,6).map((benefit, i) => <div key={i} className="flex gap-3 rounded-[24px] border border-slate-100 bg-slate-50 p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><Check className="h-5 w-5" /></div><p className="pt-1 text-sm font-extrabold leading-6 text-slate-800">{benefit}</p></div>)}</div></div></section>

      {features.length > 0 && <section className="py-10 sm:py-14"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="rounded-[32px] bg-[#073a25] p-6 text-white sm:p-9"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-200">Product Highlights</p><h2 className="mt-2 text-2xl font-black">পণ্যের বিশেষ বৈশিষ্ট্য</h2><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{features.slice(0,9).map((feature, i) => <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-emerald-50">✓ {feature}</div>)}</div></div></div></section>}

      {landing?.description && <section className="bg-white py-10 sm:py-14"><div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8"><div className="rounded-[32px] border border-emerald-100 bg-emerald-50/60 p-6 sm:p-9"><p className="text-sm leading-8 text-slate-700 whitespace-pre-line">{landing.description}</p></div></div></section>}

      {reviews.length > 0 && <section className="py-10 sm:py-14"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Customer Love</p><h2 className="mt-2 text-3xl font-black">যারা নিয়েছেন তারা কী বলছেন</h2></div>{rating && <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100"><div className="flex items-center gap-1 text-lg font-black"><Star className="h-5 w-5 fill-amber-300 text-amber-300" /> {rating}<span className="text-xs font-bold text-slate-400">({reviews.length} reviews)</span></div></div>}</div><div className="mt-6 grid gap-4 md:grid-cols-3">{reviews.slice(0,6).map((review) => <div key={review.id} className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-1">{[1,2,3,4,5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= review.rating ? 'fill-amber-300 text-amber-300' : 'text-slate-200'}`} />)}</div><p className="mt-3 text-sm leading-6 text-slate-700">“{review.review}”</p><p className="mt-4 text-xs font-black text-slate-500">— {review.customer_name}</p></div>)}</div></div></section>}

      {faqs.length > 0 && <section className="bg-white py-10 sm:py-14"><div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8"><div className="text-center"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Need to know</p><h2 className="mt-2 text-3xl font-black">সাধারণ প্রশ্ন</h2></div><div className="mt-6 space-y-3">{faqs.map((faq, i) => <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 p-5 text-left text-sm font-black"><span>{faq.q}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} /></button>{openFaq === i && <div className="border-t border-slate-200 px-5 pb-5 pt-4 text-sm leading-7 text-slate-600">{faq.a}</div>}</div>)}</div></div></section>}

      <section className="px-4 py-10"><div className="mx-auto max-w-4xl rounded-[32px] bg-gradient-to-br from-emerald-800 to-emerald-950 p-7 text-center text-white shadow-xl sm:p-10"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-emerald-200">শেষবারের মতো</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">আজই আপনার পছন্দের বীজটি অর্ডার করুন</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-emerald-100/80">ফর্মালিটি কম, অর্ডার সহজ—অফার প্রাইসে সরাসরি চেকআউটে যান।</p><button onClick={handleBuyNow} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-7 py-4 text-base font-black text-amber-950 shadow-lg transition hover:-translate-y-0.5">এখনই অর্ডার করুন <ArrowRight className="h-5 w-5" /></button></div></section>

      <div className="fixed bottom-2 left-2 right-2 z-50 flex items-center gap-2 rounded-2xl border border-emerald-200/70 bg-white/95 p-2 shadow-[0_18px_45px_-18px_rgba(6,59,37,.55)] backdrop-blur-xl lg:hidden"><div className="min-w-0 flex-1 px-2"><p className="truncate text-[10px] font-bold text-slate-500">{productName}</p><p className="text-lg font-black text-emerald-800">৳{total}</p></div><button onClick={handleBuyNow} className="flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-black text-white"><ShoppingCart className="h-4 w-4" /> অর্ডার করুন</button></div>
    </main>
  );
}
