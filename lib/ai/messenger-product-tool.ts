import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessengerReplyLanguage } from './messenger-language';
import { normalizeMessengerHindiSearchText } from './messenger-intents';
import {
  MESSENGER_NON_DISTINCTIVE_TOKENS,
  canonicalizeMessengerSearchText,
  messengerSearchSurfacesForToken,
} from './messenger-product-synonyms';

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
  // NOTE: do NOT normalize Bengali vowel variants (ী -> ি) here. That would
  // corrupt correctly spelled words ("বীজ" -> "বিজ") in the term sent to
  // the search RPC and asserted by tests. Variant handling lives only
  // inside canonicalizeMessengerSearchToken, where both sides of a match
  // are normalized the same way for comparison.
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

function canonicalizeProductMatchText(value: string): string {
  const cleaned = normalizeSearchTerm(value)
    .toLocaleLowerCase()
    // Hyphenated catalogue names must match natural-language queries after
    // transactional words are removed, e.g. "Five-Color Chili Seeds" versus
    // "five color chili seeds".
    .replace(/[-_/]+/g, ' ')
    // \p{M} (combining marks) must be kept: Bengali/Devanagari vowel signs
    // (া ো ু ে ী) and the virama are marks, not letters. The old
    // [^\p{L}\p{N}\s] class stripped them, turning "গোলাপ" into "গ ল প"
    // on both sides — invisible to whole-string matching, fatal to
    // token-overlap matching.
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Map generic words to one concept ("মরিচ"/"morich"/"chili" -> "chili",
  // "রানী"/"রানি"/"rani" -> "rani") and normalize Bengali variants, so a
  // customer can write the same product in Bangla, Banglish, English or
  // Hindi. Distinctive product tokens pass through unchanged.
  return canonicalizeMessengerSearchText(cleaned);
}

/** Canonical token set for one text, for generic token-overlap matching. */
function canonicalTokenSet(value: string): Set<string> {
  return new Set(
    canonicalizeProductMatchText(value).split(/\s+/).filter(Boolean),
  );
}

/**
 * Distinctive tokens: everything except generic filler such as "seed" and
 * question words such as "price" / "কত". A price question is judged on the
 * product words in it, never on the question words.
 */
function distinctiveTokens(tokens: Set<string>): Set<string> {
  return new Set(
    Array.from(tokens).filter((token) => !MESSENGER_NON_DISTINCTIVE_TOKENS.has(token)),
  );
}

export type MessengerProductMatchScore = {
  type: MessengerProductSearchMatchType;
  /** Distinctive-token overlap count; exact matches score 99 for sorting. */
  score: number;
  /** Distinctive query tokens that also appear in the product. */
  overlap: string[];
};

/**
 * Generic token-overlap scoring. A product is trusted (exact/strong) when
 * its name shares 2+ distinctive tokens with the query, or when the query
 * has a single distinctive token and that token matches — regardless of
 * word order, language, or generic suffixes. This is what makes a product
 * added tomorrow work with no new code: its own distinctive tokens are
 * what match, never a per-product list.
 */
export function scoreMessengerProductMatch(
  searchTerm: string,
  product: Pick<MessengerProduct, 'name_bn' | 'name_en' | 'slug'>,
): MessengerProductMatchScore {
  const query = canonicalizeProductMatchText(searchTerm);
  if (!query) return { type: 'similar', score: 0, overlap: [] };

  const nameBn = canonicalizeProductMatchText(product.name_bn || '');
  const nameEn = canonicalizeProductMatchText(product.name_en || '');
  const slug = canonicalizeProductMatchText(product.slug || '');
  const querySlug = query.replace(/\s+/g, '-');
  const canonicalSlug = slug.replace(/\s+/g, '-');

  if (
    (nameBn && nameBn === query) ||
    (nameEn && nameEn === query) ||
    (slug && canonicalSlug === querySlug)
  ) {
    const overlap = Array.from(distinctiveTokens(canonicalTokenSet(query)));
    return { type: 'exact', score: 99, overlap };
  }

  const queryTokens = distinctiveTokens(canonicalTokenSet(query));
  if (!queryTokens.size) return { type: 'similar', score: 0, overlap: [] };

  // Match against the union of all name fields, so a Bangla query can match
  // an English name (and vice versa) through the generic synonym layer.
  const productTokens = new Set<string>();
  for (const text of [nameBn, nameEn, slug]) {
    for (const token of Array.from(canonicalTokenSet(text))) productTokens.add(token);
  }

  const overlap = Array.from(queryTokens).filter((token) => productTokens.has(token));

  if (
    overlap.length >= 2 ||
    (overlap.length === 1 && queryTokens.size === 1)
  ) {
    return { type: 'strong', score: overlap.length, overlap };
  }

  return { type: 'similar', score: overlap.length, overlap };
}

export function classifyMessengerProductMatch(
  searchTerm: string,
  product: Pick<MessengerProduct, 'name_bn' | 'name_en' | 'slug'>,
): MessengerProductSearchMatchType {
  return scoreMessengerProductMatch(searchTerm, product).type;
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
  // A "what is available?" catalog should show purchasable stock only.
  // Keep obvious internal/test fixtures out of customer-facing listings without
  // deleting or modifying any database records.
  const customerFacingRows = (rows || []).filter((row) => {
    if (typeof row.stock !== 'number' || row.stock <= 0) return false;
    const identity = [row.name_bn, row.name_en, row.slug]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLocaleLowerCase();
    return !/(^|[^a-z])(test|dummy|demo)([^a-z]|$)/i.test(identity);
  });
  return sortMessengerProducts(
    customerFacingRows.map((row) => ({
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
      // Always re-rank RPC rows with generic token-overlap scoring: the RPC
      // is the recall path, but only the token score decides whether a row
      // is trusted for price/stock. This is what rescues good RPC matches
      // that the old whole-string substring rule discarded as "similar".
      const refinedRows = rankedRows.map((row) => {
        const scored = scoreMessengerProductMatch(lookupTerm, row);
        return {
          ...row,
          search_match_type: scored.type,
          search_match_score: scored.score,
        };
      });
      const trustedRows = refinedRows.filter(isTrustedMessengerProductMatch);
      return sortMessengerProducts(
        trustedRows.length ? trustedRows : refinedRows,
      ).slice(0, safeLimit);
    }
  } catch {
    // Fall back to the legacy ilike path so product search remains available
    // during rollout or if an older deployment reaches this route.
  }

  const columns = ['name_bn', 'name_en', 'slug'] as const;
  const queries = [lookupTerm];
  // Fallback ilike terms use canonical tokens and their database surface
  // forms, so a Banglish query ("morich", "রানী") still finds the stored
  // spelling ("মরিচ", "রানি"). Distinctive tokens first, capped at 6.
  const canonicalTokens = Array.from(canonicalTokenSet(lookupTerm)).filter(
    (token) => !MESSENGER_NON_DISTINCTIVE_TOKENS.has(token),
  );
  for (const token of canonicalTokens) {
    if (queries.length >= 6) break;
    for (const surface of messengerSearchSurfacesForToken(token)) {
      if (queries.length >= 6) break;
      if (
        !queries.some(
          (query) => query.toLocaleLowerCase() === surface.toLocaleLowerCase(),
        )
      ) {
        queries.push(surface);
      }
    }
  }
  // Any remaining raw tokens (for example a new product's own distinctive
  // word) are tried verbatim as well.
  for (const token of searchTokens(lookupTerm)) {
    if (queries.length >= 6) break;
    if (
      !queries.some(
        (query) => query.toLocaleLowerCase() === token.toLocaleLowerCase(),
      )
    ) {
      queries.push(token);
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
      const scored = scoreMessengerProductMatch(lookupTerm, row);
      merged.set(row.id, {
        ...row,
        search_match_type: scored.type,
        search_match_score: scored.score,
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

/**
 * Short 3-4 line reply for one trusted product. User rules:
 * - Always show the price.
 * - Never show stock unless the customer asked for it.
 * - Show weight only if asked (and only when the database has it).
 * - Answer only what was asked; no details, delivery or cultivation dump.
 * The order question is always the last line so the customer can continue
 * to checkout from the same thread.
 */
export function formatMessengerShortProductReply(
  product: Pick<
    MessengerProduct,
    | 'name_bn'
    | 'name_en'
    | 'slug'
    | 'regular_price'
    | 'sale_price'
    | 'offer_price'
    | 'price'
    | 'stock'
    | 'packet_weight'
  >,
  country: MessengerCountry,
  language: MessengerReplyLanguage,
  asked: { stock?: boolean; weight?: boolean } = {},
): string {
  const name =
    language === 'English' || language === 'Hindi'
      ? (product.name_en || product.name_bn || product.slug || 'Product')
      : (product.name_bn || product.name_en || product.slug || 'পণ্য');
  const currency = country === 'IN' ? '₹' : '৳';
  const price = effectivePrice(product as MessengerProduct);
  const lines: string[] = [name];
  // Never invite an order for a sold-out product: the order question is a
  // dead end when stock is 0, so end with a sold-out line instead. Applies
  // whether or not the customer asked about stock; the stock line itself is
  // still only shown when asked.
  const soldOut = typeof product.stock === 'number' && product.stock === 0;

  if (language === 'English') {
    lines.push(
      price !== null
        ? `Price: ${currency}${price} per packet`
        : 'Price unavailable',
    );
    if (asked.stock && typeof product.stock === 'number') {
      lines.push(`Stock: ${product.stock} packets`);
    }
    if (asked.weight && product.packet_weight) {
      lines.push(`Weight: ${product.packet_weight}`);
    }
    lines.push(soldOut ? 'Currently out of stock.' : 'Would you like to order?');
  } else if (language === 'Hindi') {
    lines.push(
      price !== null
        ? `कीमत: ${currency}${price} प्रति पैकेट`
        : 'कीमत उपलब्ध नहीं',
    );
    if (asked.stock && typeof product.stock === 'number') {
      lines.push(`स्टॉक: ${product.stock} पैकेट`);
    }
    if (asked.weight && product.packet_weight) {
      lines.push(`वजन: ${product.packet_weight}`);
    }
    lines.push(soldOut ? 'फिलहाल स्टॉक खत्म है।' : 'ऑर्डर करना चाहेंगे?');
  } else {
    lines.push(
      price !== null
        ? `দাম: ${currency}${price} প্রতি প্যাকেট`
        : 'দাম জানা নেই',
    );
    if (asked.stock && typeof product.stock === 'number') {
      lines.push(`স্টক: ${product.stock} প্যাকেট`);
    }
    if (asked.weight && product.packet_weight) {
      lines.push(`ওজন: ${product.packet_weight}`);
    }
    lines.push(soldOut ? 'এই মুহূর্তে স্টক শেষ।' : 'অর্ডার করবেন?');
  }

  return lines.join('\n');
}

/**
 * Long-form database fields that must NOT be handed to the AI unless the
 * customer actually asked a cultivation/knowledge question. Passing them for
 * a simple price question is what made the AI dump details, charges and
 * growing instructions the customer never asked for. Price, stock,
 * packet weight and seed quantity stay: they are short facts the short-reply
 * rule can use or withhold as asked.
 */
const MESSENGER_AI_DETAIL_FIELDS = [
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
  'short_description',
  'germination_time',
  'germination_rate',
  'harvest_time',
  'season',
  'planting_season',
] as const;

export function stripMessengerProductDetailsForAI<
  T extends Record<string, unknown>,
>(products: T[], includeDetails: boolean): T[] {
  if (includeDetails) return products;
  return products.map((product) => {
    const copy = { ...product };
    for (const field of MESSENGER_AI_DETAIL_FIELDS) {
      delete copy[field];
    }
    return copy;
  });
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
