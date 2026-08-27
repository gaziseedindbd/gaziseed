import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase/client';

const BASE_URL = 'https://www.seedbari.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/all-products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/track-order`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  const { data: products } = await supabase.from('products').select('slug, updated_at, created_at').eq('is_active', true).eq('is_ads_only', false);
  (products || []).forEach((p: any) => {
    entries.push({ url: `${BASE_URL}/product/${p.slug}`, lastModified: new Date(p.updated_at || p.created_at || new Date()), changeFrequency: 'weekly', priority: 0.7 });
  });

  const { data: categories } = await supabase.from('categories').select('slug, updated_at, created_at').eq('is_active', true);
  (categories || []).forEach((c: any) => {
    entries.push({ url: `${BASE_URL}/category/${c.slug}`, lastModified: new Date(c.updated_at || c.created_at || new Date()), changeFrequency: 'weekly', priority: 0.6 });
  });

  // combo_packs has no updated_at column; use created_at for sitemap freshness.
  const { data: combos } = await supabase.from('combo_packs').select('slug, created_at').eq('is_active', true);
  (combos || []).forEach((c: any) => {
    entries.push({ url: `${BASE_URL}/combo/${c.slug}`, lastModified: new Date(c.created_at || new Date()), changeFrequency: 'weekly', priority: 0.6 });
  });

  const { data: posts } = await supabase.from('blog_posts').select('slug, updated_at, created_at').eq('is_published', true);
  (posts || []).forEach((p: any) => {
    entries.push({ url: `${BASE_URL}/blog/${p.slug}`, lastModified: new Date(p.updated_at || p.created_at || new Date()), changeFrequency: 'monthly', priority: 0.5 });
  });

  return entries;
}
