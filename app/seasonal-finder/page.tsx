'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSeasonalProducts } from '@/lib/data';
import { ProductCard } from '@/components/site/product-card';
import type { Product } from '@/lib/supabase/types';
import { useFeatureFlags } from '@/components/site/feature-provider';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Leaf,
  RotateCcw,
  SlidersHorizontal,
  Sprout,
} from 'lucide-react';

const months = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const growingTypes = [
  { value: 'Rooftop', label: 'ছাদ বাগান' },
  { value: 'Pot/Container', label: 'টব / কনটেইনার' },
  { value: 'Field', label: 'মাঠে চাষ' },
];

export default function SeasonalFinderPage() {
  const currentMonth = useMemo(() => months[new Date().getMonth()], []);
  const [month, setMonth] = useState(currentMonth);
  const [growingType, setGrowingType] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const { ready, enabled } = useFeatureFlags();

  const selectedGrowingType = growingTypes.find((type) => type.value === growingType);
  const hasFilters = month !== currentMonth || Boolean(growingType);

  useEffect(() => {
    if (!ready || !enabled('enable_seasonal_finder')) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    getSeasonalProducts(month, growingType || undefined)
      .then((data) => {
        if (cancelled) return;
        setResults(data);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, growingType, ready, enabled, retryKey]);

  if (!ready) return null;

  if (!enabled('enable_seasonal_finder')) {
    return (
      <main className="min-h-[60vh] bg-background">
        <div className="container-custom py-16 sm:py-24">
          <div className="mx-auto max-w-md rounded-[2rem] border border-border/70 bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sprout className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-xl font-black tracking-tight">এই ফিচারটি বর্তমানে বন্ধ আছে</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              মৌসুমি সিড ফাইন্ডার বর্তমানে সক্রিয় নয়। পরে আবার চেষ্টা করুন।
            </p>
          </div>
        </div>
      </main>
    );
  }

  const resetFilters = () => {
    setMonth(currentMonth);
    setGrowingType('');
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_38%),radial-gradient(circle_at_top_right,hsl(45_100%_50%/0.10),transparent_34%)]">
        <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="container-custom relative py-10 sm:py-14 lg:py-16">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur sm:text-[11px]">
              <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
              Seasonal Guide
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              সঠিক মৌসুমে সঠিক বীজ
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              আপনার চাষের জায়গা ও মাস বেছে নিন। GAZI SEED আপনার জন্য উপযোগী বীজগুলো খুঁজে দেবে।
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:mt-10 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-left shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">মৌসুম</p>
                  <p className="mt-0.5 text-sm font-black">{month}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-left shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Leaf className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">চাষের ধরন</p>
                  <p className="mt-0.5 text-sm font-black">{selectedGrowingType?.label ?? 'সব ধরনের চাষ'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-left shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Check className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">ফলাফল</p>
                  <p className="mt-0.5 text-sm font-black">{loading ? 'খোঁজা হচ্ছে…' : `${results.length}টি বীজ`}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-custom py-8 sm:py-10 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-border/70 bg-card p-4 shadow-sm sm:p-6 lg:p-7">
            <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  </span>
                  আপনার ফিল্টার
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
                  মাস এবং চাষের ধরন নির্বাচন করে ফলাফল আরও নির্দিষ্ট করুন।
                </p>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-border bg-background px-3.5 text-xs font-black text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:self-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  ফিল্টার রিসেট
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="group relative block text-sm font-bold text-foreground">
                <span className="mb-2 block">কোন মাসে চাষ করবেন?</span>
                <span className="relative block">
                  <select
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    aria-label="চাষের মাস নির্বাচন করুন"
                    className="input-bangla h-12 w-full appearance-none rounded-xl border-border/70 bg-background pr-11 font-semibold transition focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    {months.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition group-focus-within:text-primary" aria-hidden="true" />
                </span>
              </label>

              <label className="group relative block text-sm font-bold text-foreground">
                <span className="mb-2 block">কোথায় চাষ করবেন?</span>
                <span className="relative block">
                  <select
                    value={growingType}
                    onChange={(event) => setGrowingType(event.target.value)}
                    aria-label="চাষের ধরন নির্বাচন করুন"
                    className="input-bangla h-12 w-full appearance-none rounded-xl border-border/70 bg-background pr-11 font-semibold transition focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    <option value="">সব ধরনের চাষ</option>
                    {growingTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition group-focus-within:text-primary" aria-hidden="true" />
                </span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="rounded-full bg-secondary px-3 py-1.5">{month}</span>
              {selectedGrowingType && <span className="rounded-full bg-secondary px-3 py-1.5">{selectedGrowingType.label}</span>}
              <span className="ml-auto hidden text-right sm:block">ফলাফল স্বয়ংক্রিয়ভাবে আপডেট হবে</span>
            </div>
          </div>

          <div className="mb-5 mt-9 flex items-end justify-between gap-4 sm:mb-6 sm:mt-11">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary sm:text-[11px]">
                Recommended Seeds
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">আপনার জন্য বাছাই করা বীজ</h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {loading ? 'আপনার জন্য সেরা মিল খোঁজা হচ্ছে…' : error ? 'ফলাফল লোড করা যায়নি' : `${results.length}টি মিল পাওয়া গেছে`}
              </p>
            </div>
            {!loading && !error && results.length > 0 && (
              <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
                {results.length}টি ফলাফল
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-[1.35rem] border border-border/50 bg-card shadow-sm">
                  <div className="aspect-[0.84] animate-pulse bg-secondary/80" />
                  <div className="space-y-2 p-3 sm:p-4">
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-secondary/80" />
                    <div className="h-4 w-full animate-pulse rounded-full bg-secondary/80" />
                    <div className="h-8 w-full animate-pulse rounded-lg bg-secondary/80" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-dashed border-destructive/30 bg-destructive/[0.04] p-10 text-center sm:p-14">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <RotateCcw className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-black">ফলাফল দেখানো যাচ্ছে না</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                সাময়িকভাবে সমস্যা হয়েছে। আবার চেষ্টা করুন অথবা অন্য মাস বেছে নিন।
              </p>
              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-border bg-card p-10 text-center shadow-sm sm:p-14">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-black">এই নির্বাচনে কোনো বীজ পাওয়া যায়নি</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                অন্য মাস বা চাষের ধরন নির্বাচন করে আবার চেষ্টা করুন।
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-black transition hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  ডিফল্ট ফিল্টারে ফিরুন
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
