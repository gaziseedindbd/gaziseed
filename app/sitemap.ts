import type { MetadataRoute } from 'next';

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url + '/rest/v1/' + table + '?' + query.toString(), {
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        ...(country ? { 'x-gazi-country': country } : {}),
      },
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

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

function lastModified(row: { updated_at?: string; created_at?: string }): Date | undefined {
  const value = row.updated_at || row.created_at;
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/india`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/india/guides`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/india/guides/naga-bombay-chili-growing-guide`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/india/guides/terrace-gardening-seeds-india`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/india/guides/rose-seeds-india-growing-guide`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/all-products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/blog`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const activeCountryRows = <T,>(table: string, country: Country) => fetchRows<T>(
    table,
    {
      select: 'slug,updated_at,created_at',
      is_active: 'eq.true',
      country_code: 'eq.' + country,
    },
    country,
  );

  const activeAnimatedRows = <T,>(country: Country) => fetchRows<T>(
    'animated_landing_pages',
    {
      select: 'slug,updated_at,created_at',
      status: 'eq.active',
      country_code: 'eq.' + country,
    },
    country,
  );

  const [
    bdProducts,
    inProducts,
    bdCategories,
    inCategories,
    bdCombos,
    inCombos,
    posts,
    pages,
    bdAnimatedLandings,
    inAnimatedLandings,
  ] = await Promise.all([
    fetchCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('products', 'BD'),
    fetchCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('products', 'IN'),
    fetchCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('categories', 'BD'),
    fetchCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('categories', 'IN'),
    activeCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('combo_packs', 'BD'),
    activeCountryRows<{ slug: string; updated_at?: string; created_at?: string }>('combo_packs', 'IN'),
    fetchRows<{ slug: string; updated_at?: string; created_at?: string }>(
      'blog_posts',
      { select: 'slug,updated_at,created_at', is_published: 'eq.true' },
    ),
    fetchRows<{ slug: string; updated_at?: string; created_at?: string }>(
      'pages',
      { select: 'slug,updated_at,created_at', is_published: 'eq.true' },
    ),
    activeAnimatedRows<{ slug: string; updated_at?: string; created_at?: string }>('BD'),
    activeAnimatedRows<{ slug: string; updated_at?: string; created_at?: string }>('IN'),
  ]);

  const addRows = (
    rows: Array<{ slug: string; updated_at?: string; created_at?: string }>,
    route: string,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: number,
  ) => rows.forEach((row) => {
    const modified = lastModified(row);
    entries.push({
      url: `${BASE_URL}/${route}/${encodeURIComponent(row.slug)}`,
      ...(modified ? { lastModified: modified } : {}),
      changeFrequency,
      priority,
    });
  });

  addRows([...bdProducts, ...inProducts], 'product', 'weekly', 0.7);
  addRows([...bdCategories, ...inCategories], 'category', 'weekly', 0.6);
  addRows([...bdCombos, ...inCombos], 'combo', 'weekly', 0.6);
  addRows(posts, 'blog', 'monthly', 0.5);
  addRows(pages, 'page', 'monthly', 0.4);
  addRows([...bdAnimatedLandings, ...inAnimatedLandings], 'animated-landing', 'weekly', 0.6);

  const unique = new Map<string, MetadataRoute.Sitemap[number]>();
  entries.forEach((entry) => {
    const current = unique.get(entry.url);
    if (!current) {
      unique.set(entry.url, entry);
      return;
    }
    const currentTime = current.lastModified instanceof Date ? current.lastModified.getTime() : 0;
    const nextTime = entry.lastModified instanceof Date ? entry.lastModified.getTime() : 0;
    if (nextTime > currentTime) unique.set(entry.url, entry);
  });
  return Array.from(unique.values());
}
