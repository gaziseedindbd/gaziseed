import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessengerReplyLanguage } from './messenger-language';
import { normalizeMessengerHindiSearchText } from './messenger-intents';

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
  description?: string | null;
  brand?: string | null;
  origin?: string | null;
  plant_spacing?: string | null;
  planting_depth?: string | null;
  sunlight?: string | null;
  water_requirement?: string | null;
  soil_type?: string | null;
  growing_location?: string | null;
  expected_yield?: string | null;
  cultivation_instructions?: string | null;
  storage_instructions?: string | null;
  seed_quantity?: string | null;
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
  return normalizeMessengerHindiSearchText(value)
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

const TRANSACTIONAL_QUERY_STOP_WORDS = new Set([
  'দাম', 'দামটা', 'মূল্য', 'স্টক', 'স্টকে', 'কত', 'কয়', 'কয়টি',
  'আছে', 'ও', 'এবং', 'কি', 'কী', 'এর', 'র', 'প্রতি', 'প্যাকেট',
  'বলুন', 'বলেন', 'জানান', 'দিবেন', 'দাও',
  'price', 'cost', 'stock', 'available', 'availability', 'how', 'much',
  'what', 'is', 'are', 'the', 'of', 'and', 'in', 'per', 'packet', 'pack',
  'please', 'tell', 'me',
  'दाम', 'कीमत', 'मूल्य', 'स्टॉक', 'कितना', 'कितनी', 'कितने', 'है', 'का', 'की', 'के', 'और', 'बताइए',
]);

/**
 * Remove price/stock question wording before catalog lookup so the search RPC
 * compares the actual product phrase instead of the full customer sentence.
 */
export function normalizeMessengerProductQuery(value: string): string {
  const term = normalizeSearchTerm(value);
  if (!/(दाम|कीमत|मूल्य|स्टॉक|दाम|price|cost|stock|available|দাম|মূল্য|স্টক)/i.test(term)) {
    return term;
  }

  const tokens = term.match(/[A-Za-z0-9\u0900-\u09FF]+/g) || [];
  const productTokens = tokens
    .filter((token) => !TRANSACTIONAL_QUERY_STOP_WORDS.has(token.toLocaleLowerCase()))
    .map((token) => token.toLocaleLowerCase() === 'বীজের' ? 'বীজ' : token);

  return normalizeSearchTerm(productTokens.join(' ')) || term;
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

  const lookupTerm = normalizeMessengerProductQuery(term);
  const safeLimit = Math.max(1, Math.min(limit, 20));

  // Primary path: indexed PostgreSQL full-text + trigram/fuzzy search.
  try {
    const { data, error } = await supabase.rpc('search_messenger_products', {
      p_country: country,
      p_query: lookupTerm,
      p_limit: safeLimit,
    });

    if (!error && Array.isArray(data)) {
      const rankedRows = data as unknown as MessengerProduct[];
      const refinedRows = lookupTerm === term
        ? rankedRows
        : rankedRows.map((row) => ({
            ...row,
            // Full-text overlap can make unrelated products look strong.
            // For transactional questions, require a lexical name match.
            search_match_type: classifyMessengerProductMatch(lookupTerm, row),
          }));
      const trustedRows = refinedRows.filter(isTrustedMessengerProductMatch);
      return sortMessengerProducts(
        lookupTerm !== term && trustedRows.length ? trustedRows : refinedRows,
      ).slice(0, safeLimit);
    }
  } catch {
    // Fall back to the legacy ilike path so product search remains available
    // during rollout or if an older deployment reaches this route.
  }

  const columns = ['name_bn', 'name_en', 'slug'] as const;
  const queries = [lookupTerm];
  const tokens = searchTokens(lookupTerm);

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
      const matchType = classifyMessengerProductMatch(lookupTerm, row);
      merged.set(row.id, {
        ...row,
        search_match_type: matchType,
        search_match_score: matchType === 'exact' ? 1 : 0,
      });
    }
  }

  const fallbackRows = Array.from(merged.values());
  const trustedFallbackRows = fallbackRows.filter(isTrustedMessengerProductMatch);
  return sortMessengerProducts(
    lookupTerm !== term && trustedFallbackRows.length
      ? trustedFallbackRows
      : fallbackRows,
  ).slice(0, safeLimit);
}

const MESSENGER_KNOWLEDGE_FIELDS = [
  'description',
  'brand',
  'origin',
  'plant_spacing',
  'planting_depth',
  'sunlight',
  'water_requirement',
  'soil_type',
  'growing_location',
  'expected_yield',
  'cultivation_instructions',
  'storage_instructions',
  'seed_quantity',
].join(',');

/**
 * Load detailed growing facts only for trusted product matches. The ranked
 * search RPC intentionally returns a compact catalog result; this second read
 * supplies verified product knowledge without changing its search contract.
 */
export async function enrichMessengerProductsWithKnowledge(
  supabase: SupabaseClient,
  country: MessengerCountry,
  products: MessengerProduct[],
): Promise<MessengerProduct[]> {
  const trustedProducts = products
    .filter(isTrustedMessengerProductMatch)
    .slice(0, 3);

  if (!trustedProducts.length) return products;

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id,' + MESSENGER_KNOWLEDGE_FIELDS)
      .eq('country_code', country)
      .eq('is_active', true)
      .in('id', trustedProducts.map((product) => product.id));

    if (error) throw error;

    const knowledgeById = new Map(
      ((data || []) as unknown as Array<Partial<MessengerProduct> & { id: string }>)
        .map((product) => [product.id, product]),
    );

    return products.map((product) => {
      if (!isTrustedMessengerProductMatch(product)) return product;
      return { ...product, ...(knowledgeById.get(product.id) || {}) };
    });
  } catch (error) {
    console.error(
      'Messenger product knowledge enrichment failed:',
      error instanceof Error ? error.message : 'Unknown product knowledge error',
    );
    // Keep existing catalog replies available if this optional read fails.
    return products;
  }
}

export function getMessengerProductSelectionQuickReplies(
  products: readonly unknown[],
  language: MessengerReplyLanguage = 'Bengali',
): Array<{ title: string; payload: string }> {
  const quickReplies: Array<{ title: string; payload: string }> = [];

  for (const candidate of products) {
    const product = candidate as Record<string, unknown>;
    if (typeof product.id !== 'string') continue;

    const preferEnglish = language === 'English' || language === 'Hindi';
    const name = preferEnglish
      ? (typeof product.name_en === 'string' && product.name_en.trim()) ||
        (typeof product.name_bn === 'string' && product.name_bn.trim()) ||
        (typeof product.slug === 'string' && product.slug.trim()) ||
        ''
      : (typeof product.name_bn === 'string' && product.name_bn.trim()) ||
        (typeof product.name_en === 'string' && product.name_en.trim()) ||
        (typeof product.slug === 'string' && product.slug.trim()) ||
        '';
    if (!name) continue;

    quickReplies.push({
      title: name.length > 20 ? name.slice(0, 19) + '…' : name,
      payload: `PRODUCT_SELECT:${product.id}`,
    });
    if (quickReplies.length >= 13) break;
  }

  return quickReplies;
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
      // Detailed growing facts are authoritative only for exact/strong matches.
      description: transactionalDataVerified ? product.description || null : null,
      brand: transactionalDataVerified ? product.brand || null : null,
      origin: transactionalDataVerified ? product.origin || null : null,
      plant_spacing: transactionalDataVerified ? product.plant_spacing || null : null,
      planting_depth: transactionalDataVerified ? product.planting_depth || null : null,
      sunlight: transactionalDataVerified ? product.sunlight || null : null,
      water_requirement: transactionalDataVerified ? product.water_requirement || null : null,
      soil_type: transactionalDataVerified ? product.soil_type || null : null,
      growing_location: transactionalDataVerified ? product.growing_location || null : null,
      expected_yield: transactionalDataVerified ? product.expected_yield || null : null,
      cultivation_instructions: transactionalDataVerified ? product.cultivation_instructions || null : null,
      storage_instructions: transactionalDataVerified ? product.storage_instructions || null : null,
      seed_quantity: transactionalDataVerified ? product.seed_quantity || null : null,
      country_code: product.country_code,
      search_match_type: product.search_match_type || null,
      search_match_score: product.search_match_score ?? null,
      transactional_data_verified: transactionalDataVerified,
    };
  });
}
