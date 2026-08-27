'use client';

import { useEffect, useState } from 'react';
import { getSeasonalProducts } from '@/lib/data';
import { ProductCard } from '@/components/site/product-card';
import type { Product } from '@/lib/supabase/types';
import { useFeatureFlags } from '@/components/site/feature-provider';

const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const growingTypes = ['Rooftop', 'Pot/Container', 'Field'];

export default function SeasonalFinderPage() {
  const [month, setMonth] = useState(months[new Date().getMonth()]);
  const [growingType, setGrowingType] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { ready, enabled } = useFeatureFlags();

  useEffect(() => {
    if (!ready || !enabled('enable_seasonal_finder')) return;
    setLoading(true);
    getSeasonalProducts(month, growingType || undefined).then((data) => {
      setResults(data);
      setLoading(false);
    });
  }, [month, growingType, ready, enabled]);

  if (!ready) return null;

  if (!enabled('enable_seasonal_finder')) {
    return (
      <div className="container-custom py-24 text-center">
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8">
          <h1 className="text-lg font-bold text-foreground">এই ফিচারটি বর্তমানে বন্ধ আছে</h1>
          <p className="mt-2 text-sm text-muted-foreground">মৌসুমি সিড ফাইন্ডার বর্তমানে সক্রিয় নয়।</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom py-8">
      <h1 className="mb-6 text-2xl font-bold">মৌসুমি বীজ খুঁজুন</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="input-bangla min-w-[160px]">
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={growingType} onChange={(e) => setGrowingType(e.target.value)} className="input-bangla min-w-[160px]">
          <option value="">সব ধরন</option>
          {growingTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-secondary" />
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <p className="p-8 text-center text-muted-foreground">এই মাসে কোন বীজ পাওয়া যায়নি। অন্য মাস বা ধরন নির্বাচন করুন।</p>
      )}
    </div>
  );
}
