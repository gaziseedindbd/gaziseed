'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Truck, ShieldCheck, Sprout, Phone, Heart, Users, Headphones, MapPin } from 'lucide-react';
import { ProductCard } from './product-card';
import { getBanners, getCategories, getProducts, getServices, getTestimonials, getBlogPosts, getSiteSettings, getHomepageSections, getThisMonthSeeds } from '@/lib/data';
import { detectAndStoreReferralCode } from '@/lib/referral';
import { getVisitorCountry } from '@/lib/supabase/client';
import { useLang } from './language-provider';
import { getStoredTheme, type HomePageTheme } from './theme-switcher';
import type { Banner, Category, Product, Service, Testimonial, BlogPost, SiteSettings, HomepageSection } from '@/lib/supabase/types';

let memoryCache: { country?: 'BD' | 'IN'; banners?: Banner[]; categories?: Category[]; featuredProducts?: Product[]; bestSellers?: Product[]; newArrivals?: Product[]; seasonal?: Product[]; thisMonthSeeds?: Product[]; services?: Service[]; testimonials?: Testimonial[]; blogPosts?: BlogPost[]; settings?: SiteSettings | null; sections?: HomepageSection[]; timestamp?: number } = {};

export default function Home() {
  const { t, tDb, tCategoryName } = useLang();
  const visitorCountry = getVisitorCountry();
  const cached = memoryCache.country === visitorCountry ? memoryCache : {};
  const [banners, setBanners] = useState<Banner[]>(cached.banners || []);
  const [categories, setCategories] = useState<Category[]>(cached.categories || []);
  const [categoriesLoaded, setCategoriesLoaded] = useState(Boolean(cached.categories));
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>(cached.featuredProducts || []);
  const [bestSellers, setBestSellers] = useState<Product[]>(cached.bestSellers || []);
  const [newArrivals, setNewArrivals] = useState<Product[]>(cached.newArrivals || []);
  const [seasonal, setSeasonal] = useState<Product[]>(cached.seasonal || []);
  const [thisMonthSeeds, setThisMonthSeeds] = useState<Product[]>(cached.thisMonthSeeds || []);
  const [services, setServices] = useState<Service[]>(cached.services || []);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(cached.testimonials || []);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(cached.blogPosts || []);
  const [settings, setSettings] = useState<SiteSettings | null>(cached.settings || null);
  const [sections, setSections] = useState<HomepageSection[]>(cached.sections || []);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [theme, setTheme] = useState<HomePageTheme>('theme1');

  useEffect(() => { setTheme(getStoredTheme()); const handler = () => setTheme(getStoredTheme()); window.addEventListener('sb-theme-change', handler); return () => window.removeEventListener('sb-theme-change', handler); }, []);
  useEffect(() => { detectAndStoreReferralCode(); }, []);

  useEffect(() => {
    let cancelled = false;
    const country = getVisitorCountry();
    const isCacheValid = memoryCache.country === country && memoryCache.timestamp && Date.now() - memoryCache.timestamp < 60000;
    if (isCacheValid) return;

    const applyCore = (b: Banner[], c: Category[], fp: Product[]) => {
      if (cancelled) return;
      setBanners(b); setCategories(c); setCategoriesLoaded(true); setFeaturedProducts(fp);
      memoryCache = { ...memoryCache, country, banners: b, categories: c, featuredProducts: fp, timestamp: Date.now() };
    };
    const applySecondary = (bs: Product[], na: Product[], ss: Product[], tms: Product[]) => {
      if (cancelled) return;
      setBestSellers(bs); setNewArrivals(na); setSeasonal(ss); setThisMonthSeeds(tms);
      memoryCache = { ...memoryCache, bestSellers: bs, newArrivals: na, seasonal: ss, thisMonthSeeds: tms, timestamp: Date.now() };
    };
    const loadHomepageData = async () => {
      try {
        const [bRes, cRes, fpRes] = await Promise.allSettled([
          getBanners(), getCategories(), getProducts({ is_featured: true, limit: 8 }),
        ]);
        const b = bRes.status === 'fulfilled' ? bRes.value : [];
        const c = cRes.status === 'fulfilled' ? cRes.value : [];
        const fp = fpRes.status === 'fulfilled' ? fpRes.value : [];
        applyCore(b, c, fp);

        const idle = (typeof window !== 'undefined' && 'requestIdleCallback' in window)
          ? (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback
          : null;
        const loadSecondary = async () => {
          const [bsRes, naRes, ssRes, tmsRes] = await Promise.allSettled([
            getProducts({ is_best_seller: true, limit: 8 }),
            getProducts({ is_new_arrival: true, limit: 8 }),
            getProducts({ is_seasonal: true, limit: 8 }),
            getThisMonthSeeds(),
          ]);
          applySecondary(
            bsRes.status === 'fulfilled' ? bsRes.value : [],
            naRes.status === 'fulfilled' ? naRes.value : [],
            ssRes.status === 'fulfilled' ? ssRes.value : [],
            tmsRes.status === 'fulfilled' ? tmsRes.value : [],
          );

          const loadContent = async () => {
            const [svRes, tRes, bpRes, stRes, hsRes] = await Promise.allSettled([
              getServices(), getTestimonials(), getBlogPosts(), getSiteSettings(), getHomepageSections(),
            ]);
            if (cancelled) return;
            const sv = svRes.status === 'fulfilled' ? svRes.value : [];
            const tVal = tRes.status === 'fulfilled' ? tRes.value : [];
            const bp = bpRes.status === 'fulfilled' ? bpRes.value : [];
            const st = stRes.status === 'fulfilled' ? stRes.value : null;
            const hs = hsRes.status === 'fulfilled' ? hsRes.value : [];
            setServices(sv); setTestimonials(tVal); setBlogPosts(bp); setSettings(st); setSections(hs);
            memoryCache = { ...memoryCache, country, services: sv, testimonials: tVal, blogPosts: bp, settings: st, sections: hs, timestamp: Date.now() };
          };
          if (idle) idle(loadContent, { timeout: 1800 }); else window.setTimeout(loadContent, 700);
        };
        if (idle) idle(loadSecondary, { timeout: 1200 }); else window.setTimeout(loadSecondary, 250);
      } catch {
        if (!cancelled) window.setTimeout(() => loadHomepageData(), 1000);
      }
    };
    loadHomepageData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (banners.length <= 1) return; const interval = setInterval(() => setCurrentBanner((prev) => (prev + 1) % banners.length), 5000); return () => clearInterval(interval); }, [banners.length]);

  const isSectionEnabled = (key: string) => sections.length === 0 || sections.find((s) => s.section_key === key)?.is_enabled !== false;
  const themeClass = theme === 'theme1' ? 'theme-premium' : theme === 'theme2' ? 'theme-farm' : 'theme-marketplace';
  const promoImage1 = blogPosts[0]?.featured_image || banners[0]?.desktop_image || '';
  const promoImage2 = blogPosts[1]?.featured_image || banners[1]?.desktop_image || banners[0]?.desktop_image || '';

  return (
    <div className={`${themeClass} home-premium-scope`}>
      <link rel="stylesheet" href="/home-premium-v2.css" />
      <link rel="stylesheet" href="/home-modern-v1.css" />
      {isSectionEnabled('hero_slider') && <section className="section-pad home-hero-section"><div className="container-custom"><div className="hero-wrap relative overflow-hidden"><div className="hero-inner relative block h-full w-full p-0">{banners.length > 0 ? banners.map((banner, idx) => <div key={banner.id} className={`absolute inset-0 transition-opacity duration-700 ${idx === currentBanner ? 'block' : 'hidden'}`}><div className="hero-inner relative block h-full p-0">{banner.desktop_image && <div className="hero-image-wrap block h-full w-full"><picture className="block h-full w-full"><source media="(max-width: 767px)" srcSet={banner.mobile_image || banner.desktop_image} /><Image src={banner.desktop_image} alt={banner.title || 'GAZI SEED'} fill priority={idx === 0} sizes="(max-width: 767px) 100vw, (max-width: 1380px) 100vw, 1380px" quality={82} className="block h-full w-full rounded-2xl object-cover shadow-lg" /></picture></div>}{(banner.title || banner.subtitle || banner.cta_text) && <div className="hero-content-overlay absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6 lg:p-8"><div className="max-w-xl rounded-2xl bg-black/25 p-4 text-white backdrop-blur-[2px] sm:p-5">{banner.title && <h2 className="hero-title">{tDb(banner.title)}</h2>}{banner.subtitle && <p className="hero-subtitle">{tDb(banner.subtitle)}</p>}{banner.cta_text && <Link href={banner.cta_url || '/all-products'} className="hero-btn inline-flex">{tDb(banner.cta_text)}<ChevronRight className="h-4 w-4" /></Link>}</div></div>}</div></div>) : <div className="h-full w-full rounded-2xl bg-secondary/20" aria-hidden="true" />}{banners.length > 1 && <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">{banners.map((_, idx) => <button key={idx} onClick={() => setCurrentBanner(idx)} className={`h-2 rounded-full transition-all ${idx === currentBanner ? 'w-8 bg-primary' : 'w-2 bg-primary/30'}`} aria-label={`Banner ${idx + 1}`}></button>)}</div>}</div></div></div></section>}
      {isSectionEnabled('featured_categories') && <section className="section-pad home-category-section"><div className="container-custom"><div className="mb-6 flex items-center justify-between"><div><h2 className="section-heading">{t('জনপ্রিয় ক্যাটাগরি', 'Popular Categories', 'लोकप्रिय श्रेणियाँ')}</h2><p className="section-subheading">{t('আপনার পছন্দের বীজ এক নজরে', 'Explore seeds by category', 'अपनी पसंद के बीज एक नज़र में देखें')}</p></div><Link href="/categories" className="view-all-link">{t('সব ক্যাটাগরি দেখুন →', 'View All Categories →', 'सभी श्रेणियाँ देखें →')}</Link></div><div className="cat-grid">{categoriesLoaded ? categories.slice(0, 8).map((cat, idx) => { const categoryHref = cat.slug === 'combo-packages' ? '/combos' : `/category/${cat.slug}`; return <Link key={cat.id} href={categoryHref} className={`cat-card group${idx >= 4 ? ' !hidden sm:!flex' : ''}`}><div className="cat-icon-wrap">{cat.image ? <img src={cat.image} alt={tCategoryName(cat.name_bn, cat.name_en)} className="h-full w-full rounded-full object-cover" loading="lazy" /> : <Sprout className="h-8 w-8 text-primary" />}</div><div className="cat-card-content"><span className="cat-label">{tCategoryName(cat.name_bn, cat.name_en)}</span><p className="cat-description">{tDb(cat.description)}</p><span className="cat-explore">{t('পণ্য দেখুন', 'Explore Products', 'उत्पाद देखें')}</span></div></Link>; }) : Array.from({ length: 8 }, (_, idx) => <div key={`category-skeleton-${idx}`} className={`cat-card category-card-skeleton${idx >= 4 ? ' !hidden sm:!flex' : ''}`} aria-hidden="true"><div className="cat-icon-wrap"><div className="category-skeleton-image" /></div><span className="cat-label"><span className="category-skeleton-label" /></span></div>)}</div></div></section>}
      <section className="home-trust-strip"><div className="container-custom home-trust-grid"><TrustItem icon={Sprout} title={t('১০০% অরিজিনাল বীজ', '100% Original Seeds', '100% असली बीज')} text={t('বিশ্বস্ত উৎস থেকে', 'From trusted sources', 'विश्वसनीय स्रोतों से')} /><TrustItem icon={Truck} title={visitorCountry === 'IN' ? t('সারা ভারতে ডেলিভারি', 'Pan-India Delivery', 'पूरे भारत में डिलीवरी') : t('সারা দেশে ডেলিভারি', 'Nationwide Delivery', 'पूरे देश में डिलीवरी')} text={t('দ্রুত ও নিরাপদ', 'Fast & secure', 'तेज़ और सुरक्षित')} /><TrustItem icon={ShieldCheck} title={t('নিরাপদ পেমেন্ট', 'Secure Payment', 'सुरक्षित भुगतान')} text={visitorCountry === 'IN' ? t('Cashfree, UPI, কার্ড ও COD', 'Cashfree, UPI, card & COD', 'Cashfree, UPI, कार्ड और COD') : t('বিকাশ, নগদ, কার্ড ও COD', 'bKash, Nagad, card & COD', 'bKash, Nagad, कार्ड और COD')} /><TrustItem icon={Headphones} title={t('কাস্টমার সাপোর্ট', 'Customer Support', 'ग्राहक सहायता')} text={t('সবসময় আপনার পাশে', 'Always here for you', 'हमेशा आपके साथ')} /></div></section>
      {isSectionEnabled('featured_products') && featuredProducts.length > 0 && <ProductSection title={t('জনপ্রিয় পণ্য', 'Popular Products', 'लोकप्रिय उत्पाद')} subtitle={t('কৃষকদের পছন্দের বীজ', 'Farmers’ favorite seeds', 'किसानों के पसंदीदा बीज')} products={featuredProducts} theme={theme} />}
      {(promoImage1 || promoImage2) && <section className="section-pad home-promo-section"><div className="container-custom home-promo-grid"><PromoCard image={promoImage1} title={t('চাষাবাদ গাইড', 'Growing Guide', 'खेती गाइड')} text={t('সঠিক বীজ, সঠিক পদ্ধতি — বেশি ফলন', 'Right seed, right method — better yield', 'सही बीज, सही तरीका — अधिक उपज')} href="/blog" button={t('বিস্তারিত দেখুন', 'Explore Guide', 'विस्तार से देखें')} /><PromoCard image={promoImage2} title={t('কৃষকের গল্প', 'Farmer Stories', 'किसान की कहानी')} text={t('আমাদের বীজে সাফল্যের অনুপ্রেরণামূলক গল্প', 'Inspiring success stories from farmers', 'हमारे बीजों से सफलता की प्रेरक कहानियाँ')} href="/blog" button={t('দেখুন এখন', 'View Stories', 'अभी देखें')} /></div></section>}
      <section className="home-stats-strip"><div className="container-custom home-stats-grid"><StatItem icon={Users} title={t('কৃষকের আস্থা', 'Farmer Trust', 'किसानों का भरोसा')} text={t('মানসম্মত বীজ', 'Quality seeds', 'गुणवत्तापूर्ण बीज')} /><StatItem icon={Sprout} title={t('বীজের সমৃদ্ধ সংগ্রহ', 'Rich Seed Collection', 'समृद्ध बीज संग्रह')} text={t('বিভিন্ন জাতের বীজ', 'Many varieties', 'विभिन्न किस्मों के बीज')} /><StatItem icon={MapPin} title={t('সারাদেশে সেবা', 'Nationwide Service', 'पूरे देश में सेवा')} text={t('ডেলিভারি সুবিধা', 'Delivery available', 'डिलीवरी सुविधा')} /><StatItem icon={ShieldCheck} title={t('নিরাপদ কেনাকাটা', 'Safe Shopping', 'सुरक्षित खरीदारी')} text={t('বিশ্বস্ত অর্ডার প্রসেস', 'Trusted order process', 'विश्वसनीय ऑर्डर प्रक्रिया')} /></div></section>
      {isSectionEnabled('best_selling') && bestSellers.length > 0 && <ProductSection title={t('বেস্ট সেলিং বীজ', 'Best Selling Seeds', 'सबसे अधिक बिकने वाले बीज')} subtitle={t('গ্রাহকদের প্রিয় পছন্দ', 'Customer favorites', 'ग्राहकों की पसंद')} products={bestSellers} theme={theme} />}
      {isSectionEnabled('new_arrivals') && newArrivals.length > 0 && <ProductSection title={t('নতুন এসেছে', 'New Arrivals', 'नए आए उत्पाद')} subtitle={t('সর্বশেষ যোগ হওয়া বীজ', 'Latest additions', 'नवीनतम जोड़े गए बीज')} products={newArrivals} theme={theme} />}
      {isSectionEnabled('seasonal') && seasonal.length > 0 && <ProductSection title={t('মৌসুমি বীজ', 'Seasonal Seeds', 'मौसमी बीज')} subtitle={t('এই মৌসুমের জন্য সেরা', 'Best for this season', 'इस मौसम के लिए सबसे अच्छे')} products={seasonal} theme={theme} />}
      {thisMonthSeeds.length > 0 && <ProductSection title={t('এই মাসে যে বীজগুলো লাগাতে পারেন', 'Seeds to Plant This Month', 'इस महीने लगाए जा सकने वाले बीज')} subtitle={t('এখনই লাগানোর উপযুক্ত', 'Perfect for planting now', 'अभी लगाने के लिए उपयुक्त')} products={thisMonthSeeds} theme={theme} />}
      {isSectionEnabled('why_choose_us') && <section className="section-pad feature-section-bg legacy-feature-section"><div className="container-custom"><h2 className="mb-8 text-center section-heading">{t('কেন বেছে নেবেন গাজী সিড?', 'Why Choose GAZI SEED?', 'GAZI SEED को क्यों चुनें?')}</h2><div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{[{ icon: Sprout, title: t('অরিজিনাল বীজ', 'Original Seeds', 'असली बीज'), desc: t('১০০% অরিজিনাল ও অঙ্কুরিত বীজ', '100% original & germinated seeds', '100% असली और अंकुरित बीज') },{ icon: Truck, title: t('সারাদেশে ডেলিভারি', 'Nationwide Delivery', 'पूरे देश में डिलीवरी'), desc: t('ক্যাশ অন ডেলিভারি সারাদেশে', 'Cash on delivery nationwide', 'पूरे देश में कैश ऑन डिलीवरी') },{ icon: ShieldCheck, title: t('মানি ব্যাক গ্যারান্টি', 'Money Back Guarantee', 'मनी बैक गारंटी'), desc: t('পণ্য সন্তুষ্টিজনক না হলে ফেরত', 'Return if not satisfied', 'संतुष्ट न होने पर वापसी') },{ icon: Phone, title: t('২৪/৭ সাপোর্ট', '24/7 Support', '24/7 सहायता'), desc: t('ফোন ও হোয়াটসঅ্যাপে সাপোর্ট', 'Phone & WhatsApp support', 'फोन और WhatsApp पर सहायता') }].map((item, idx) => <div key={idx} className="why-card"><div className="why-icon-wrap"><item.icon className="h-7 w-7" /></div><h3 className="why-title">{item.title}</h3><p className="why-desc">{item.desc}</p></div>)}</div></div></section>}
      {isSectionEnabled('services') && services.length > 0 && <section className="section-pad"><div className="container-custom"><h2 className="mb-8 text-center section-heading">{t('আমাদের সার্ভিসসমূহ', 'Our Services', 'हमारी सेवाएँ')}</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map((svc) => <div key={svc.id} className="service-card"><div className="service-icon-wrap"><Sprout className="h-6 w-6" /></div><h3 className="mb-2 font-semibold text-foreground">{svc.title}</h3><p className="text-sm text-muted-foreground">{svc.short_description}</p></div>)}</div></div></section>}
      {isSectionEnabled('testimonials') && testimonials.length > 0 && <section className="section-pad testimonial-bg"><div className="container-custom"><h2 className="mb-8 text-center section-heading">{t('গ্রাহকদের মতামত', 'Customer Reviews', 'ग्राहकों की समीक्षाएँ')}</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{testimonials.map((testimonial) => <div key={testimonial.id} className="testimonial-card"><div className="mb-3 flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={i < testimonial.rating ? 'text-yellow-500' : 'text-muted-foreground/30'}>★</span>)}</div><p className="mb-4 text-sm text-muted-foreground">&quot;{testimonial.review}&quot;</p><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{testimonial.customer_name.charAt(0)}</div><span className="font-medium text-foreground">{testimonial.customer_name}</span></div></div>)}</div></div></section>}
      {isSectionEnabled('blog') && blogPosts.length > 0 && <section className="section-pad"><div className="container-custom"><div className="mb-6 flex items-center justify-between"><h2 className="section-heading">{t('বাগান গাইড', 'Garden Guides', 'बागवानी गाइड')}</h2><Link href="/blog" className="view-all-link">{t('সব দেখুন →', 'View All →', 'सभी देखें →')}</Link></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{blogPosts.slice(0, 3).map((post) => <Link key={post.id} href={`/blog/${post.slug}`} className="blog-card group">{post.featured_image && <div className="aspect-video overflow-hidden bg-secondary/30"><img src={post.featured_image} alt={post.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" /></div>}<div className="p-4">{post.category && <span className="text-xs text-primary">{post.category}</span>}<h3 className="mt-1 font-semibold text-foreground group-hover:text-primary">{post.title}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.content.slice(0, 100)}...</p></div></Link>)}</div></div></section>}
      {isSectionEnabled('delivery_info') && <section className="section-pad delivery-bg text-primary-foreground"><div className="container-custom"><div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left"><div><h2 className="text-xl font-bold sm:text-2xl">{visitorCountry === 'IN' ? t('সারা ভারতে ক্যাশ অন ডেলিভারি', 'Cash on Delivery Across India', 'पूरे भारत में कैश ऑन डिलीवरी') : t('সারাদেশে ক্যাশ অন ডেলিভারি', 'Cash on Delivery Nationwide', 'पूरे देश में कैश ऑन डिलीवरी')}</h2><p className="mt-1 text-sm text-primary-foreground/80">{visitorCountry === 'IN' ? t('পণ্য হাতে পেয়ে টাকা দিন। মেট্রো/সিটিতে ২–৪ দিন, অন্যান্য এলাকায় ৪–৭ দিন।', 'Pay when you receive. Metro/city 2–4 days, other areas 4–7 days.', 'सामान मिलने पर भुगतान करें। मेट्रो/शहर में 2–4 दिन, अन्य क्षेत्रों में 4–7 दिन।') : t('পণ্য হাতে পেয়ে টাকা দিন। ঢাকার ভিতরে ১-২ দিন, ঢাকার বাইরে ২-৫ দিন।', 'Pay when you receive. Inside Dhaka 1-2 days, outside 2-5 days.', 'सामान मिलने पर भुगतान करें। ढाका के अंदर 1–2 दिन, ढाका के बाहर 2–5 दिन।')}</p></div><Link href="/charges" className="delivery-btn">{t('ডেলিভারি চার্জ দেখুন', 'View Delivery Charges', 'डिलीवरी शुल्क देखें')}</Link></div></div></section>}
      {isSectionEnabled('newsletter') && <section className="section-pad"><div className="container-custom"><div className="newsletter-wrap"><h2 className="section-heading">{t('নতুন অফার ও টিপস পেতে সাবস্ক্রাইব করুন', 'Subscribe for Offers & Tips', 'नए ऑफ़र और टिप्स पाने के लिए सब्सक्राइब करें')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('ইমেইল ঠিকানা দিন এবং বাগান পরিচর্যার টিপস পান', 'Enter your email for gardening tips', 'अपना ईमेल दें और बागवानी के टिप्स पाएं')}</p><form className="mx-auto mt-6 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); }}><input type="email" placeholder={t('আপনার ইমেইল', 'Your email', 'आपका ईमेल')} className="input-bangla flex-1" /><button type="submit" className="btn-primary">{t('সাবস্ক্রাইব', 'Subscribe', 'सब्सक्राइब करें')}</button></form></div></div></section>}
    </div>
  );
}

function TrustItem({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) { return <div className="home-trust-item"><div className="home-trust-icon"><Icon className="h-6 w-6" /></div><div><h3>{title}</h3><p>{text}</p></div></div>; }
function StatItem({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) { return <div className="home-stat-item"><div className="home-stat-icon"><Icon className="h-6 w-6" /></div><div><strong>{title}</strong><span>{text}</span></div></div>; }
function PromoCard({ image, title, text, href, button }: { image: string; title: string; text: string; href: string; button: string }) { return <Link href={href} className="home-promo-card group">{image && <img src={image} alt="" loading="lazy" />}<div className="home-promo-overlay" /><div className="home-promo-content"><h3>{title}</h3><p>{text}</p><span>{button}<ChevronRight className="h-4 w-4" /></span></div></Link>; }
function ProductSection({ title, subtitle, products, theme }: { title: string; subtitle?: string; products: Product[]; theme: HomePageTheme }) { const { t } = useLang(); if (products.length === 0) return null; return <section className="section-pad home-product-section"><div className="container-custom"><div className="mb-6 flex items-center justify-between"><div><h2 className="section-heading">{title}</h2>{subtitle && <p className="section-subheading">{subtitle}</p>}</div><Link href="/all-products" className="view-all-link">{t('সব দেখুন →', 'View All →', 'सभी देखें →')}</Link></div><div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} stackedActions />)}</div></div></section>; }
