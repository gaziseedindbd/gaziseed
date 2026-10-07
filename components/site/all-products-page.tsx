'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ProductCard } from '@/components/site/product-card';
import { useLang } from './language-provider';
import { ThemeWrapper } from '@/components/site/theme-wrapper';
import { getVisitorCountry } from '@/lib/supabase/client';
import type { Product, Category } from '@/lib/supabase/types';
import { SlidersHorizontal, X, ChevronDown, Filter as FilterIcon } from 'lucide-react';



export function AllProductsPage() {
  const searchParams = useSearchParams();
  const { t, tCategoryName } = useLang();
  const sortOptions = [
    { value: 'default', label: t('ডিফল্ট', 'Default', 'डिफ़ॉल्ट') },
    { value: 'featured', label: t('ফিচার্ড', 'Featured', 'चुनिंदा') },
    { value: 'newest', label: t('নতুন', 'Newest', 'नवीनतम') },
    { value: 'best_selling', label: t('বেস্ট সেলিং', 'Best selling', 'सबसे अधिक बिकने वाले') },
    { value: 'price_low', label: t('কম থেকে বেশি দাম', 'Price: low to high', 'मूल्य: कम से अधिक') },
    { value: 'price_high', label: t('বেশি থেকে কম দাম', 'Price: high to low', 'मूल्य: अधिक से कम') },
    { value: 'discount', label: t('সর্বোচ্চ ছাড়', 'Biggest discount', 'सबसे अधिक छूट') },
  ];
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [country, setCountry] = useState<'BD' | 'IN'>(() => getVisitorCountry());
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    const syncCountry = () => setCountry(getVisitorCountry());
    window.addEventListener('gazi-country-changed', syncCountry);
    window.addEventListener('storage', syncCountry);
    return () => {
      window.removeEventListener('gazi-country-changed', syncCountry);
      window.removeEventListener('storage', syncCountry);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = `?country=${country}`;
    const requestHeaders = { 'x-gazi-country': country };
    Promise.all([
      fetch(`/api/products${query}`, { headers: requestHeaders, cache: 'no-store' }).then(async (res) => {
        if (!res.ok) throw new Error('Failed to load products');
        return (await res.json()) as Product[];
      }),
      fetch(`/api/categories${query}`, { headers: requestHeaders, cache: 'no-store' }).then(async (res) => {
        if (!res.ok) throw new Error('Failed to load categories');
        return (await res.json()) as Category[];
      }),
    ])
      .then(([p, c]) => {
        if (cancelled) return;
        setProducts(p); setCategories(c); setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]); setCategories([]); setLoading(false);
      });
    return () => { cancelled = true; };
  }, [country]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (searchQuery) {
      const needle = searchQuery.toLowerCase();
      result = result.filter((p) => p.name_bn?.toLowerCase().includes(needle) || p.name_en?.toLowerCase().includes(needle) || p.sku?.toLowerCase().includes(needle));
    }
    if (selectedCategory) result = result.filter((p) => p.category_id === selectedCategory);
    result = result.filter((p) => { const price = p.sale_price && p.sale_price > 0 && p.sale_price < p.regular_price ? p.sale_price : p.regular_price; return price >= priceRange[0] && price <= priceRange[1]; });
    if (inStockOnly) result = result.filter((p) => p.stock > 0);
    switch (sortBy) {
      case 'price_low': result.sort((a, b) => (a.sale_price || a.regular_price) - (b.sale_price || b.regular_price)); break;
      case 'price_high': result.sort((a, b) => (b.sale_price || b.regular_price) - (a.sale_price || a.regular_price)); break;
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'featured': result.sort((a, b) => Number(b.is_featured) - Number(a.is_featured)); break;
      case 'best_selling': result.sort((a, b) => Number(b.is_best_seller) - Number(a.is_best_seller)); break;
      case 'discount': result.sort((a, b) => (b.regular_price - (b.sale_price || b.regular_price)) - (a.regular_price - (a.sale_price || a.regular_price))); break;
    }
    return result;
  }, [products, searchQuery, selectedCategory, priceRange, inStockOnly, sortBy]);

  const renderFilters = () => <div className="space-y-7">
    <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">{t('ক্যাটাগরি', 'Categories', 'श्रेणियाँ')}</h3><span className="text-[10px] font-bold text-muted-foreground">{categories.length}</span></div><div className="space-y-1">{categories.map((cat) => <label key={cat.id} className="group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition hover:bg-primary/5"><input type="radio" name="category" checked={selectedCategory === cat.id} onChange={() => setSelectedCategory(cat.id)} className="accent-primary" />{tCategoryName(cat.name_bn, cat.name_en)}</label>)}<label className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary"><input type="radio" name="category" checked={!selectedCategory} onChange={() => setSelectedCategory('')} className="accent-primary" />{t('সকল ক্যাটাগরি', 'All categories', 'सभी श्रेणियाँ')}</label></div></div>
    <div className="border-t border-border/70 pt-6"><h3 className="mb-3 text-sm font-black">{t('দামের পরিসর', 'Price range', 'मूल्य सीमा')}</h3><div className="flex items-center gap-2"><input type="number" value={priceRange[0]} onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])} className="input-bangla px-3 py-2" placeholder={t('ন্যূনতম', 'Minimum', 'न्यूनतम')} aria-label={t('সর্বনিম্ন মূল্য', 'Minimum price', 'न्यूनतम मूल्य')} min="0" /><span className="text-muted-foreground">—</span><input type="number" value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])} className="input-bangla px-3 py-2" placeholder={t('সর্বোচ্চ', 'Maximum', 'अधिकतम')} aria-label={t('সর্বোচ্চ মূল্য', 'Maximum price', 'अधिकतम मूल्य')} min="0" /></div></div>
    <label className="flex cursor-pointer items-center gap-3 border-t border-border/70 pt-6 text-sm font-bold"><input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-primary" />{t('শুধু স্টকে আছে', 'In stock only', 'केवल स्टॉक में')}</label>
  </div>;

  return <div className="container-custom py-7 sm:py-10">
    <section className="relative mb-7 overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-accent/10 px-5 py-5 sm:px-7 sm:py-6"><div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl" /><div className="relative flex items-center justify-between gap-6"><div className="min-w-0"><span className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">GAZI SEED</span><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{searchQuery ? t(`সার্চ: “${searchQuery}”`, `Search: “${searchQuery}”`, `खोज: “${searchQuery}”`) : t('সকল প্রোডাক্ট', 'All Products', 'सभी उत्पाद')}</h1><p className="mt-2 text-sm text-muted-foreground">{t('আপনার প্রয়োজনের বীজ ও কৃষি পণ্য সহজেই খুঁজে নিন', 'Find the seeds and growing essentials you need', 'अपने लिए बीज और खेती की ज़रूरी सामग्री खोजें')}</p></div><div className="hidden shrink-0 items-center gap-3 lg:flex" aria-hidden="true">{categories.filter((cat) => cat.image).slice(0, 3).map((cat) => <div key={cat.id} className="relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-white shadow-sm"><Image src={cat.image} alt="" fill sizes="80px" className="object-cover" /></div>)}</div></div></section>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4"><p className="text-sm font-bold text-muted-foreground">{t(`${filteredProducts.length} টি প্রোডাক্ট পাওয়া গেছে`, `${filteredProducts.length} products found`, `${filteredProducts.length} उत्पाद मिले`)}</p><div className="flex gap-2"><button onClick={() => setShowFilters(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold md:hidden"><FilterIcon className="h-4 w-4" /> {t('ফিল্টার', 'Filters', 'फ़िल्टर')}</button><div className="relative"><select aria-label={t('সাজান', 'Sort products', 'उत्पाद क्रम चुनें')} value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="min-h-11 max-w-[190px] appearance-none rounded-xl border border-border bg-card py-2 pl-3 pr-9 text-xs font-bold outline-none focus:border-primary">{sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /></div></div></div>
    <div className="mt-6 flex gap-7"><aside className="hidden w-64 shrink-0 md:block"><div className="sticky top-32 rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /><h2 className="font-black">{t('ফিল্টার', 'Filters', 'फ़िल्टर')}</h2></div>{renderFilters()}</div></aside><div className="min-w-0 flex-1">{loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[.82] animate-pulse rounded-2xl bg-secondary" />)}</div> : filteredProducts.length === 0 ? <div className="rounded-[1.5rem] border border-border bg-card p-14 text-center"><p className="font-bold text-muted-foreground">{t('কোন প্রোডাক্ট পাওয়া যায়নি', 'No products found', 'कोई उत्पाद नहीं मिला')}</p></div> : <ThemeWrapper><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} stackedActions />)}</div></ThemeWrapper>}</div></div>
    {showFilters && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFilters(false)} /><div className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-[2rem] bg-background p-6 shadow-2xl"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-black">{t('ফিল্টার', 'Filters', 'फ़िल्टर')}</h2><button onClick={() => setShowFilters(false)} aria-label={t('ফিল্টার বন্ধ করুন', 'Close filters', 'फ़िल्टर बंद करें')} className="flex h-11 w-11 items-center justify-center rounded-full bg-muted"><X className="h-5 w-5" /></button></div>{renderFilters()}<button onClick={() => setShowFilters(false)} className="mt-7 w-full btn-primary">{t(`${filteredProducts.length} টি প্রোডাক্ট দেখুন`, `Show ${filteredProducts.length} products`, `${filteredProducts.length} उत्पाद देखें`)}</button></div></div>}
  </div>;
}