import { MetadataRoute } from 'next';
const BASE_URL = 'https://www.gaziseed.com';
const FALLBACK_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_KEY = 'sb_publishable_vCaz5OGrHocUTgpOXmE9xg_QVsuUJc0';

type Country = 'BD' | 'IN';

async function fetchCountryRows<T>(table: 'products' | 'categories', country: Country): Promise<T[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_KEY;
  const params = new URLSearchParams({
    select: 'slug,updated_at,created_at',
    is_active: 'eq.true',
    country_code: 'eq.' + country,
  });
  if (table === 'products') params.set('is_ads_only', 'eq.false');
  const response = await fetch(supabaseUrl + '/rest/v1/' + table + '?' + params.toString(), {
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'x-gazi-country': country },
    cache: 'no-store',
  });
  if (!response.ok) return [];
  return (await response.json()) as T[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/all-products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/track-order`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  for (const country of ['BD', 'IN'] as const) {
    const products = await fetchCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('products', country);
    products.forEach((p) => {
      entries.push({ url: BASE_URL + '/product/' + p.slug, lastModified: new Date(p.updated_at || p.created_at || new Date()), changeFrequency: 'weekly', priority: 0.7 });
    });

    const categories = await fetchCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('categories', country);
    categories.forEach((cat) => {
      entries.push({ url: BASE_URL + '/category/' + cat.slug, lastModified: new Date(cat.updated_at || cat.created_at || new Date()), changeFrequency: 'weekly', priority: 0.6 });
    });
  }

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
