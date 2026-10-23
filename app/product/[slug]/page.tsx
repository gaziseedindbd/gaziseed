import { notFound } from 'next/navigation';
import ProductDetailClient from '@/components/site/product-detail-client';
import { getSeoCountry } from '@/lib/seo-metadata';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Product } from '@/lib/supabase/types';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const country = await getSeoCountry();
  const supabase = await createServerSupabase(country);
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!product) notFound();

  return <ProductDetailClient slug={slug} initialProduct={product as Product} />;
}
