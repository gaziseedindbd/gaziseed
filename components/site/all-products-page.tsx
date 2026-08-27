'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/site/product-card';
import { ThemeWrapper } from '@/components/site/theme-wrapper';
import { getProducts, getCategories } from '@/lib/data';
import type { Product, Category } from '@/lib/supabase/types';
import { SlidersHorizontal, X, ChevronDown, Filter as FilterIcon } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'default', label: 'ডিফল্ট' }, { value: 'featured', label: 'ফিচার্ড' }, { value: 'newest', label: 'নতুন' },
  { value: 'best_selling', label: 'বেস্ট সেলিং' }, { value: 'price_low', label: 'কম থেকে বেশি দাম' },
  { value: 'price_high', label: 'বেশি থেকে কম দাম' }, { value: 'discount', label: 'সর্বোচ্চ ছাড়' },
];

export function AllProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true); const [showFilters, setShowFilters] = useState(false); const [sortBy, setSortBy] = useState('default');
  const [selectedCategory, setSelectedCategory] = useState<string>(''); const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]); const [inStockOnly, setInStockOnly] = useState(false);
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => { Promise.all([getProducts({ search: searchQuery || undefined }), getCategories()]).then(([p, c]) => { setProducts(p); setCategories(c); setLoading(false); }); }, [searchQuery]);
  const filteredProducts = useMemo(() => {
    let result = [...products];
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
  }, [products, selectedCategory, priceRange, inStockOnly, sortBy]);

  const FilterContent = () => <div className="space-y-7">
    <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">ক্যাটাগরি</h3><span className="text-[10px] font-bold text-muted-foreground">{categories.length} টি</span></div><div className="space-y-1">{categories.map((cat) => <label key={cat.id} className="group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition hover:bg-primary/5"><input type="radio" name="category" checked={selectedCategory === cat.id} onChange={() => setSelectedCategory(cat.id)} className="accent-primary" />{cat.name_bn}</label>)}<label className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary"><input type="radio" name="category" checked={!selectedCategory} onChange={() => setSelectedCategory('')} className="accent-primary" />সকল ক্যাটাগরি</label></div></div>
    <div className="border-t border-border/70 pt-6"><h3 className="mb-3 text-sm font-black">দামের পরিসর</h3><div className="flex items-center gap-2"><input type="number" value={priceRange[0]} onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])} className="input-bangla px-3 py-2" placeholder="ন্যূনতম" /><span className="text-muted-foreground">—</span><input type="number" value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])} className="input-bangla px-3 py-2" placeholder="সর্বোচ্চ" /></div></div>
    <label className="flex cursor-pointer items-center gap-3 border-t border-border/70 pt-6 text-sm font-bold"><input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-primary" />শুধু স্টকে আছে</label>
  </div>;

  return <div className="container-custom py-7 sm:py-10">
    <section className="relative mb-7 overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-accent/10 px-5 py-7 sm:px-8 sm:py-9"><div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl" /><div className="relative"><span className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">SUPER KING SEED</span><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{searchQuery ? `সার্চ: “${searchQuery}”` : 'সকল প্রোডাক্ট'}</h1><p className="mt-2 text-sm text-muted-foreground">আপনার প্রয়োজনের বীজ ও কৃষি পণ্য সহজেই খুঁজে নিন</p></div></section>
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-4"><p className="text-sm font-bold text-muted-foreground"><span className="text-foreground">{filteredProducts.length}</span> টি প্রোডাক্ট পাওয়া গেছে</p><div className="flex gap-2"><button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold md:hidden"><FilterIcon className="h-4 w-4" /> ফিল্টার</button><div className="relative"><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="appearance-none rounded-xl border border-border bg-card py-2 pl-3 pr-9 text-xs font-bold outline-none focus:border-primary">{SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /></div></div></div>
    <div className="mt-6 flex gap-7"><aside className="hidden w-64 shrink-0 md:block"><div className="sticky top-32 rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /><h2 className="font-black">ফিল্টার</h2></div><FilterContent /></div></aside><div className="min-w-0 flex-1">{loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[.82] animate-pulse rounded-2xl bg-secondary" />)}</div> : filteredProducts.length === 0 ? <div className="rounded-[1.5rem] border border-border bg-card p-14 text-center"><p className="font-bold text-muted-foreground">কোন প্রোডাক্ট পাওয়া যায়নি</p></div> : <ThemeWrapper><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} stackedActions />)}</div></ThemeWrapper>}</div></div>
    {showFilters && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFilters(false)} /><div className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-[2rem] bg-background p-6 shadow-2xl"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-black">ফিল্টার</h2><button onClick={() => setShowFilters(false)} className="rounded-full bg-muted p-2"><X className="h-5 w-5" /></button></div><FilterContent /><button onClick={() => setShowFilters(false)} className="mt-7 w-full btn-primary">{filteredProducts.length} টি প্রোডাক্ট দেখুন</button></div></div>}
  </div>;
}
