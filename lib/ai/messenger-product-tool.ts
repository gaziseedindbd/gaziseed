import type { SupabaseClient } from '@supabase/supabase-js';

export type MessengerCountry = 'IN' | 'BD';

export type MessengerProduct = {
  id: string;
  name_bn: string | null;
  name_en: string | null;
  slug: string | null;
  short_description: string | null;
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
};

const PRODUCT_FIELDS = [
  'id',
  'name_bn',
  'name_en',
  'slug',
  'short_description',
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
    .replace(/[\\%_]/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 80);
}

function searchTokens(value: string): string[] {
  const stopWords = new Set([
    'দাম', 'কত', 'আছে', 'স্টক', 'স্টকে', 'টি', 'টা', 'টি', 'এর', 'র', 'জন্য',
    'এবং', 'ও', 'কি', 'কী', 'কোন', 'কোনটা', 'আমার', 'চাই', 'দিবেন', 'দাও',
    'price', 'how', 'much', 'stock', 'available', 'is', 'are', 'the', 'a', 'an',
    'and', 'of', 'for', 'please', 'tell', 'me',
  ]);

  return Array.from(
    new Set(
      (value.match(/[A-Za-z0-9\u0980-\u09FF]+/g) || [])
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !stopWords.has(token.toLocaleLowerCase())),
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

export async function searchMessengerProducts(
  supabase: SupabaseClient,
  country: MessengerCountry,
  searchTerm: string,
  limit = 12,
): Promise<MessengerProduct[]> {
  const term = normalizeSearchTerm(searchTerm);
  if (!term) return [];

  const safeLimit = Math.max(1, Math.min(limit, 20));
  const columns = ['name_bn', 'name_en', 'slug'] as const;
  const queries = [term];

  if (!term.toLocaleLowerCase().includes('messenger')) {
    const tokens = searchTokens(term);
    for (const token of tokens) {
      if (!queries.some((query) => query.toLocaleLowerCase() === token.toLocaleLowerCase())) {
        queries.push(token);
      }
    }
  } else {
    const tokens = searchTokens(term);
    for (const token of tokens) {
      if (queries.length >= 6) break;
      if (!queries.some((query) => query.toLocaleLowerCase() === token.toLocaleLowerCase())) {
        queries.push(token);
      }
    }
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
      merged.set(row.id, row);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => {
      const aStock = Number(a.stock || 0) > 0 ? 1 : 0;
      const bStock = Number(b.stock || 0) > 0 ? 1 : 0;
      if (aStock !== bStock) return bStock - aStock;

      const aPrice = effectivePrice(a);
      const bPrice = effectivePrice(b);

      if (aPrice === null && bPrice !== null) return 1;
      if (aPrice !== null && bPrice === null) return -1;

      return (a.name_bn || a.name_en || a.slug || '').localeCompare(
        b.name_bn || b.name_en || b.slug || '',
        'bn',
      );
    })
    .slice(0, safeLimit);
}

export function serializeMessengerProducts(products: MessengerProduct[]) {
  return products.map((product) => ({
    id: product.id,
    name_bn: product.name_bn,
    name_en: product.name_en,
    slug: product.slug,
    short_description: product.short_description,
    regular_price: product.regular_price,
    sale_price: product.sale_price,
    offer_price: product.offer_price,
    effective_price: effectivePrice(product),
    stock: product.stock,
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
  }));
}
