import type { SupabaseClient } from '@supabase/supabase-js';
import {
  searchMessengerProducts,
  type MessengerProduct,
} from './messenger-product-tool';

export type MessengerKnowledgeCountry = 'IN' | 'BD';

type ProductKnowledgeMetadata = Record<string, unknown> | null | undefined;

type ProductFaq = {
  question_bn: string | null;
  answer_bn: string | null;
  question_en: string | null;
  answer_en: string | null;
  display_order: number | null;
};

type ProductKnowledgeResult = {
  handled: boolean;
  reply?: string;
  productId?: string | null;
};

const KNOWLEDGE_KEYWORDS = [
  'বিস্তারিত',
  'তথ্য',
  'বৈশিষ্ট্য',
  'ব্র্যান্ড',
  'brand',
  'উৎপত্তি',
  'origin',
  'জাত',
  'variety',
  'seed type',
  'বীজের ধরন',
  'season',
  'মৌসুম',
  'চাষের সময়',
  'রোপণের সময়',
  'বপনের সময়',
  'গজাতে',
  'অঙ্কুর',
  'germination',
  'ফসল',
  'harvest',
  'দূরত্ব',
  'spacing',
  'গভীরতা',
  'depth',
  'রোদ',
  'সূর্যালোক',
  'sunlight',
  'পানি',
  'water',
  'মাটি',
  'soil',
  'টবে',
  'container',
  'বারান্দা',
  'ছাদ',
  'packet',
  'প্যাকেট',
  'বীজ কত',
  'seed quantity',
  'ফলন',
  'yield',
  'চাষাবাদ',
  'cultivation',
  'কীভাবে চাষ',
  'কীভাবে লাগাব',
  'কীভাবে লাগাতে',
  'কীভাবে বপন',
  'কীভাবে রোপণ',
  'পরিচর্যা',
  'care',
  'সংরক্ষণ',
  'storage',
  'faq',
  'প্রশ্ন',
];

const STOP_WORDS = new Set([
  'দাম',
  'কত',
  'আছে',
  'স্টক',
  'স্টকে',
  'টি',
  'টা',
  'এর',
  'র',
  'জন্য',
  'এবং',
  'ও',
  'কি',
  'কী',
  'কোন',
  'কোনটা',
  'আমার',
  'চাই',
  'দাও',
  'দিবেন',
  'বলেন',
  'বলুন',
  'জানান',
  'the',
  'a',
  'an',
  'and',
  'of',
  'for',
  'is',
  'are',
  'what',
  'how',
  'can',
  'please',
]);

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  const rawTokens =
    value.match(/[A-Za-z0-9\u0980-\u09FF]+/g) || [];

  const variants = rawTokens.flatMap((token) => {
    const normalized = token.toLocaleLowerCase().trim();
    const candidates = [normalized];

    // Common Bengali possessive/genitive endings can hide the actual
    // product noun (e.g. "গোলাপের" -> "গোলাপ", "বীজের" -> "বীজ").
    if (normalized.length >= 4 && normalized.endsWith('ের')) {
      candidates.push(normalized.slice(0, -2));
    }

    if (normalized.length >= 5 && normalized.endsWith('দের')) {
      candidates.push(normalized.slice(0, -3));
    }

    if (normalized.length >= 5 && normalized.endsWith('গুলোর')) {
      candidates.push(normalized.slice(0, -5));
    }

    return candidates;
  });

  return Array.from(
    new Set(
      variants.filter(
        (token) => token.length >= 2 && !STOP_WORDS.has(token),
      ),
    ),
  ).slice(0, 12);
}

function hasKnowledgeIntent(text: string): boolean {
  const normalized = normalizeText(text);
  return KNOWLEDGE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLocaleLowerCase()),
  );
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

function productName(product: MessengerProduct): string {
  return product.name_bn || product.name_en || product.slug || 'পণ্য';
}

function getVerifiedProductId(metadata: ProductKnowledgeMetadata): string | null {
  if (!metadata || typeof metadata.last_messenger_product !== 'object') {
    return null;
  }

  const product = metadata.last_messenger_product as Record<string, unknown>;
  return typeof product.id === 'string' ? product.id : null;
}

async function getProductById(
  supabase: SupabaseClient,
  country: MessengerKnowledgeCountry,
  productId: string,
): Promise<MessengerProduct | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      [
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
      ].join(','),
    )
    .eq('id', productId)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as MessengerProduct | null;
}

async function getFullProduct(
  supabase: SupabaseClient,
  country: MessengerKnowledgeCountry,
  productId: string,
) {
  const { data, error } = await supabase
    .from('products')
    .select(
      [
        'id',
        'name_bn',
        'name_en',
        'slug',
        'short_description',
        'description',
        'regular_price',
        'sale_price',
        'offer_price',
        'price',
        'stock',
        'is_active',
        'seed_type',
        'variety',
        'brand',
        'origin',
        'season',
        'planting_season',
        'germination_time',
        'germination_rate',
        'harvest_time',
        'plant_spacing',
        'planting_depth',
        'sunlight',
        'water_requirement',
        'soil_type',
        'growing_location',
        'packet_weight',
        'seed_quantity',
        'expected_yield',
        'cultivation_instructions',
        'storage_instructions',
        'country_code',
      ].join(','),
    )
    .eq('id', productId)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data as Record<string, unknown> | null;
}

async function findFaq(
  supabase: SupabaseClient,
  productId: string,
  text: string,
): Promise<ProductFaq | null> {
  const { data, error } = await supabase
    .from('product_faqs')
    .select('question_bn,answer_bn,question_en,answer_en,display_order')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;

  const rows = (data || []) as ProductFaq[];
  if (!rows.length) return null;

  const queryTokens = tokenize(text);
  let best: { row: ProductFaq; score: number } | null = null;

  for (const row of rows) {
    const question = [row.question_bn, row.question_en]
      .filter(Boolean)
      .join(' ');
    const questionTokens = tokenize(question);
    const overlap = queryTokens.filter((token) => questionTokens.includes(token));

    let score = overlap.length;

    const normalizedText = normalizeText(text);
    const normalizedQuestion = normalizeText(question);
    if (
      normalizedQuestion &&
      normalizedText.length > 6 &&
      (normalizedText.includes(normalizedQuestion) ||
        normalizedQuestion.includes(normalizedText))
    ) {
      score += 6;
    }

    if (!best || score > best.score) {
      best = { row, score };
    }
  }

  return best && best.score >= 2 ? best.row : null;
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function buildFieldReply(
  product: Record<string, unknown>,
  text: string,
): string | null {
  const name = firstNonEmpty(product.name_bn, product.name_en, product.slug) || 'এই পণ্য';
  const normalized = normalizeText(text);

  if (/(ব্র্যান্ড|brand)/i.test(normalized)) {
    const value = firstNonEmpty(product.brand);
    return value ? `🌱 ${name}\n🏷️ ব্র্যান্ড: ${value}` : null;
  }

  if (/(উৎপত্তি|origin|কোথাকার)/i.test(normalized)) {
    const value = firstNonEmpty(product.origin);
    return value ? `🌱 ${name}\n🌍 উৎপত্তি: ${value}` : null;
  }

  if (/(জাত|variety)/i.test(normalized)) {
    const value = firstNonEmpty(product.variety);
    return value ? `🌱 ${name}\n🧬 জাত/ভ্যারাইটি: ${value}` : null;
  }

  if (/(seed type|বীজের ধরন|বীজের টাইপ)/i.test(normalized)) {
    const value = firstNonEmpty(product.seed_type);
    return value ? `🌱 ${name}\n🌾 বীজের ধরন: ${value}` : null;
  }

  if (/(season|মৌসুম|কোন সময়|কখন লাগাব|রোপণের সময়|বপনের সময়)/i.test(normalized)) {
    const season = firstNonEmpty(product.season);
    const plantingSeason = firstNonEmpty(product.planting_season);
    if (!season && !plantingSeason) return null;

    return [
      `🌱 ${name}`,
      season ? `🗓️ মৌসুম: ${season}` : '',
      plantingSeason ? `📅 রোপণ/বপনের সময়: ${plantingSeason}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (/(অঙ্কুর|germination|গজাতে|চারা হতে)/i.test(normalized)) {
    const time = firstNonEmpty(product.germination_time);
    const rate = firstNonEmpty(product.germination_rate);
    if (!time && !rate) return null;

    return [
      `🌱 ${name}`,
      time ? `🌱 অঙ্কুরোদগম সময়: ${time}` : '',
      rate ? `📈 অঙ্কুরোদগম হার: ${rate}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (/(দূরত্ব|spacing)/i.test(normalized)) {
    const value = firstNonEmpty(product.plant_spacing);
    return value ? `🌱 ${name}\n↔️ গাছের দূরত্ব: ${value}` : null;
  }

  if (/(গভীরতা|depth|কত গভীরে)/i.test(normalized)) {
    const value = firstNonEmpty(product.planting_depth);
    return value ? `🌱 ${name}\n📏 বপনের গভীরতা: ${value}` : null;
  }

  if (/(রোদ|সূর্যালোক|sunlight|আলো)/i.test(normalized)) {
    const value = firstNonEmpty(product.sunlight);
    return value ? `🌱 ${name}\n☀️ সূর্যালোক: ${value}` : null;
  }

  if (/(পানি|জল|water|সেচ|watering)/i.test(normalized)) {
    const value = firstNonEmpty(product.water_requirement);
    return value ? `🌱 ${name}\n💧 পানি/সেচ: ${value}` : null;
  }

  if (/(মাটি|soil)/i.test(normalized)) {
    const value = firstNonEmpty(product.soil_type);
    return value ? `🌱 ${name}\n🪴 মাটি: ${value}` : null;
  }

  if (/(প্যাকেট|packet|কতটি বীজ|কত বীজ|seed quantity)/i.test(normalized)) {
    const value = firstNonEmpty(product.packet_weight, product.seed_quantity);
    return value ? `🌱 ${name}\n📦 প্যাকেট/বীজের পরিমাণ: ${value}` : null;
  }

  if (/(ফলন|yield|harvest)/i.test(normalized)) {
    const value = firstNonEmpty(product.expected_yield, product.harvest_time);
    return value
      ? `🌱 ${name}\n🌾 ফলন/হারভেস্ট: ${value}`
      : null;
  }

  if (/(সংরক্ষণ|storage)/i.test(normalized)) {
    const value = firstNonEmpty(product.storage_instructions);
    return value ? `🌱 ${name}\n📦 সংরক্ষণ:\n${value}` : null;
  }

  if (/(কীভাবে চাষ|চাষাবাদ|cultivation|কীভাবে লাগাব|কীভাবে লাগাতে|পরিচর্যা|care|কীভাবে বপন|কীভাবে রোপণ)/i.test(normalized)) {
    const value = firstNonEmpty(product.cultivation_instructions);
    return value ? `🌱 ${name}\n\n🌿 চাষ/পরিচর্যা নির্দেশনা:\n${value}` : null;
  }

  if (/(বিস্তারিত|তথ্য|বৈশিষ্ট্য|details|about|এই পণ্য)/i.test(normalized)) {
    const description = firstNonEmpty(product.short_description, product.description);
    const values = [
      description ? `📝 ${description}` : '',
      firstNonEmpty(product.seed_type)
        ? `🌾 ধরন: ${firstNonEmpty(product.seed_type)}`
        : '',
      firstNonEmpty(product.variety)
        ? `🧬 জাত: ${firstNonEmpty(product.variety)}`
        : '',
      firstNonEmpty(product.brand)
        ? `🏷️ ব্র্যান্ড: ${firstNonEmpty(product.brand)}`
        : '',
      firstNonEmpty(product.origin)
        ? `🌍 উৎপত্তি: ${firstNonEmpty(product.origin)}`
        : '',
      firstNonEmpty(product.season)
        ? `🗓️ মৌসুম: ${firstNonEmpty(product.season)}`
        : '',
      firstNonEmpty(product.planting_season)
        ? `📅 বপনের সময়: ${firstNonEmpty(product.planting_season)}`
        : '',
    ].filter(Boolean);

    return values.length
      ? `🌱 ${name}\n\n${values.join('\n')}`
      : null;
  }

  return null;
}

export function isMessengerWebsiteKnowledgeRequest(text: string): boolean {
  return hasKnowledgeIntent(text);
}

export async function getMessengerWebsiteKnowledgeAnswer(args: {
  supabase: SupabaseClient;
  country: MessengerKnowledgeCountry;
  text: string;
  metadata?: ProductKnowledgeMetadata;
}): Promise<ProductKnowledgeResult> {
  const { supabase, country, text, metadata } = args;

  if (!hasKnowledgeIntent(text)) {
    return { handled: false };
  }

  let candidate: MessengerProduct | null = null;

  const verifiedProductId = getVerifiedProductId(metadata);
  if (verifiedProductId) {
    candidate = await getProductById(supabase, country, verifiedProductId);
  }

  if (!candidate) {
    const matches = await searchMessengerProducts(supabase, country, text, 4);
    if (matches.length === 1) {
      candidate = matches[0];
    }
  }

  if (!candidate) {
    return { handled: false };
  }

  const fullProduct = await getFullProduct(supabase, country, candidate.id);
  if (!fullProduct) {
    return { handled: false };
  }

  // Prefer an exact field-level answer first. This prevents a generic
  // FAQ containing overlapping words from hijacking questions such as
  // "ব্র্যান্ড কী?" or "মাটি কেমন?".
  const fieldReply = buildFieldReply(fullProduct, text);
  if (fieldReply) {
    return {
      handled: true,
      productId: candidate.id,
      reply: fieldReply,
    };
  }

  const faq = await findFaq(supabase, candidate.id, text);
  if (faq) {
    const answer = firstNonEmpty(faq.answer_bn, faq.answer_en);
    if (answer) {
      const name =
        firstNonEmpty(
          fullProduct.name_bn,
          fullProduct.name_en,
          fullProduct.slug,
        ) || 'এই পণ্য';

      return {
        handled: true,
        productId: candidate.id,
        reply:
          `🌱 ${name}\n\n❓ ${firstNonEmpty(
            faq.question_bn,
            faq.question_en,
          ) || 'FAQ'}\n\n${answer}`,
      };
    }
  }

  return { handled: false, productId: candidate.id };
}
