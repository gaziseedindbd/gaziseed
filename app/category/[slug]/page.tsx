'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ProductCard } from '@/components/site/product-card';
import { getCategoryBySlug, getProducts, getCategories } from '@/lib/data';
import type { Category, Product } from '@/lib/supabase/types';
import { SlidersHorizontal, X, Sparkles, Package, ArrowRight, Layers, Crown, ShieldCheck } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('default');
  const [showFilters, setShowFilters] = useState(false);
  const { lang, t, tDb } = useLang();

  useEffect(() => {
    Promise.all([
      getCategoryBySlug(slug),
      getProducts({ category_id: undefined }),
      getCategories(),
    ]).then(([cat, prods, cats]) => {
      setCategory(cat);
      setProducts(prods);
      setCategories(cats);
      setLoading(false);
    });
  }, [slug]);

  const categoryProducts = useMemo(() => {
    let result = products.filter((p) => p.category_id === category?.id);
    switch (sortBy) {
      case 'price_low':
        result.sort((a, b) => (a.sale_price || a.regular_price) - (b.sale_price || b.regular_price));
        break;
      case 'price_high':
        result.sort((a, b) => (b.sale_price || b.regular_price) - (a.sale_price || a.regular_price));
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return result;
  }, [products, category, sortBy]);

  const categoryName = category ? (lang === 'en' && (category as any).name_en ? (category as any).name_en : category.name_bn) : '';
  const categoryDesc = category ? tDb(category.description || '') : '';

  if (!loading && !category) {
    return (
      <div className="container-custom py-36 text-center space-y-6">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[36px] bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent text-primary shadow-2xl backdrop-blur-xl border border-primary/20 animate-pulse">
          <Package className="h-14 w-14" />
        </div>
        <h1 className="text-4xl font-black tracking-tight">{t('ক্যাটাগরি পাওয়া যায়নি', 'Category Not Found')}</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">{t('আপনি যে ক্যাটাগরি খুঁজছেন তা হয়তো সরানো হয়েছে অথবা আর নেই।', 'The category you are looking for may have been removed or no longer exists.')}</p>
        <Link href="/" className="inline-flex items-center gap-2.5 rounded-[22px] bg-primary px-9 py-4 text-xs font-black text-primary-foreground hover:bg-primary/90 transition-all shadow-2xl shadow-primary/40 hover:scale-105">
          {t('হোম পেজে ফিরে যান', 'Back to Home')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* 🌟 লাক্সারি গ্ল্যামারাস হিরো ব্যানার */}
      <div className="relative overflow-hidden bg-card border-b border-border/60">
        {category?.banner ? (
          <div className="relative h-96 sm:h-[500px] w-full overflow-hidden">
            <img src={category.banner} alt={categoryName} className="h-full w-full object-cover scale-105 transition-transform duration-1000 hover:scale-100" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-black/70 to-black/30 backdrop-blur-[3px]" />
            <div className="absolute inset-0 flex flex-col items-center justify-end text-center p-8 sm:p-16 max-w-5xl mx-auto space-y-5">
              <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/15 backdrop-blur-2xl text-white text-xs font-black tracking-widest uppercase border border-white/30 shadow-2xl">
                <Crown className="h-4 w-4 text-amber-400 fill-amber-400 animate-bounce" /> {t('সিড বাড়ি প্রিমিয়াম লাক্সারি', 'Seed Bari Premium Luxury')}
              </div>
              <h1 className="text-5xl sm:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">{categoryName}</h1>
              {categoryDesc && (
                <p className="text-sm sm:text-base text-gray-200 max-w-2xl line-clamp-2 drop-shadow-md leading-relaxed font-medium">{categoryDesc}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden bg-gradient-to-tr from-primary/25 via-background to-secondary/60 py-28 sm:py-36 px-4 text-center">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_2px,transparent_2px)] [background-size:28px_28px]" />
            <div className="relative z-10 max-w-4xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary/20 text-primary text-xs font-black tracking-widest uppercase shadow-md border border-primary/30 backdrop-blur-xl">
                <Crown className="h-4 w-4 text-primary fill-primary animate-pulse" /> {t('এক্সক্লুসিভ কালেকশন', 'Exclusive Collection')}
              </div>
              <h1 className="text-5xl sm:text-8xl font-black tracking-tighter text-foreground drop-shadow-sm">{categoryName}</h1>
              {categoryDesc && (
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto font-medium">{categoryDesc}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🌟 প্রিমিয়াম স্টিকি ক্যাটাগরি পিলস স্ক্রোলিং বার */}
      <div className="border-b border-border/80 bg-secondary/50 backdrop-blur-2xl sticky top-0 z-30 shadow-md">
        <div className="container-custom flex items-center gap-3 overflow-x-auto py-4.5 no-scrollbar">
          <span className="text-xs font-black text-muted-foreground uppercase tracking-widest shrink-0 flex items-center gap-2 mr-2">
            <Layers className="h-4 w-4 text-primary" /> {t('ক্যাটাগরি:', 'Category:')}
          </span>
          {categories.map((cat) => {
            const catTitle = lang === 'en' && (cat as any).name_en ? (cat as any).name_en : cat.name_bn;
            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className={`px-6 py-3 rounded-[20px] text-xs font-black whitespace-nowrap transition-all duration-300 shrink-0 ${
                  cat.id === category?.id
                    ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/40 scale-105'
                    : 'bg-card text-muted-foreground border border-border/80 hover:border-primary/80 hover:text-foreground hover:scale-102 shadow-xs'
                }`}
              >
                {catTitle}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 🌟 মূল কনটেন্ট এবং প্রিমিয়াম প্রোডাক্ট গ্রিড */}
      <div className="container-custom py-12">
        <div className="space-y-10">
          
          {/* প্রিমিয়াম ফিল্টার ও সর্ট কন্ট্রোল বার */}
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2.5 rounded-[20px] bg-secondary px-6 py-3.5 text-xs font-black hover:bg-secondary/80 transition md:hidden cursor-pointer border border-border shadow-xs"
              >
                <SlidersHorizontal className="h-4 w-4 text-primary" /> {t('সকল ক্যাটাগরি', 'All Categories')}
              </button>
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[20px] bg-primary/15 text-primary font-black text-sm shadow-inner">
                  {categoryProducts.length}
                </span>
                <span className="text-sm sm:text-base font-black text-foreground">{t('টি প্রিমিয়াম পণ্য উপলব্ধ', 'Premium products available')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3.5 w-full sm:w-auto">
              <span className="text-xs font-black text-muted-foreground hidden sm:inline">{t('সাজান:', 'Sort by:')}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input-bangla text-xs py-3.5 w-full sm:w-64 bg-background font-black shadow-xs border-border/80 rounded-[20px] outline-none focus:ring-4 focus:ring-primary/25 transition-all cursor-pointer"
              >
                <option value="default">{t('ডিফল্ট ক্রমানুসারে', 'Default order')}</option>
                <option value="newest">{t('সর্বশেষ সংযোজিত', 'Newest added')}</option>
                <option value="price_low">{t('মূল্য: কম থেকে বেশি', 'Price: Low to High')}</option>
                <option value="price_high">{t('মূল্য: বেশি থেকে কম', 'Price: High to Low')}</option>
              </select>
            </div>
          </div>

          {/* ট্রাস্ট ব্যাজেস (প্রিমিয়াম টাচ) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-[24px] bg-card border border-border/60 shadow-xs">
              <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
              <div>
                <h4 className="text-xs font-black text-foreground">{t('১০০% খাঁটি বীজ', '100% Pure Seeds')}</h4>
                <p className="text-[10px] text-muted-foreground">{t('পরীক্ষিত ও সার্টিফাইড', 'Tested & Certified')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-[24px] bg-card border border-border/60 shadow-xs">
              <Sparkles className="h-6 w-6 text-amber-500 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-foreground">{t('হাই জার্মিনেশন রেট', 'High Germination Rate')}</h4>
                <p className="text-[10px] text-muted-foreground">{t('অঙ্কুরোদগমের গ্যারান্টি', 'Germination Guarantee')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-[24px] bg-card border border-border/60 shadow-xs">
              <Package className="h-6 w-6 text-primary shrink-0" />
              <div>
                <h4 className="text-xs font-black text-foreground">{t('নিরাপদ প্যাকেজিং', 'Safe Packaging')}</h4>
                <p className="text-[10px] text-muted-foreground">{t('আর্দ্রতামুক্ত এয়ারটাইট প্যাক', 'Moisture-free Airtight Pack')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-[24px] bg-card border border-border/60 shadow-xs">
              <Crown className="h-6 w-6 text-amber-500 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-foreground">{t('বিশেষ গার্ডেনিং টিপস', 'Special Gardening Tips')}</h4>
                <p className="text-[10px] text-muted-foreground">{t('ফ্রি গাইডেন্স সাপোর্ট', 'Free Guidance Support')}</p>
              </div>
            </div>
          </div>

          {/* প্রোডাক্ট গ্রিড */}
          {loading ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-[32px] bg-secondary/80 shadow-md" />
              ))}
            </div>
          ) : categoryProducts.length === 0 ? (
            <div className="rounded-[36px] border border-border bg-card p-24 text-center space-y-6 shadow-md">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-secondary text-muted-foreground shadow-inner">
                <Package className="h-10 w-10" />
              </div>
              <div className="space-y-2.5 max-w-md mx-auto">
                <h3 className="font-black text-2xl text-foreground">{t('এই ক্যাটাগরিতে কোনো পণ্য নেই', 'No products found in this category')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">{t('খুব শীঘ্রই এই ক্যাটাগরিতে নতুন ও আকর্ষণীয় বীজ ও গার্ডেনিং পণ্য যুক্ত করা হবে। আমাদের সাথেই থাকুন।', 'New and attractive seeds and gardening products will be added to this category very soon. Stay with us.')}</p>
              </div>
              <Link href="/" className="inline-block rounded-[22px] bg-primary px-9 py-4 text-xs font-black text-primary-foreground hover:bg-primary/90 transition shadow-xl shadow-primary/25">
                {t('অন্যান্য পণ্য দেখুন', 'View other products')}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {categoryProducts.map((product) => (
                <ProductCard key={product.id} product={product} stackedActions />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* মোবাইল ড্রয়ার মোড */}
      {showFilters && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity" onClick={() => setShowFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-[40px] bg-card p-8 shadow-2xl border-t border-border space-y-6 animate-slide-up">
            <div className="flex items-center justify-between border-b border-border/80 pb-5">
              <h2 className="font-black text-lg flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary fill-primary" /> {t('ক্যাটাগরি সমূহ', 'Categories')}
              </h2>
              <button onClick={() => setShowFilters(false)} className="rounded-full p-3 bg-secondary hover:bg-secondary/80 transition"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 pb-8">
              {categories.map((cat) => {
                const catTitle = lang === 'en' && (cat as any).name_en ? (cat as any).name_en : cat.name_bn;
                return (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    onClick={() => setShowFilters(false)}
                    className={`block rounded-[20px] px-6 py-4 text-xs font-black transition-all ${
                      cat.id === category?.id 
                        ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/40 scale-102' 
                        : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {catTitle}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
