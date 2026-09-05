'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { ChevronRight, Truck, ShieldCheck, Sprout, Phone, Heart, Users, Headphones, MapPin } from 'lucide-react';
import { ProductCard } from './product-card';
import {
  getBanners, getCategories, getProducts, getServices,
  getTestimonials, getBlogPosts, getSiteSettings, getHomepageSections,
  getThisMonthSeeds,
} from '@/lib/data';
import { detectAndStoreReferralCode } from '@/lib/referral';
import { useLang } from './language-provider';
import { ThemeSwitcher, getStoredTheme, type HomePageTheme } from './theme-switcher';
import type {
  Banner, Category, Product, Service, Testimonial, BlogPost,
  SiteSettings, HomepageSection,
} from '@/lib/supabase/types';

let memoryCache: {
  banners?: Banner[];
  categories?: Category[];
  featuredProducts?: Product[];
  bestSellers?: Product[];
  newArrivals?: Product[];
  seasonal?: Product[];
  thisMonthSeeds?: Product[];
  services?: Service[];
  testimonials?: Testimonial[];
  blogPosts?: BlogPost[];
  settings?: SiteSettings | null;
  sections?: HomepageSection[];
  timestamp?: number;
} = {};

export default function Home() {
  const { lang, t, tDb } = useLang();
  const [banners, setBanners] = useState<Banner[]>(memoryCache.banners || []);
  const [categories, setCategories] = useState<Category[]>(memoryCache.categories || []);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>(memoryCache.featuredProducts || []);
  const [bestSellers, setBestSellers] = useState<Product[]>(memoryCache.bestSellers || []);
  const [newArrivals, setNewArrivals] = useState<Product[]>(memoryCache.newArrivals || []);
  const [seasonal, setSeasonal] = useState<Product[]>(memoryCache.seasonal || []);
  const [thisMonthSeeds, setThisMonthSeeds] = useState<Product[]>(memoryCache.thisMonthSeeds || []);
  const [services, setServices] = useState<Service[]>(memoryCache.services || []);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(memoryCache.testimonials || []);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(memoryCache.blogPosts || []);
  const [settings, setSettings] = useState<SiteSettings | null>(memoryCache.settings || null);
  const [sections, setSections] = useState<HomepageSection[]>(memoryCache.sections || []);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [theme, setTheme] = useState<HomePageTheme>('theme1');

  useEffect(() => {
    setTheme(getStoredTheme());
    const handler = () => setTheme(getStoredTheme());
    window.addEventListener('sb-theme-change', handler);
    return () => window.removeEventListener('sb-theme-change', handler);
  }, []);

  useEffect(() => { detectAndStoreReferralCode(); }, []);

  useEffect(() => {
    const isCacheValid = memoryCache.timestamp && Date.now() - memoryCache.timestamp < 60000;
    if (isCacheValid && memoryCache.banners) return;
    Promise.allSettled([
      getBanners(), getCategories(), getProducts({ is_featured: true, limit: 10 }),
      getProducts({ is_best_seller: true, limit: 10 }), getProducts({ is_new_arrival: true, limit: 10 }),
      getProducts({ is_seasonal: true, limit: 10 }), getServices(), getTestimonials(), getBlogPosts(),
      getSiteSettings(), getHomepageSections(), getThisMonthSeeds(),
    ]).then(([bRes, cRes, fpRes, bsRes, naRes, ssRes, svRes, tRes, bpRes, stRes, hsRes, tmsRes]) => {
      const b = bRes.status === 'fulfilled' ? bRes.value : [];
      const c = cRes.status === 'fulfilled' ? cRes.value : [];
      const fp = fpRes.status === 'fulfilled' ? fpRes.value : [];
      const bs = bsRes.status === 'fulfilled' ? bsRes.value : [];
      const na = naRes.status === 'fulfilled' ? naRes.value : [];
      const ss = ssRes.status === 'fulfilled' ? ssRes.value : [];
      const sv = svRes.status === 'fulfilled' ? svRes.value : [];
      const tVal = tRes.status === 'fulfilled' ? tRes.value : [];
      const bp = bpRes.status === 'fulfilled' ? bpRes.value : [];
      const st = stRes.status === 'fulfilled' ? stRes.value : null;
      const hs = hsRes.status === 'fulfilled' ? hsRes.value : [];
      const tms = tmsRes.status === 'fulfilled' ? tmsRes.value : [];
      setBanners(b); setCategories(c); setFeaturedProducts(fp); setBestSellers(bs); setNewArrivals(na);
      setSeasonal(ss); setServices(sv); setTestimonials(tVal); setBlogPosts(bp); setSettings(st); setSections(hs); setThisMonthSeeds(tms);
      memoryCache = { banners: b, categories: c, featuredProducts: fp, bestSellers: bs, newArrivals: na, seasonal: ss,
        services: sv, testimonials: tVal, blogPosts: bp, settings: st, sections: hs, thisMonthSeeds: tms, timestamp: Date.now() };
    });
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => setCurrentBanner((prev) => (prev + 1) % banners.length), 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const isSectionEnabled = (key: string) => sections.length === 0 || sections.find((s) => s.section_key === key)?.is_enabled !== false;
  const themeClass = theme === 'theme1' ? 'theme-premium' : theme === 'theme2' ? 'theme-farm' : 'theme-marketplace';
  const promoImage1 = blogPosts[0]?.featured_image || banners[0]?.desktop_image || '';
  const promoImage2 = blogPosts[1]?.featured_image || banners[1]?.desktop_image || banners[0]?.desktop_image || '';

  return (
    <div className={`${themeClass} home-premium-scope`}>
      <link rel="stylesheet" href="/home-premium-v2.css" />
      <link rel="stylesheet" href="/home-category-labels-premium-v2.css" />
      <link rel="stylesheet" href="/home-modern-v1.css" />
      <ThemeSwitcher defaultTheme={(settings?.homepage_theme as HomePageTheme) || 'theme1'} />

      {isSectionEnabled('hero_slider') && banners.length > 0 && <section className="section-pad home-hero-section"><div className="container-custom"><div className="hero-wrap relative overflow-hidden">
        {banners.map((banner, idx) => <div key={banner.id} className={`transition-opacity duration-700 ${idx === currentBanner ? 'block' : 'hidden'}`}><div className="hero-inner grid items-center gap-4 px-6 sm:px-10 lg:grid-cols-2 lg:px-16"><div>{banner.title && <h2 className="hero-title">{tDb(banner.title)}</h2>}{banner.subtitle && <p className="hero-subtitle">{tDb(banner.subtitle)}</p>}{banner.cta_text && <Link href={banner.cta_url || '/all-products'} className="hero-btn">{tDb(banner.cta_text)}<ChevronRight className="h-4 w-4" /></Link>}</div>{banner.desktop_image && <div className="block"><picture><source media="(max-width: 767px)" srcSet={banner.mobile_image || banner.desktop_image} /><img src={banner.desktop_image} alt={banner.title} className="h-56 w-full rounded-2xl object-cover shadow-lg sm:h-72" loading="eager" /></picture></div>}</div></div>)}
        {banners.length > 1 && <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">{banners.map((_, idx) => <button key={idx} onClick={() => setCurrentBanner(idx)} className={`h-2 rounded-full transition-all ${idx === currentBanner ? 'w-8 bg-primary' : 'w-2 bg-primary/30'}`} aria-label={`Banner ${idx + 1}`} />)}</div>}
      </div></div></section>}

      {isSectionEnabled('featured_categories') && categories.length > 0 && <section className="section-pad home-category-section"><div className="container-custom"><div className="mb-6 flex items-center justify-between"><div><h2 className="section-heading">{t('জনপ্রিয় ক্যাটাগরি', 'Popular Categories')}</h2><p className="section-subheading">{t('আপনার পছন্দের বীজ এক নজরে', 'Explore seeds by category')}</p></div><Link href="/categories" className="view-all-link">{t('সব ক্যাটাগরি দেখুন →', 'View All Categories →')}</Link></div><div className="cat-grid">{categories.slice(0, 8).map((cat, idx) => { const categoryHref = cat.slug === 'combo-packages' ? '/combos' : `/category/${cat.slug}`; return <Link key={cat.id} href={categoryHref} className={`cat-card group${idx >= 4 ? ' !hidden sm:!flex' : ''}`}><div className="cat-icon-wrap">{cat.image ? <img src={cat.image} alt={lang === 'en' ? (cat.name_en || cat.name_bn) : cat.name_bn} className="h-full w-full rounded-full object-cover" loading="lazy" /> : <Sprout className="h-8 w-8 text-primary" />}</div><span className="cat-label">{lang === 'en' ? (cat.name_en || cat.name_bn) : cat.name_bn}</span></Link>; })}</div></div></section>}

      <section className="home-trust-strip"><div className="container-custom home-trust-grid"><TrustItem icon={Sprout} title={t('১০০% অরিজিনাল বীজ', '100% Original Seeds')} text={t('বিশ্বস্ত উৎস থেকে', 'From trusted sources')} /><TrustItem icon={Truck} title={t('সারা দেশে ডেলিভারি', 'Nationwide Delivery')} text={t('দ্রুত ও নিরাপদ', 'Fast & secure')} /><TrustItem icon={ShieldCheck} title={t('নিরাপদ পেমেন্ট', 'Secure Payment')} text={t('বিকাশ, নগদ, কার্ড ও COD', 'bKash, Nagad, card & COD')} /><TrustItem icon={Headphones} title={t('কাস্টমার সাপোর্ট', 'Customer Support')} text={t('সবসময় আপনার পাশে', 'Always here for you')} /></div></section>

      {isSectionEnabled('featured_products') && featuredProducts.length > 0 && <ProductSection title={t('জনপ্রিয় পণ্য', 'Popular Products')} subtitle={t('কৃষকদের পছন্দের বীজ', 'Farmers’ favorite seeds')} products={featuredProducts} theme={theme} />}

      {(promoImage1 || promoImage2) && <section className="section-pad home-promo-section"><div className="container-custom home-promo-grid"><PromoCard image={promoImage1} title={t('চাষাবাদ গাইড', 'Growing Guide')} text={t('সঠিক বীজ, সঠিক পদ্ধতি — বেশি ফলন', 'Right seed, right method — better yield')} href="/blog" button={t('বিস্তারিত দেখুন', 'Explore Guide')} /><PromoCard image={promoImage2} title={t('কৃষকের গল্প', 'Farmer Stories')} text={t('আমাদের বীজে সাফল্যের অনুপ্রেরণামূলক গল্প', 'Inspiring success stories from farmers')} href="/blog" button={t('দেখুন এখন', 'View Stories')} /></div></section>}

      <section className="home-stats-strip"><div className="container-custom home-stats-grid"><StatItem icon={Users} title={t('কৃষকের আস্থা', 'Farmer Trust')} text={t('মানসম্মত বীজ', 'Quality seeds')} /><StatItem icon={Sprout} title={t('বীজের সমৃদ্ধ সংগ্রহ', 'Rich Seed Collection')} text={t('বিভিন্ন জাতের বীজ', 'Many varieties')} /><StatItem icon={MapPin} title={t('সারাদেশে সেবা', 'Nationwide Service')} text={t('ডেলিভারি সুবিধা', 'Delivery available')} /><StatItem icon={ShieldCheck} title={t('নিরাপদ কেনাকাটা', 'Safe Shopping')} text={t('বিশ্বস্ত অর্ডার প্রসেস', 'Trusted order process')} /></div></section>

      {isSectionEnabled('best_selling') && bestSellers.length > 0 && <ProductSection title={t('বেস্ট সেলিং বীজ', 'Best Selling Seeds')} subtitle={t('গ্রাহকদের প্রিয় পছন্দ', 'Customer favorites')} products={bestSellers} theme={theme} />}
      {isSectionEnabled('new_arrivals') && newArrivals.length > 0 && <ProductSection title={t('নতুন এসেছে', 'New Arrivals')} subtitle={t('সর্বশেষ যোগ হওয়া বীজ', 'Latest additions')} products={newArrivals} theme={theme} />}
      {isSectionEnabled('seasonal') && seasonal.length > 0 && <ProductSection title={t('মৌসুমি বীজ', 'Seasonal Seeds')} subtitle={t('এই মৌসুমের জন্য সেরা', 'Best for this season')} products={seasonal} theme={theme} />}
      {thisMonthSeeds.length > 0 && <ProductSection title={t('এই মাসে যে বীজগুলো লাগাতে পারেন', 'Seeds to Plant This Month')} subtitle={t('এখনই লাগানোর উপযুক্ত', 'Perfect for planting now')} products={thisMonthSeeds} theme={theme} />}

      {isSectionEnabled('why_choose_us') && <section className="section-pad feature-section-bg legacy-feature-section"><div className="container-custom"><h2 className="mb-8 text-center section-heading">{t('কেন বেছে নেবেন সিড বাড়ি?', 'Why Choose SEED BARI?')}</h2><div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{[{ icon: Sprout, title: t('অরিজিনাল বীজ', 'Original Seeds'), desc: t('১০০% অরিজিনাল ও অঙ্কুরিত বীজ', '100% original & germinated seeds') },{ icon: Truck, title: t('সারাদেশে ডেলিভারি', 'Nationwide Delivery'), desc: t('ক্যাশ অন ডেলিভারি সারাদেশে', 'Cash on delivery nationwide') },{ icon: ShieldCheck, title: t('মানি ব্যাক গ্যারান্টি', 'Money Back Guarantee'), desc: t('পণ্য সন্তুষ্টিজনক না হলে ফেরত', 'Return if not satisfied') },{ icon: Phone, title: t('২৪/৭ সাপোর্ট', '24/7 Support'), desc: t('ফোন ও হোয়াটসঅ্যাপে সাপোর্ট', 'Phone & WhatsApp support') }].map((item, idx) => <div key={idx} className="why-card"><div className="why-icon-wrap"><item.icon className="h-7 w-7" /></div><h3 className="why-title">{item.title}</h3><p className="why-desc">{item.desc}</p></div>)}</div></div></section>}

      {isSectionEnabled('services') && services.length > 0 && <section className="section-pad"><div className="container-custom"><h2 className="mb-8 text-center section-heading">{t('আমাদের সার্ভিসসমূহ', 'Our Services')}</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map((svc) => <div key={svc.id} className="service-card"><div className="service-icon-wrap"><Sprout className="h-6 w-6" /></div><h3 className="mb-2 font-semibold text-foreground">{svc.title}</h3><p className="text-sm text-muted-foreground">{svc.short_description}</p></div>)}</div></div></section>}

      {isSectionEnabled('testimonials') && testimonials.length > 0 && <section className="section-pad testimonial-bg"><div className="container-custom"><h2 className="mb-8 text-center section-heading">{t('গ্রাহকদের মতামত', 'Customer Reviews')}</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{testimonials.map((testimonial) => <div key={testimonial.id} className="testimonial-card"><div className="mb-3 flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={i < testimonial.rating ? 'text-yellow-500' : 'text-muted-foreground/30'}>★</span>)}</div><p className="mb-4 text-sm text-muted-foreground">"{testimonial.review}"</p><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{testimonial.customer_name.charAt(0)}</div><span className="font-medium text-foreground">{testimonial.customer_name}</span></div></div>)}</div></div></section>}

      {isSectionEnabled('blog') && blogPosts.length > 0 && <section className="section-pad"><div className="container-custom"><div className="mb-6 flex items-center justify-between"><h2 className="section-heading">{t('বাগান গাইড', 'Garden Guides')}</h2><Link href="/blog" className="view-all-link">{t('সব দেখুন →', 'View All →')}</Link></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{blogPosts.slice(0, 3).map((post) => <Link key={post.id} href={`/blog/${post.slug}`} className="blog-card group">{post.featured_image && <div className="aspect-video overflow-hidden bg-secondary/30"><img src={post.featured_image} alt={post.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" /></div>}<div className="p-4">{post.category && <span className="text-xs text-primary">{post.category}</span>}<h3 className="mt-1 font-semibold text-foreground group-hover:text-primary">{post.title}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.content.slice(0, 100)}...</p></div></Link>)}</div></div></section>}

      {isSectionEnabled('delivery_info') && <section className="section-pad delivery-bg text-primary-foreground"><div className="container-custom"><div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left"><div><h2 className="text-xl font-bold sm:text-2xl">{t('সারাদেশে ক্যাশ অন ডেলিভারি', 'Cash on Delivery Nationwide')}</h2><p className="mt-1 text-sm text-primary-foreground/80">{t('পণ্য হাতে পেয়ে টাকা দিন। ঢাকার ভিতরে ১-২ দিন, ঢাকার বাইরে ২-৫ দিন।', 'Pay when you receive. Inside Dhaka 1-2 days, outside 2-5 days.')}</p></div><Link href="/charges" className="delivery-btn">{t('ডেলিভারি চার্জ দেখুন', 'View Delivery Charges')}</Link></div></div></section>}

      {isSectionEnabled('newsletter') && <section className="section-pad"><div className="container-custom"><div className="newsletter-wrap"><h2 className="section-heading">{t('নতুন অফার ও টিপস পেতে সাবস্ক্রাইব করুন', 'Subscribe for Offers & Tips')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('ইমেইল ঠিকানা দিন এবং বাগান পরিচর্যার টিপস পান', 'Enter your email for gardening tips')}</p><form className="mx-auto mt-6 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); }}><input type="email" placeholder={t('আপনার ইমেইল', 'Your email')} className="input-bangla flex-1" /><button type="submit" className="btn-primary">{t('সাবস্ক্রাইব', 'Subscribe')}</button></form></div></div></section>}
    </div>
  );
}

function TrustItem({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) { return <div className="home-trust-item"><div className="home-trust-icon"><Icon className="h-6 w-6" /></div><div><h3>{title}</h3><p>{text}</p></div></div>; }
function StatItem({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) { return <div className="home-stat-item"><div className="home-stat-icon"><Icon className="h-6 w-6" /></div><div><strong>{title}</strong><span>{text}</span></div></div>; }
function PromoCard({ image, title, text, href, button }: { image: string; title: string; text: string; href: string; button: string }) { return <Link href={href} className="home-promo-card group">{image && <img src={image} alt="" loading="lazy" />}<div className="home-promo-overlay" /><div className="home-promo-content"><h3>{title}</h3><p>{text}</p><span>{button}<ChevronRight className="h-4 w-4" /></span></div></Link>; }
function ProductSection({ title, subtitle, products, theme }: { title: string; subtitle?: string; products: Product[]; theme: HomePageTheme }) { const { t } = useLang(); if (products.length === 0) return null; return <section className="section-pad home-product-section"><div className="container-custom"><div className="mb-6 flex items-center justify-between"><div><h2 className="section-heading">{title}</h2>{subtitle && <p className="section-subheading">{subtitle}</p>}</div><Link href="/all-products" className="view-all-link">{t('সব দেখুন →', 'View All →')}</Link></div><div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} stackedActions />)}</div></div></section>; }
