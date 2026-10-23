import { notFound } from 'next/navigation';
import CategoryPageClient from '@/components/site/category-page-client';
import { getSeoCountry } from '@/lib/seo-metadata';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Category, Product } from '@/lib/supabase/types';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const country = await getSeoCountry();
  const supabase = await createServerSupabase(country);
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  if (categoryError) throw categoryError;
  if (!category) notFound();

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('country_code', country)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('products')
      .select('*')
      .eq('category_id', category.id)
      .eq('country_code', country)
      .eq('is_active', true)
      .eq('is_ads_only', false)
      .order('created_at', { ascending: false }),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (productsResult.error) throw productsResult.error;

  return (
    <CategoryPageClient
      slug={slug}
      initialCategory={category as Category}
      initialProducts={(productsResult.data || []) as Product[]}
      initialCategories={(categoriesResult.data || []) as Category[]}
    />
  );
}
