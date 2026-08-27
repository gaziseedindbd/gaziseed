'use client';

import { useEffect, useState } from 'react';
import { getPageBySlug } from '@/lib/data';
import type { Page as PageType } from '@/lib/supabase/types';
import { useParams } from 'next/navigation';

export default function PageDetail() {
  const params = useParams();
  const slug = params.slug as string;
  const [page, setPage] = useState<PageType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPageBySlug(slug).then((p) => {
      setPage(p);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <div className="container-custom py-12"><div className="h-64 animate-pulse rounded-2xl bg-secondary" /></div>;

  if (!page) {
    return (
      <div className="container-custom py-12 text-center">
        <h1 className="text-2xl font-bold">পেজ পাওয়া যায়নি</h1>
        <a href="/" className="mt-4 inline-block text-primary hover:underline">হোমে ফিরুন</a>
      </div>
    );
  }

  return (
    <div className="container-custom py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{page.title}</h1>
        <div className="whitespace-pre-line text-muted-foreground">{page.content}</div>
      </div>
    </div>
  );
}
