'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOfferProducts } from '@/lib/data';
import type { Product, LandingPage } from '@/lib/supabase/types';
import { ProductCard } from '@/components/site/product-card';
import { Tag, ArrowRight, Sparkles } from 'lucide-react';

export default function OffersPage() {
  const [offers, setOffers] = useState<{ product: Product; landing: LandingPage }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getOfferProducts().then((o) => { setOffers(o); setLoading(false); }); }, []);

  return <main className="min-h-screen bg-background">
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.10] via-background to-amber-400/[0.08]">
      <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" /><div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="container-custom relative py-10 text-center sm:py-14"><span className="inline-flex items-center gap-2 rounded-full border border-destructive/15 bg-background/80 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-destructive shadow-sm"><Tag className="h-3.5 w-3.5" /> বিশেষ অফার</span><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">সেরা অফারগুলো একসাথে</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">বিশেষ বান্ডল, ছাড় এবং নির্বাচিত seed products—কম দামে আরও ভালো value নিন।</p></div>
    </section>
    <section className="container-custom py-9 sm:py-12">
      {loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[.82] animate-pulse rounded-3xl bg-secondary/70" />)}</div> : offers.length === 0 ? <div className="mx-auto max-w-xl rounded-[2rem] border border-dashed border-border bg-card p-12 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-black">এই মুহূর্তে কোনো অফার নেই</h2><p className="mt-2 text-sm text-muted-foreground">নতুন অফার এলে এখানে দেখতে পাবেন।</p></div> : <><div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">SPECIAL DEALS</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">আজকের বিশেষ অফার</h2></div><span className="hidden text-sm font-semibold text-muted-foreground sm:block">{offers.length}টি অফার</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">{offers.map(({ product, landing }) => <div key={product.id}><ProductCard product={product} /><Link href={`/offer/${landing.landing_slug || product.slug}`} className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-black text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">অফারটি দেখুন<ArrowRight className="h-3.5 w-3.5" /></Link></div>)}</div></>}
    </section>
  </main>;
}
