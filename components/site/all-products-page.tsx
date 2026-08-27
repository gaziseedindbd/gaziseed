'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/site/product-card';
import { ThemeWrapper } from '@/components/site/theme-wrapper';
import { getProducts, getCategories } from '@/lib/data';
import type { Product, Category } from '@/lib/supabase/types';
import { SlidersHorizontal, X } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'default', label: 'ডিফল্ট' },
  { value: 'featured', label: 'ফিচার্ড' },
  { value: 'newest', label: 'নতুন' },
  { value: 'best_selling', label: 'বেস্ট সেলিং' },
  { value: 'price_low', label: 'কম থেকে বেশি দাম' },
  { value: 'price_high', label: 'বেশি থেকে কম দাম' },
  { value: 'discount', label: 'সর্বোচ্চ ছাড়' },
];

export function AllProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [inStockOnly, setInStockOnly] = useState(false);

  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    Promise.all([
      getProducts({ search: searchQuery || undefined }),
      getCategories(),
    ]).then(([p, c]) => {
      setProducts(p);
      setCategories(c);
      setLoading(false);
    });
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory) {
      result = result.filter((p) => p.category_id === selectedCategory);
    }
    result = result.filter((p) => {
      const price = p.sale_price && p.sale_price > 0 && p.sale_price < p.regular_price ? p.sale_price : p.regular_price;
      return price >= priceRange[0] && price <= priceRange[1];
    });
    if (inStockOnly) {
      result = result.filter((p) => p.stock > 0);
    }

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
      case 'featured':
        result.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
        break;
      case 'best_selling':
        result.sort((a, b) => Number(b.is_best_seller) - Number(a.is_best_seller));
        break;
      case 'discount':
        result.sort((a, b) => {
          const da = a.regular_price - (a.sale_price || a.regular_price);
          const db = b.regular_price - (b.sale_price || b.regular_price);
          return db - da;
        });
        break;
    }

    return result;
  }, [products, selectedCategory, priceRange, inStockOnly, sortBy]);

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Category filter */}
      <div>
        <h3 className="mb-3 font-semibold text-foreground">ক্যাটাগরি</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="category"
              checked={!selectedCategory}
              onChange={() => setSelectedCategory('')}
              className="accent-primary"
            />
            সকল ক্যাটাগরি
          </label>
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                checked={selectedCategory === cat.id}
                onChange={() => setSelectedCategory(cat.id)}
                className="accent-primary"
              />
              {cat.name_bn}
            </label>
          ))}
        </div>
      </div>

      {/* Price filter */}
      <div>
        <h3 className="mb-3 font-semibold text-foreground">দাম</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={priceRange[0]}
            onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm"
            placeholder="ন্যূনতম"
          />
          <span>-</span>
          <input
            type="number"
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm"
            placeholder="সর্বোচ্চ"
          />
        </div>
      </div>

      {/* Stock filter */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="accent-primary"
          />
          শুধু স্টকে আছে
        </label>
      </div>
    </div>
  );

  return (
    <div className="container-custom py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {searchQuery ? `সার্চ: "${searchQuery}"` : 'সকল প্রোডাক্ট'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{filteredProducts.length} টি প্রোডাক্ট পাওয়া গেছে</p>
      </div>

      <div className="flex gap-6">
        {/* Desktop filters sidebar */}
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-32 rounded-2xl border border-border bg-card p-5">
            <FilterContent />
          </div>
        </aside>

        {/* Products */}
        <div className="flex-1">
          {/* Sort bar */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium md:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              ফিল্টার
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm outline-none focus:border-primary"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">কোন প্রোডাক্ট পাওয়া যায়নি</p>
            </div>
          ) : (
            <ThemeWrapper>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} stackedActions />
                ))}
              </div>
            </ThemeWrapper>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">ফিল্টার</h2>
              <button onClick={() => setShowFilters(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <FilterContent />
            <button
              onClick={() => setShowFilters(false)}
              className="mt-6 w-full btn-primary"
            >
              {filteredProducts.length} টি প্রোডাক্ট দেখুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
