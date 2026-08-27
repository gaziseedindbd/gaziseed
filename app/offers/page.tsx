'use client';

import { useEffect, useState } from 'react';
import { getOfferProducts } from '@/lib/data';
import type { Product, LandingPage } from '@/lib/supabase/types';
import { ProductCard } from '@/components/site/product-card';
import { Tag } from 'lucide-react';

export default function OffersPage() {
  const [offers, setOffers] = useState<{ product: Product; landing: LandingPage }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOfferProducts().then((o) => {
      setOffers(o);
      setLoading(false);
    });
  }, []);

  return (
    <div className="container-custom py-6">
      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-4 py-1 text-sm font-medium text-destructive">
          <Tag className="h-4 w-4" />
          বিশেষ অফার
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">অফার</h1>
        <p className="mt-1 text-sm text-muted-foreground">বিশেষ বান্ডল অফার এবং ছাড়</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          এই মুহূর্তে কোন অফার নেই
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {offers.map(({ product, landing }) => (
            <div key={product.id} className="relative">
              <ProductCard product={product} />
              <a
                href={`/offer/${landing.landing_slug || product.slug}`}
                className="mt-2 block rounded-lg bg-destructive py-2 text-center text-xs font-bold text-destructive-foreground"
              >
                অফার দেখুন →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
