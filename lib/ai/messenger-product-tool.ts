import type { SupabaseClient } from '@supabase/supabase-js';

export type MessengerCountry = 'IN' | 'BD';

export type MessengerProductSearchMatchType = 'exact' | 'strong' | 'similar';

export type MessengerProduct = {
  id: string;
  name_bn: string | null;
  name_en: string | null;
  slug: string | null;
  short_description: string | null;
  image: string | null;
  regular_price: number | null;
  sale_price: number | null;
  offer_price: number | null;
  price: number | null;
  stock: number | null;
  is_active: boolean;
  seed_type: string | null;
  variety: string | null;
  season: string | null;
  planting_season: string | null;
  packet_weight: string | null;
  germination_time: string | null;
  germination_rate: string | null;
  harvest_time: string | null;
  country_code: string;
  search_match_type?: MessengerProductSearchMatchType | null;
  search_match_score?: number | null;
};

/**
 * Exact and strong matches are safe for current price/stock/order claims.
 * Similar matches may be shown as discovery hints, but their transactional
 * fields must never be trusted.
 */
export function isTrustedMessengerProductMatch(product: unknown): boolean {
  if (!product || typeof product !== 'object') return false;

  const matchType = (product as {
    search_match_type?: unknown;
  }).search_match_type;

  return matchType === 'exact' || matchType === 'strong';
}

const PRODUCT_FIELDS = [
  'id',
  'name_bn',
  'name_en',
  'slug',
  'short_description',
  'image',
  'regular_price',
  'sale_price',
  'offer_price',
  'price',
  'stock',
  'is_active',
  'seed_type',
  'variety',
  'season',
  'planting_season',
  'packet_weight',
  'germination_time',
  'germination_rate',
  'harvest_time',
  'country_code',
].join(',');

function normalizeSearchTerm(value: string): string {
  return value
    .replace(/[%_]/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function normalizeMessengerSearchTerm(value: string): string {
  return normalizeSearchTerm(value);
}

export function normalizeMessengerSearchSlug(value: string): string {
  return normalizeSearchTerm(value).toLocaleLowerCase().replace(/\s+/g, '-');
}

export function classifyMessengerProductMatch(
  searchTerm: string,
  product: Pick<MessengerProduct, 'name_bn' | 'name_en' | 'slug'>,
): MessengerProductSearchMatchType {
  const query = normalizeSearchTerm(searchTerm).toLocaleLowerCase();
  const querySlug = normalizeMessengerSearchSlug(searchTerm);
  if (!query) return 'similar';

  const nameBn = (product.name_bn || '').toLocaleLowerCase();
  const nameEn = (product.name_en || '').toLocaleLowerCase();
  const slug = (product.slug || '').toLocaleLowerCase();

  if (
    nameBn === query ||
    nameEn === query ||
    slug === query ||
    slug === querySlug
  ) {
    return 'exact';
  }

  if (
    nameBn.includes(query) ||
    nameEn.includes(query) ||
    slug.includes(query) ||
    slug.includes(querySlug)
  ) {
    return 'strong';
  }

  return 'similar';
}

function searchTokens(value: string): string[] {
  const stopWords = new Set([
    'দাম', 'কত', 'আছে', 'স্টক', 'স্টকে', 'টি', 'টা', 'এর', 'র', 'জন্য',
    'এবং', 'ও', 'কি', 'কী', 'কোন', 'কোনটা', 'আমার', 'চাই', 'দিবেন', 'দাও',
    'price', 'how', 'much', 'stock', 'available', 'is', 'are', 'the', 'a', 'an',
    'and', 'of', 'for', 'please', 'tell', 'me',
  ]);

  return Array.from(
    new Set(
      (value.match(/[A-Za-z0-9\u0980-\u09FF]+/g) || [])
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length >= 2 &&
            !stopWords.has(token.toLocaleLowerCase()),
        ),
    ),
  ).slice(0, 6);
}

function effectivePrice(product: MessengerProduct): number | null {
  const prices = [
    product.offer_price,
    product.sale_price,
    product.price,
    product.regular_price,
  ];

  const valid = prices.filter(
    (value): value is number => typeof value === 'number' && value > 0,
  );

  return valid[0] ?? null;
}

function sortMessengerProducts(
  products: MessengerProduct[],
): MessengerProduct[] {
  return products.sort((a, b) => {
    const aStock = Number(a.stock || 0) > 0 ? 1 : 0;
    const bStock = Number(b.stock || 0) > 0 ? 1 : 0;
    if (aStock !== bStock) return bStock - aStock;

    const aPrice = effectivePrice(a);
    const bPrice = effectivePrice(b);
    if (aPrice === null && bPrice !== null) return 1;
    if (aPrice !== null && bPrice === null) return -1;

    const aScore = Number(a.search_match_score || 0);
    const bScore = Number(b.search_match_score || 0);
    if (aScore !== bScore) return bScore - aScore;

    return (a.name_bn || a.name_en || a.slug || '').localeCompare(
      b.name_bn || b.name_en || b.slug || '',
      'bn',
    );
  });
}

export async function listMessengerProducts(
  supabase: SupabaseClient,
  country: MessengerCountry,
  limit = 12,
): Promise<MessengerProduct[]> {
  const safeLimit = Math.max(1, Math.min(limit, 20));
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('country_code', country)
    .eq('is_active', true)
    .order('stock', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;

  const rows = data as unknown as MessengerProduct[] | null;
  return sortMessengerProducts(
    (rows || []).map((row) => ({
      ...row,
      search_match_type: 'exact',
      search_match_score: 0,
    })),
  ).slice(0, safeLimit);
}

export async function searchMessengerProducts(
  supabase: SupabaseClient,
  country: MessengerCountry,
  searchTerm: string,
  limit = 12,
): Promise<MessengerProduct[]> {
  const term = normalizeSearchTerm(searchTerm);
  if (!term) return [];

  const safeLimit = Math.max(1, Math.min(limit, 20));

  // Primary path: indexed PostgreSQL full-text + trigram/fuzzy search.
  try {
    const { data, error } = await supabase.rpc('search_messenger_products', {
      p_country: country,
      p_query: term,
      p_limit: safeLimit,
    });

    if (!error && Array.isArray(data)) {
      const rankedRows = data as unknown as MessengerProduct[];
      return sortMessengerProducts(rankedRows).slice(0, safeLimit);
    }
  } catch {
    // Fall back to the legacy ilike path so product search remains available
    // during rollout or if an older deployment reaches this route.
  }

  const columns = ['name_bn', 'name_en', 'slug'] as const;
  const queries = [term];
  const tokens = searchTokens(term);

  for (const token of tokens) {
    if (
      queries.length >= 6 ||
      queries.some(
        (query) => query.toLocaleLowerCase() === token.toLocaleLowerCase(),
      )
    ) {
      continue;
    }
    queries.push(token);
  }

  const results = await Promise.all(
    queries.flatMap((query) => {
      const pattern = `%${query}%`;
      return columns.map((column) =>
        supabase
          .from('products')
          .select(PRODUCT_FIELDS)
          .eq('country_code', country)
          .eq('is_active', true)
          .ilike(column, pattern)
          .limit(safeLimit),
      );
    }),
  );

  const merged = new Map<string, MessengerProduct>();

  for (const result of results) {
    if (result.error) throw result.error;

    const rows = result.data as unknown as MessengerProduct[] | null;
    for (const row of rows || []) {
      const matchType = classifyMessengerProductMatch(term, row);
      merged.set(row.id, {
        ...row,
        search_match_type: matchType,
        search_match_score: matchType === 'exact' ? 1 : 0,
      });
    }
  }

  return sortMessengerProducts(Array.from(merged.values())).slice(0, safeLimit);
}

export function serializeMessengerProducts(products: MessengerProduct[]) {
  return products.map((product) => {
    const transactionalDataVerified = isTrustedMessengerProductMatch(product);

    return {
      id: product.id,
      name_bn: product.name_bn,
      name_en: product.name_en,
      slug: product.slug,
      short_description: product.short_description,
      image: product.image,
      // Similar matches remain useful for discovery, but never expose their
      // live price/stock to AI or customer-facing transactional formatting.
      regular_price: transactionalDataVerified ? product.regular_price : null,
      sale_price: transactionalDataVerified ? product.sale_price : null,
      offer_price: transactionalDataVerified ? product.offer_price : null,
      effective_price: transactionalDataVerified
        ? effectivePrice(product)
        : null,
      stock: transactionalDataVerified ? product.stock : null,
      is_active: product.is_active,
      seed_type: product.seed_type,
      variety: product.variety,
      season: product.season,
      planting_season: product.planting_season,
      packet_weight: product.packet_weight,
      germination_time: product.germination_time,
      germination_rate: product.germination_rate,
      harvest_time: product.harvest_time,
      country_code: product.country_code,
      search_match_type: product.search_match_type || null,
      search_match_score: product.search_match_score ?? null,
      transactional_data_verified: transactionalDataVerified,
    };
  });
}
