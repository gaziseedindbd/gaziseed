import { MetadataRoute } from 'next';

const BASE_URL = 'https://www.gaziseed.com';
const FALLBACK_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_KEY = 'sb_publishable_vCaz5OGrHocUTgpOXmE9xg_QVsuUJc0';

type Country = 'BD' | 'IN';

function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_KEY,
  };
}

async function fetchRows<T>(
  table: string,
  params: Record<string, string>,
  country?: Country,
): Promise<T[]> {
  const { url, key } = getSupabaseConfig();
  const query = new URLSearchParams(params);

  try {
    const response = await fetch(url + '/rest/v1/' + table + '?' + query.toString(), {
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        ...(country ? { 'x-gazi-country': country } : {}),
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

async function fetchCountryRows<T>(
  table: 'products' | 'categories',
  country: Country,
): Promise<T[]> {
  const params: Record<string, string> = {
    select: 'slug,updated_at,created_at',
    is_active: 'eq.true',
    country_code: 'eq.' + country,
  };

  if (table === 'products') params.is_ads_only = 'eq.false';

  return fetchRows<T>(table, params, country);
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
      entries.push({
        url: `${BASE_URL}/product/${p.slug}`,
        lastModified: new Date(p.updated_at || p.created_at || new Date()),
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    });

    const categories = await fetchCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('categories', country);
    categories.forEach((cat) => {
      entries.push({
        url: `${BASE_URL}/category/${cat.slug}`,
        lastModified: new Date(cat.updated_at || cat.created_at || new Date()),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    });
  }

  const combos = await fetchRows<{ slug: string; created_at?: string }>(
    'combo_packs',
    { select: 'slug,created_at', is_active: 'eq.true' },
  );
  combos.forEach((c) => {
    entries.push({
      url: `${BASE_URL}/combo/${c.slug}`,
      lastModified: new Date(c.created_at || new Date()),
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  });

  const posts = await fetchRows<{ slug: string; updated_at?: string; created_at?: string }>(
    'blog_posts',
    { select: 'slug,updated_at,created_at', is_published: 'eq.true' },
  );
  posts.forEach((p) => {
    entries.push({
      url: `${BASE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.updated_at || p.created_at || new Date()),
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  });

  const pages = await fetchRows<{ slug: string; updated_at?: string; created_at?: string }>(
    'pages',
    { select: 'slug,updated_at,created_at', is_published: 'eq.true' },
  );
  pages.forEach((p) => {
    entries.push({
      url: `${BASE_URL}/page/${p.slug}`,
      lastModified: new Date(p.updated_at || p.created_at || new Date()),
      changeFrequency: 'monthly',
      priority: 0.4,
    });
  });

  const animatedLandings = await fetchRows<{ slug: string; updated_at?: string; created_at?: string }>(
    'animated_landing_pages',
    { select: 'slug,updated_at,created_at', status: 'eq.active' },
  );
  animatedLandings.forEach((p) => {
    entries.push({
      url: `${BASE_URL}/animated-landing/${p.slug}`,
      lastModified: new Date(p.updated_at || p.created_at || new Date()),
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  });

  const unique = new Map<string, MetadataRoute.Sitemap[number]>();
  entries.forEach((entry) => unique.set(entry.url, entry));
  return Array.from(unique.values());
}
