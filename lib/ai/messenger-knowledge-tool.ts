import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeMessengerIntentText } from './messenger-intents';
import {
  detectMessengerReplyLanguage,
  type MessengerReplyLanguage,
} from './messenger-language';
import {
  isTrustedMessengerProductMatch,
  searchMessengerProducts,
  type MessengerProduct,
} from './messenger-product-tool';

export type MessengerKnowledgeCountry = 'IN' | 'BD';

type ProductKnowledgeMetadata = Record<string, unknown> | null | undefined;

type ProductFaq = {
  id: string;
  question_bn: string | null;
  answer_bn: string | null;
  question_en: string | null;
  answer_en: string | null;
  question_hi?: string | null;
  answer_hi?: string | null;
  display_order: number | null;
};

type ProductKnowledgeResult = {
  handled: boolean;
  reply?: string;
  productId?: string | null;
  verifiedContext?: string;
};

const KNOWLEDGE_KEYWORDS = [
  'বীজ',
  'বিস্তারিত',
  'विवरण',
  'विशेषता',
  'किस्म',
  'बीज का प्रकार',
  'मौसम',
  'बुवाई',
  'बोएं',
  'अंकुरण',
  'अंकुरित',
  'कितने दिन',
  'फसल',
  'कटाई',
  'दूरी',
  'गहराई',
  'धूप',
  'सूरज की रोशनी',
  'पानी',
  'मिट्टी',
  'गमले',
  'गमला',
  'छत',
  'पैकेट',
  'कितने बीज',
  'उपज',
  'खेती',
  'देखभाल',
  'भंडारण',
  'कैसे उगाएं',
  'कैसे लगाएं',
  'कब बोएं',
  'कब लगाएं',
  'कैसे बोएं',
  'रोपाई',
  'प्रश्न',
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

const GENERIC_PRODUCT_TOKENS = new Set([
  'বীজ',
  'পণ্য',
  'প্রোডাক্ট',
  'ফুল',
  'লাল',
  'সাদা',
  'কালো',
  'হলুদ',
  'গোলাপি',
  'বেগুনি',
  'মিশ্র',
  'মিক্স',
  'seed',
  'seeds',
  'product',
  'products',
  'flower',
  'red',
  'white',
  'black',
  'yellow',
  'pink',
  'purple',
  'mixed',
  'mix',
  'लाल',
  'सफेद',
  'काला',
  'पीला',
  'गुलाबी',
  'बैंगनी',
]);

function isSimpleProductFieldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length > 60) return false;

  if (/(किस तरह|कैसे|तैयार|बुवाई|बोएं|रोपाई|खेती|उगाएं|लगाएं|देखभाल|कীভাবে|কিভাবে|কী ভাবে|কি ভাবে|প্রস্তুত|বপন|রোপণ|চাষ|পরিচর্যা|how to|prepare|preparing|sow|sowing|planting|cultivation|care)/i.test(normalized)) {
    return false;
  }

  return /(ब्रांड|कंपनी|उत्पत्ति|कहां का|कहाँ का|किस्म|बीज का प्रकार|मौसम|अंकुरण|कितने दिन|दूरी|गहराई|धूप|सूरज की रोशनी|पानी|मिट्टी|पैकेट|कितने बीज|उपज|कटाई|भंडारण|brand|origin|variety|बীজের ধরন|seed type|season|মৌসুম|অঙ্কুর|germination|দূরত্ব|spacing|গভীরতা|depth|রোদ|সূর্যালোক|sunlight|পানি|জল|water|মাটি|soil|প্যাকেট|packet|ফলন|yield|harvest|সংরক্ষণ|storage)/i.test(normalized);
}

export function isMessengerExplicitProductKnowledgeQuery(
  text: string,
  product: Pick<MessengerProduct, 'name_bn' | 'name_en' | 'slug'>,
): boolean {
  const normalized = normalizeText(text);

  const queryTokens = tokenize(normalized);
  const productTokens = tokenize(
    [product.name_bn, product.name_en, product.slug].filter(Boolean).join(' '),
  ).filter((token) => !GENERIC_PRODUCT_TOKENS.has(token));

  return productTokens.some((token) => queryTokens.includes(token));
}

export function isMessengerProductSpecificKnowledgeQuery(
  text: string,
  product: Pick<MessengerProduct, 'name_bn' | 'name_en' | 'slug'>,
): boolean {
  if (isMessengerExplicitProductKnowledgeQuery(text, product)) return true;

  const normalized = normalizeText(text);
  return /(इस\s+(?:बीज|বীজ|उत्पाद|प्रोडक्ट)|इसका|इसकी|यह\s+(?:बीज|বীজ|उत्पाद)|ये\s+(?:बीज|বীজ|उत्पाद)|এই\s+(?:বীজ|পণ্য|প্রোডাক্ট)|এটার|এটি|এইটা|this\s+seed|this\s+product)/i.test(normalized);
}

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
  'क्या',
  'कैसे',
  'कब',
  'कितने',
  'कितनी',
  'कौन',
  'है',
  'हैं',
  'का',
  'की',
  'के',
  'में',
  'और',
  'से',
  'पर',
  'को',
  'यह',
  'इस',
  'मेरा',
  'मेरी',
  'आप',
  'लिए',
]);

function normalizeText(value: string): string {
  return normalizeMessengerIntentText(value);
}

function tokenize(value: string): string[] {
  const rawTokens =
    normalizeMessengerIntentText(value).match(/[A-Za-z0-9\u0900-\u097F\u0980-\u09FF]+/g) || [];

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

type ProductFaqMatch = {
  question: string;
  answer: string;
  language: MessengerReplyLanguage;
};

async function findFaq(
  supabase: SupabaseClient,
  productId: string,
  text: string,
): Promise<ProductFaqMatch | null> {
  const { data, error } = await supabase
    .from('product_faqs')
    .select('id,question_bn,answer_bn,question_en,answer_en,display_order')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;

  let rows = (data || []) as ProductFaq[];
  if (!rows.length) return null;

  if (detectMessengerReplyLanguage(text) === 'Hindi') {
    try {
      const { data: cachedTranslations, error: translationError } = await supabase
        .from('translation_cache')
        .select('entity_id,source_hash,translated_payload')
        .eq('entity_type', 'product_faq')
        .eq('target_lang', 'hi')
        .in('entity_id', rows.map((row) => row.id));

      if (translationError) throw translationError;

      const translatedById = new Map(
        (cachedTranslations || []).map((entry) => [
          entry.entity_id,
          entry as {
            entity_id: string;
            source_hash: string;
            translated_payload: unknown;
          },
        ]),
      );

      rows = rows.map((row) => {
        const translation = translatedById.get(row.id);
        if (!translation || translation.source_hash !== getMessengerFaqSourceHash(row)) {
          return row;
        }

        const payload = translation.translated_payload;
        if (!payload || typeof payload !== 'object') return row;
        const values = payload as Record<string, unknown>;

        return {
          ...row,
          question_hi: typeof values.question_hi === 'string' ? values.question_hi : null,
          answer_hi: typeof values.answer_hi === 'string' ? values.answer_hi : null,
        };
      });
    } catch (error) {
      console.error(
        'Messenger Hindi FAQ lookup failed:',
        error instanceof Error ? error.message : 'Unknown Hindi FAQ lookup error',
      );
    }
  }

  const requestedLanguage = detectMessengerReplyLanguage(text);
  const queryTokens = tokenize(text);
  const candidates: Array<{
    id: string;
    question: string;
    answer: string;
    language: MessengerReplyLanguage;
    score: number;
  }> = [];

  for (const row of rows) {
    const pairs: Array<{
      language: MessengerReplyLanguage;
      question: string | null | undefined;
      answer: string | null | undefined;
    }> = [
      { language: 'Bengali', question: row.question_bn, answer: row.answer_bn },
      { language: 'English', question: row.question_en, answer: row.answer_en },
      { language: 'Hindi', question: row.question_hi, answer: row.answer_hi },
    ];

    for (const pair of pairs) {
      const question = firstNonEmpty(pair.question);
      const answer = firstNonEmpty(pair.answer);
      if (!question || !answer) continue;

      const questionTokens = new Set(tokenize(question));
      const overlap = queryTokens.filter((token) => questionTokens.has(token));
      const ratio = overlap.length / Math.max(1, queryTokens.length);
      const normalizedText = normalizeText(text);
      const normalizedQuestion = normalizeText(question);
      const phraseMatch =
        queryTokens.length >= 2 &&
        normalizedText.length > 6 &&
        normalizedQuestion.length > 6 &&
        (normalizedText.includes(normalizedQuestion) ||
          normalizedQuestion.includes(normalizedText));
      const confident =
        phraseMatch ||
        (overlap.length >= 2 && ratio >= 0.45) ||
        (overlap.length >= 3 && ratio >= 0.35);

      if (!confident) continue;

      candidates.push({
        id: row.id,
        question,
        answer,
        // Some legacy FAQ records have English text in the Bengali columns.
        // Record the actual answer language separately from the matched column.
        language: detectMessengerReplyLanguage(answer),
        score:
          overlap.length * 2 +
          (phraseMatch ? 6 : 0) +
          (pair.language === requestedLanguage ? 0.75 : 0),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const runnerUp = candidates[1];

  // If two different FAQ records fit almost equally well, do not guess which
  // fact the customer meant. A safe fallback is better than a confident error.
  if (
    best &&
    runnerUp &&
    best.id !== runnerUp.id &&
    Math.abs(best.score - runnerUp.score) < 1
  ) {
    return null;
  }

  return best
    ? { question: best.question, answer: best.answer, language: best.language }
    : null;
}

function getMessengerFaqSourceHash(faq: Pick<ProductFaq, 'question_en' | 'answer_en'>): string {
  return createHash('sha256')
    .update((faq.question_en || '') + '\\n' + (faq.answer_en || ''))
    .digest('hex');
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function formatMessengerProductFaqReply(
  product: { name_bn?: unknown; name_en?: unknown; slug?: unknown },
  faq: ProductFaqMatch,
  replyLanguage: MessengerReplyLanguage,
): string {
  const name =
    firstNonEmpty(
      replyLanguage === 'Bengali' ? product.name_bn : product.name_en,
      product.name_bn,
      product.name_en,
      product.slug,
    ) || 'Product';
  const translationNote =
    faq.language !== replyLanguage
      ? replyLanguage === 'Hindi'
        ? 'इस उत्तर का हिन्दी अनुवाद डेटाबेस में उपलब्ध नहीं है; नीचे मूल सत्यापित उत्तर है।'
        : replyLanguage === 'English'
          ? 'A translation in your language is not available yet; the verified database answer is shown below.'
          : 'এই উত্তরের বাংলা অনুবাদ database-এ নেই; নিচে database-এ থাকা যাচাইকৃত উত্তর দেওয়া হলো।'
      : '';

  return [
    '🌱 ' + name,
    '❓ ' + (faq.question || 'FAQ'),
    translationNote,
    faq.answer,
  ].filter(Boolean).join('\n\n');
}

export function selectMessengerFaqResponse(
  faq: ProductFaq,
  language: MessengerReplyLanguage,
): { question: string | null; answer: string | null } {
  const englishAnswer = firstNonEmpty(faq.answer_en);
  const bengaliAnswer = firstNonEmpty(faq.answer_bn);
  const hindiAnswer = firstNonEmpty(faq.answer_hi);
  const preferHindi = language === 'Hindi' && hindiAnswer;
  if (preferHindi) {
    return {
      question: firstNonEmpty(faq.question_hi, faq.question_en, faq.question_bn),
      answer: hindiAnswer,
    };
  }

  const preferEnglish = language === 'English' || language === 'Hindi';
  const answer = preferEnglish
    ? englishAnswer || bengaliAnswer
    : bengaliAnswer || englishAnswer;
  const selectedAnswerIsEnglish = Boolean(
    preferEnglish ? englishAnswer : !bengaliAnswer && englishAnswer,
  );
  const question = selectedAnswerIsEnglish
    ? firstNonEmpty(faq.question_en, faq.question_bn)
    : firstNonEmpty(faq.question_bn, faq.question_en);

  return { question, answer };
}

function buildFieldReply(
  product: Record<string, unknown>,
  text: string,
  language: MessengerReplyLanguage,
): string | null {
  const name = language === 'Bengali'
    ? firstNonEmpty(product.name_bn, product.name_en, product.slug) || 'এই পণ্য'
    : firstNonEmpty(product.name_en, product.name_bn, product.slug) || 'Product';
  const normalized = normalizeText(text);
  const labels = language === 'English'
    ? {
        brand: 'Brand', origin: 'Origin', variety: 'Variety', seedType: 'Seed type',
        season: 'Season', plantingSeason: 'Planting season', germinationTime: 'Germination time',
        germinationRate: 'Germination rate', spacing: 'Plant spacing', depth: 'Sowing depth',
        sunlight: 'Sunlight', water: 'Watering', soil: 'Soil type', packet: 'Packet/seed quantity',
        yield: 'Yield/harvest', storage: 'Storage', cultivation: 'Cultivation instructions',
        type: 'Type', sowingTime: 'Sowing time',
      }
    : language === 'Hindi'
      ? {
          brand: 'ब्रांड', origin: 'उत्पत्ति', variety: 'किस्म', seedType: 'बीज का प्रकार',
          season: 'मौसम', plantingSeason: 'बुवाई का समय', germinationTime: 'अंकुरण का समय',
          germinationRate: 'अंकुरण दर', spacing: 'पौधों के बीच दूरी', depth: 'बुवाई की गहराई',
          sunlight: 'धूप', water: 'पानी/सिंचाई', soil: 'मिट्टी का प्रकार', packet: 'पैकेट/बीज की मात्रा',
          yield: 'उपज/कटाई', storage: 'भंडारण', cultivation: 'खेती की जानकारी',
          type: 'प्रकार', sowingTime: 'बुवाई का समय',
        }
      : {
          brand: 'ব্র্যান্ড', origin: 'উৎপত্তি', variety: 'জাত/ভ্যারাইটি', seedType: 'বীজের ধরন',
          season: 'মৌসুম', plantingSeason: 'রোপণ/বপনের সময়', germinationTime: 'অঙ্কুরোদগম সময়',
          germinationRate: 'অঙ্কুরোদগম হার', spacing: 'গাছের দূরত্ব', depth: 'বপনের গভীরতা',
          sunlight: 'সূর্যালোক', water: 'পানি/সেচ', soil: 'মাটির ধরন', packet: 'প্যাকেট/বীজের পরিমাণ',
          yield: 'ফলন/হারভেস্ট', storage: 'সংরক্ষণ', cultivation: 'চাষ/পরিচর্যা নির্দেশনা',
          type: 'ধরন', sowingTime: 'বপনের সময়',
        };
  const prefix = `🌱 ${name}`;
  const line = (emoji: string, label: string, value: string) => `${emoji} ${label}: ${value}`;

  if (/(ব্র্যান্ড|brand|ब्रांड)/i.test(normalized)) {
    const value = firstNonEmpty(product.brand);
    return value ? `${prefix}\n${line('🏷️', labels.brand, value)}` : null;
  }
  if (/(উৎপত্তি|origin|কোথাকার|उत्पत्ति)/i.test(normalized)) {
    const value = firstNonEmpty(product.origin);
    return value ? `${prefix}\n${line('🌍', labels.origin, value)}` : null;
  }
  if (/(জাত|variety|किस्म)/i.test(normalized)) {
    const value = firstNonEmpty(product.variety);
    return value ? `${prefix}\n${line('🧬', labels.variety, value)}` : null;
  }
  if (/(seed type|বীজের ধরন|বীজের টাইপ|बीज का प्रकार)/i.test(normalized)) {
    const value = firstNonEmpty(product.seed_type);
    return value ? `${prefix}\n${line('🌾', labels.seedType, value)}` : null;
  }
  if (/(season|মৌসুম|কোন সময়|কখন লাগাব|রোপণের সময়|বপনের সময়|मौसम|बुवाई का समय)/i.test(normalized)) {
    const season = firstNonEmpty(product.season);
    const plantingSeason = firstNonEmpty(product.planting_season);
    if (!season && !plantingSeason) return null;
    return [
      prefix,
      season ? line('🗓️', labels.season, season) : '',
      plantingSeason ? line('📅', labels.plantingSeason, plantingSeason) : '',
    ].filter(Boolean).join('\n');
  }
  if (/(অঙ্কুর|germination|গজাতে|চারা হতে|अंकुरण)/i.test(normalized)) {
    const time = firstNonEmpty(product.germination_time);
    const rate = firstNonEmpty(product.germination_rate);
    if (!time && !rate) return null;
    return [
      prefix,
      time ? line('🌱', labels.germinationTime, time) : '',
      rate ? line('📈', labels.germinationRate, rate) : '',
    ].filter(Boolean).join('\n');
  }
  if (/(দূরত্ব|spacing|दूरी)/i.test(normalized)) {
    const value = firstNonEmpty(product.plant_spacing);
    return value ? `${prefix}\n${line('↔️', labels.spacing, value)}` : null;
  }
  if (/(গভীরতা|depth|কত গভীরে|गहराई)/i.test(normalized)) {
    const value = firstNonEmpty(product.planting_depth);
    return value ? `${prefix}\n${line('📏', labels.depth, value)}` : null;
  }
  if (/(রোদ|সূর্যালোক|sunlight|আলো|धूप)/i.test(normalized)) {
    const value = firstNonEmpty(product.sunlight);
    return value ? `${prefix}\n${line('☀️', labels.sunlight, value)}` : null;
  }
  if (/(পানি|জল|water|সেচ|watering|पानी)/i.test(normalized)) {
    const value = firstNonEmpty(product.water_requirement);
    return value ? `${prefix}\n${line('💧', labels.water, value)}` : null;
  }
  if (/(মাটি|soil|मिट्टी)/i.test(normalized)) {
    const value = firstNonEmpty(product.soil_type);
    return value ? `${prefix}\n${line('🪴', labels.soil, value)}` : null;
  }
  if (/(প্যাকেট|packet|কতটি বীজ|কত বীজ|seed quantity|पैकेट)/i.test(normalized)) {
    const value = firstNonEmpty(product.packet_weight, product.seed_quantity);
    return value ? `${prefix}\n${line('📦', labels.packet, value)}` : null;
  }
  if (/(ফলন|yield|harvest|कटाई|उपज)/i.test(normalized)) {
    const value = firstNonEmpty(product.expected_yield, product.harvest_time);
    return value ? `${prefix}\n${line('🌾', labels.yield, value)}` : null;
  }
  if (/(সংরক্ষণ|storage|भंडारण)/i.test(normalized)) {
    const value = firstNonEmpty(product.storage_instructions);
    return value ? `${prefix}\n${line('📦', labels.storage, value)}\n${value}` : null;
  }
  if (/(কীভাবে চাষ|চাষাবাদ|cultivation|কীভাবে লাগাব|কীভাবে লাগাতে|পরিচর্যা|care|কীভাবে বপন|কীভাবে রোপণ|खेती|देखभाल)/i.test(normalized)) {
    const value = firstNonEmpty(product.cultivation_instructions);
    return value ? `${prefix}\n\n🌿 ${labels.cultivation}:\n${value}` : null;
  }
  if (/(বিস্তারিত|তথ্য|বৈশিষ্ট্য|details|about|এই পণ্য|विवरण|जानकारी)/i.test(normalized)) {
    const description = firstNonEmpty(product.short_description, product.description);
    const type = firstNonEmpty(product.seed_type);
    const variety = firstNonEmpty(product.variety);
    const brand = firstNonEmpty(product.brand);
    const origin = firstNonEmpty(product.origin);
    const season = firstNonEmpty(product.season);
    const plantingSeason = firstNonEmpty(product.planting_season);
    const values = [
      description ? `📝 ${description}` : '',
      type ? line('🌾', labels.type, type) : '',
      variety ? line('🧬', labels.variety, variety) : '',
      brand ? line('🏷️', labels.brand, brand) : '',
      origin ? line('🌍', labels.origin, origin) : '',
      season ? line('🗓️', labels.season, season) : '',
      plantingSeason ? line('📅', labels.sowingTime, plantingSeason) : '',
    ].filter(Boolean);
    return values.length ? `${prefix}\n\n${values.join('\n')}` : null;
  }
  return null;
}
export function isMessengerWebsiteKnowledgeRequest(text: string): boolean {
  return hasKnowledgeIntent(text);
}

export function isBangladeshPaymentMethodQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return /(payment|pay|পেমেন্ট|পেমেন্টের|পেমেন্ট মেথড|payment method|কীভাবে পেমেন্ট|কিভাবে পেমেন্ট|কী দিয়ে পেমেন্ট|কিভাবে টাকা দেব|কীভাবে টাকা দেব|cash on delivery|cod|ক্যাশ অন ডেলিভারি|সিওডি)/i.test(
    normalized,
  );
}

export function getBangladeshPaymentMethodReply(
  language: MessengerReplyLanguage = 'Bengali',
): string {
  if (language === 'English') {
    return [
      '🇧🇩 Bangladesh currently accepts Cash on Delivery (COD) only.',
      '',
      '📦 Pay the delivery agent when your order arrives.',
    ].join('\n');
  }

  if (language === 'Hindi') {
    return [
      '🇧🇩 Bangladesh में अभी केवल Cash on Delivery (COD) उपलब्ध है।',
      '',
      '📦 Order मिलने पर delivery agent को payment करें।',
    ].join('\n');
  }

  return [
    '🇧🇩 Bangladesh-এ বর্তমানে আমরা শুধু Cash on Delivery (COD) payment গ্রহণ করি।',
    '',
    '📦 পণ্য হাতে পাওয়ার সময় delivery agent-কে payment করবেন।',
  ].join('\n');
}

const PRODUCT_NAME_SEARCH_STOP_WORDS = new Set([
  'how', 'much', 'does', 'do', 'need', 'needs', 'hours', 'hour', 'sunlight',
  'sun', 'light', 'grow', 'grows', 'growing', 'growth', 'flower', 'flowers',
  'seed', 'seeds', 'plant', 'plants', 'for', 'the', 'and', 'what', 'when',
  'where', 'which', 'is', 'are', 'can', 'i', 'to', 'in', 'on', 'of',
  'কত', 'টা', 'জন্য', 'কি', 'কী', 'কেমন', 'রোদ', 'সূর্যালোক', 'আলো',
  'ফুল', 'ফুলের', 'বীজ', 'বীজের', 'গাছ', 'গাছের', 'ঘণ্টা', 'ঘন্টা',
  'कितना', 'कितनी', 'कैसी', 'कैसे', 'के', 'लिए', 'धूप', 'रोशनी',
  'घंटे', 'फूल', 'बीज', 'पौधा',
]);

/**
 * The indexed product RPC can return an empty/truncated result for a complete
 * natural-language FAQ question even though the product exists. Use a narrow,
 * country-scoped name lookup for distinctive query tokens before falling back
 * to AI. The result is only used to find an active FAQ; it never authorizes
 * price, stock, offers, or arbitrary product fields.
 */
async function findExplicitKnowledgeProductsByName(
  supabase: SupabaseClient,
  country: MessengerKnowledgeCountry,
  text: string,
): Promise<MessengerProduct[]> {
  const tokens = tokenize(text)
    .filter((token) =>
      token.length >= 3 && !PRODUCT_NAME_SEARCH_STOP_WORDS.has(token.toLocaleLowerCase()),
    )
    .slice(0, 5);

  if (!tokens.length) return [];

  const lookups = await Promise.all(tokens.map((token) =>
    supabase
      .from('products')
      .select('id,name_bn,name_en,slug,is_active,country_code')
      .eq('country_code', country)
      .eq('is_active', true)
      .or('name_bn.ilike.%' + token + '%,name_en.ilike.%' + token + '%,slug.ilike.%' + token + '%')
      .limit(8),
  ));

  const productsById = new Map<string, MessengerProduct>();
  for (const lookup of lookups) {
    if (lookup.error) throw lookup.error;
    for (const row of (lookup.data || []) as unknown as Array<MessengerProduct>) {
      if (isMessengerExplicitProductKnowledgeQuery(text, row)) {
        productsById.set(row.id, {
          ...row,
          search_match_type: 'similar',
          search_match_score: 0,
        });
      }
    }
  }

  return Array.from(productsById.values());
}

export async function getMessengerWebsiteKnowledgeAnswer(args: {
  supabase: SupabaseClient;
  country: MessengerKnowledgeCountry;
  text: string;
  metadata?: ProductKnowledgeMetadata;
}): Promise<ProductKnowledgeResult> {
  const { supabase, country, text, metadata } = args;

  if (country === 'BD' && isBangladeshPaymentMethodQuestion(text)) {
    return {
      handled: true,
      reply: getBangladeshPaymentMethodReply(detectMessengerReplyLanguage(text)),
    };
  }

  if (!hasKnowledgeIntent(text)) {
    return { handled: false };
  }

  let candidate: MessengerProduct | null = null;

  // An explicit product name in the current question must win over a stale
  // conversational product reference (for example, "chili seed ... this seed").
  const matches = await searchMessengerProducts(supabase, country, text, 8);
  let explicitlyMentionedProducts = matches.filter((match) =>
    isMessengerExplicitProductKnowledgeQuery(text, match),
  );

  // Natural-language FAQ questions can be missed by the indexed search RPC.
  // If it did not return the explicitly named product, try a narrow direct
  // name lookup before allowing an unverified AI fallback.
  if (!explicitlyMentionedProducts.length) {
    explicitlyMentionedProducts = await findExplicitKnowledgeProductsByName(
      supabase,
      country,
      text,
    );
  }

  const explicitlyNamedProducts = explicitlyMentionedProducts.filter(
    isTrustedMessengerProductMatch,
  );
  if (explicitlyNamedProducts.length === 1) {
    candidate = explicitlyNamedProducts[0];
  }

  // Product search may score a product as "similar" when a customer asks a
  // general FAQ using only its distinctive name (e.g. "Zinnia sunlight").
  // A confident FAQ match is safe to answer from that product's FAQ record,
  // but a similar match must never authorize field facts, prices, or stock.
  if (!candidate && explicitlyMentionedProducts.length === 1) {
    const explicitlyMentionedProduct = explicitlyMentionedProducts[0];
    const faq = await findFaq(supabase, explicitlyMentionedProduct.id, text);
    if (faq) {
      return {
        handled: true,
        productId: explicitlyMentionedProduct.id,
        reply: formatMessengerProductFaqReply(
          explicitlyMentionedProduct,
          faq,
          detectMessengerReplyLanguage(text),
        ),
      };
    }
  }

  // Only reuse the previous product when the customer did not name another
  // product in the current turn; stale context must not override a new noun.
  const verifiedProductId = getVerifiedProductId(metadata);
  if (!candidate && explicitlyMentionedProducts.length === 0 && verifiedProductId) {
    const verifiedProduct = await getProductById(supabase, country, verifiedProductId);
    if (
      verifiedProduct &&
      (isMessengerProductSpecificKnowledgeQuery(text, verifiedProduct) ||
        isSimpleProductFieldQuestion(text))
    ) {
      candidate = verifiedProduct;
    }
  }

  if (!candidate) {
    const productSpecificMatches = matches.filter(
      (match) =>
        isTrustedMessengerProductMatch(match) &&
        isMessengerProductSpecificKnowledgeQuery(text, match),
    );
    if (productSpecificMatches.length === 1) {
      candidate = productSpecificMatches[0];
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
  const replyLanguage = detectMessengerReplyLanguage(text);
  const fieldReply = buildFieldReply(fullProduct, text, replyLanguage);
  if (fieldReply) {
    return {
      handled: true,
      productId: candidate.id,
      reply: fieldReply,
    };
  }

  const faq = await findFaq(supabase, candidate.id, text);
  if (faq) {
    return {
      handled: true,
      productId: candidate.id,
      reply: formatMessengerProductFaqReply(fullProduct, faq, replyLanguage),
    };
  }

  return { handled: false, productId: candidate.id };
}
