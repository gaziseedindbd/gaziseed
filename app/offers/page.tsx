'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOfferProducts } from '@/lib/data';
import type { Product, LandingPage } from '@/lib/supabase/types';
import { ProductCard } from '@/components/site/product-card';
import { Tag, ArrowRight, Sparkles, BadgePercent } from 'lucide-react';

export default function OffersPage() {
  const [offers, setOffers] = useState<{ product: Product; landing: LandingPage }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getOfferProducts().then((o) => { setOffers(o); setLoading(false); }); }, []);
  return <main className="min-h-screen bg-gradient-to-b from-primary/[0.025] via-background to-background">
    <section className="relative isolate overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/[0.12] via-background to-amber-400/[0.10]">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" /><div className="pointer-events-none absolute -right-24 -top-16 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="container-custom relative py-11 sm:py-16"><div className="mx-auto max-w-3xl text-center"><span className="inline-flex items-center gap-2 rounded-full border border-destructive/15 bg-background/85 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-destructive shadow-sm"><Tag className="h-3.5 w-3.5" /> GAZI SEED • SPECIAL OFFERS</span><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">সেরা অফারগুলো একসাথে</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">বিশেষ ছাড় ও নির্বাচিত বীজ—ভালো value-তে আপনার পরবর্তী চাষের প্রস্তুতি নিন।</p></div></div>
    </section>
    <section className="container-custom py-9 sm:py-12">
      {loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[.82] animate-pulse rounded-[1.5rem] border border-border/50 bg-card shadow-sm" />)}</div> : offers.length === 0 ? <div className="mx-auto max-w-xl rounded-[2rem] border border-dashed border-primary/20 bg-card p-10 text-center shadow-sm sm:p-12"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-black">এই মুহূর্তে কোনো অফার নেই</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">নতুন অফার এলে এখানে দেখতে পাবেন।</p><Link href="/all-products" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/15 transition hover:-translate-y-0.5 hover:shadow-xl">সব পণ্য দেখুন<ArrowRight className="h-4 w-4" /></Link></div> : <><div className="mb-6 flex items-end justify-between gap-4 rounded-2xl border border-primary/10 bg-card/70 p-4 shadow-sm sm:p-5"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">SPECIAL DEALS</p><h2 className="mt-1 text-xl font-black sm:text-2xl">আজকের বিশেষ অফার</h2></div><span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary"><BadgePercent className="h-3.5 w-3.5" />{offers.length}টি অফার</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">{offers.map(({ product, landing }) => <div key={product.id} className="min-w-0"><ProductCard product={product} /><Link href={`/offer/${landing.landing_slug || product.slug}`} className="mt-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-black text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">অফারটি দেখুন<ArrowRight className="h-3.5 w-3.5" /></Link></div>)}</div></>}
    </section>
  </main>;
}
