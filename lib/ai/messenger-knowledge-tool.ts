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

// Reduce a token to its base form by stripping the same Bengali genitive
// suffixes tokenize() expands (e.g. "মরিচের" -> "মরিচ", "জাতের" -> "জাত").
// Longest suffix first: a token ending in "দের" also ends in "ের", so the
// shorter strip must not win and leave a dangling "দ".
function baseToken(token: string): string {
  const normalized = token.toLocaleLowerCase().trim();
  if (normalized.length >= 5 && normalized.endsWith('গুলোর')) {
    return normalized.slice(0, -5);
  }
  if (normalized.length >= 5 && normalized.endsWith('দের')) {
    return normalized.slice(0, -3);
  }
  if (normalized.length >= 4 && normalized.endsWith('ের')) {
    return normalized.slice(0, -2);
  }
  return normalized;
}

// Canonicalize tokens so each distinct base word counts once. Without this,
// the genitive expansion in tokenize() lets one shared word count twice
// (both "মরিচের" and "মরিচ"), which inflated FAQ overlap scores.
function canonicalBaseTokens(tokens: string[]): string[] {
  return Array.from(
    new Set(
      tokens.map(baseToken).filter((token) => token.length >= 2),
    ),
  );
}

// Whole-word price vocabulary. After normalizeText runs, Banglish
// ("dam" -> "দাম", "koto" -> "কত") and Devanagari price words
// ("कीमत"/"दाम" -> "দাম") are already Bengali tokens, so the Bengali set
// covers Bangla script, Banglish, and Devanagari Hindi alike. Roman Hindi
// ("kitna"/"keemat") is not normalized and stays as-is.
const MESSENGER_PRICE_INTENT_TOKENS = new Set([
  'দাম',
  'কত',
  'কতো',
  'টাকা',
  'price',
  'cost',
  'kitna',
  'kitne',
  'kitni',
  'keemat',
  'कितना',
  'कितने',
  'कितनी',
  'कीमत',
  'दाम',
]);

// A duration word right after কত/kitna turns the question into a time
// question ("কত দিন লাগবে?", "kitne din lagenge?"), not a price question.
// ("কতদিন" is already a single token after normalization, so it never
// matches কত in the first place.)
const MESSENGER_PRICE_DURATION_TOKENS = new Set([
  'দিন',
  'দিনে',
  'ঘণ্টা',
  'ঘন্টা',
  'সপ্তাহ',
  'মাস',
  'বছর',
  'সময়',
  'মিনিট',
  'din',
  'dino',
  'day',
  'days',
]);

// "rate" alone is a price word, but "germination rate" is a field question.
const MESSENGER_PRICE_RATE_EXCLUSION_PREVIOUS_TOKENS = new Set([
  'germination',
  'growth',
  'অঙ্কুরোদগম',
  'অঙ্কুর',
]);

export function isMessengerPriceIntentQuery(text: string): boolean {
  const normalized = normalizeText(text);

  // "how much" is a phrase, not a single token. "how much time" asks for
  // a duration, not a price.
  if (/\bhow\s+much\b/i.test(normalized)) {
    return !/\bhow\s+much\s+time\b/i.test(normalized);
  }

  const tokens =
    normalized.match(/[A-Za-z0-9\u0900-\u097F\u0980-\u09FF]+/g) || [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index].toLocaleLowerCase();

    if (token === 'rate') {
      const previous =
        index > 0 ? tokens[index - 1].toLocaleLowerCase() : '';
      if (!MESSENGER_PRICE_RATE_EXCLUSION_PREVIOUS_TOKENS.has(previous)) {
        return true;
      }
      continue;
    }

    if (!MESSENGER_PRICE_INTENT_TOKENS.has(token)) continue;

    if (
      (token === 'কত' ||
        token === 'কতো' ||
        token === 'kitna' ||
        token === 'kitne' ||
        token === 'kitni') &&
      index + 1 < tokens.length &&
      MESSENGER_PRICE_DURATION_TOKENS.has(
        tokens[index + 1].toLocaleLowerCase(),
      )
    ) {
      continue;
    }

    return true;
  }

  return false;
}

function hasKnowledgeIntent(text: string): boolean {
  const normalized = normalizeText(text);
  return KNOWLEDGE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLocaleLowerCase()),
  );
}

// Single words that turn a product mention into an actual question or a
// field request (interrogatives and field names, in Bangla / English /
// Hindi). Checked against whole words, never substrings, so product names
// such as "কতবেল" or "জলপাই" do not false-positive on "কত" or "জল".
// Deliberately excludes the generic trigger "বীজ"/"seed": a bare product
// name contains it, and it alone asks nothing.
const BARE_NAME_QUESTION_WORDS = new Set([
  'কি', 'কী', 'কেমন', 'কেন', 'কখন', 'কোথায়', 'কোথায়', 'কোন', 'কোনটা', 'কত', 'কতদিন', 'কতোদিন', 'দিন', 'লাগে', 'চারা',
  'কয়টা', 'কয়টা', 'জাত', 'ব্র্যান্ড', 'উৎপত্তি', 'ওজন', 'দাম', 'চাষ',
  'চাষাবাদ', 'মৌসুম', 'অঙ্কুর', 'গজাতে', 'দূরত্ব', 'গভীরতা', 'রোদ',
  'সূর্যালোক', 'পানি', 'মাটি', 'প্যাকেট', 'ফলন', 'সংরক্ষণ', 'পরিচর্যা',
  'বিস্তারিত', 'তথ্য', 'বৈশিষ্ট্য', 'বপন', 'রোপণ', 'সেচ', 'ধরন', 'টাইপ',
  'how', 'what', 'why', 'when', 'where', 'which', 'who', 'price', 'cost',
  'weight', 'variety', 'brand', 'origin', 'cultivation', 'season',
  'germination', 'spacing', 'depth', 'sunlight', 'water', 'soil', 'packet',
  'yield', 'harvest', 'storage', 'care', 'details', 'about', 'sowing',
  'planting', 'sow',
  'कैसे', 'क्यों', 'कब', 'कहाँ', 'कितना', 'कितनी', 'कौन', 'क्या', 'किस्म',
  'ब्रांड', 'उत्पत्ति', 'मौसम', 'अंकुरण', 'दूरी', 'गहराई', 'धूप', 'पानी',
  'मिट्टी', 'पैकेट', 'उपज', 'कटाई', 'भंडारण', 'खेती', 'देखभाल', 'बुवाई',
  'रोपाई',
]);

// Multi-word question phrases that word matching alone cannot catch.
const BARE_NAME_QUESTION_PHRASES =
  /(seed type|বীজের ধরন|বীজের টাইপ|how to|how much|how many|কী ভাবে|কি ভাবে)/i;

// True when the customer only named a product ("রানি মরিচের বীজ") without
// asking anything about it. Such a message is a catalog lookup, not a
// knowledge question: no FAQ reply may hijack it, so the deterministic
// catalog path can answer with the short price reply instead.
export function isMessengerBareProductNameQuery(text: string): boolean {
  const normalized = normalizeText(text);
  if (BARE_NAME_QUESTION_PHRASES.test(normalized)) return false;
  const words =
    normalized.match(/[A-Za-z0-9\u0900-\u097F\u0980-\u09FF]+/g) || [];
  return !words.some((word) =>
    BARE_NAME_QUESTION_WORDS.has(baseToken(word)),
  );
}

// Generic seed-product words, in the three reply languages plus Roman
// Banglish. A bare name that names a seed product generically ("ম্যাংগো
// টমেটোর বীজ") is a product mention even when the catalog search found
// nothing in either country — the product is genuinely absent, so the
// deterministic "not in stock" reply is correct. Without this, only the
// search result could tell a product name from a non-product word ("Hi",
// "ধন্যবাদ"), which also matches nothing.
const MESSENGER_GENERIC_PRODUCT_WORDS = /বীজ|seed|बीज|beej/i;

export function hasMessengerGenericProductWord(text: string): boolean {
  return MESSENGER_GENERIC_PRODUCT_WORDS.test(normalizeText(text));
}

// Whether a bare product name must be answered deterministically by the
// catalog path instead of the AI section. A bare name is only treated as
// a product mention when the search found something in this country, the
// text names a seed product generically, or the product exists in the
// other country — otherwise it is not a product at all ("Hi", "ধন্যবাদ")
// and must keep the existing AI routing. Pure decision helper; the
// caller supplies the (async) other-country lookup result.
export function shouldAnswerMessengerBareNameDeterministically(args: {
  isBareProductName: boolean;
  hasLocalProducts: boolean;
  hasGenericProductWord: boolean;
  existsInOtherCountry: boolean;
}): boolean {
  return (
    args.isBareProductName &&
    (args.hasLocalProducts ||
      args.hasGenericProductWord ||
      args.existsInOtherCountry)
  );
}

// Stock-out phrasings in the three reply languages. A legitimate "not in
// stock" answer is never a knowledge fallback, even when it starts with
// "দুঃখিত": the fallback detector below matches "দুঃখিত.*নেই", so without
// this early return the bot's own correct stock-out reply ("দুঃখিত, এই
// প্রোডাক্টটি এই দেশে স্টকে নেই।") would be replaced by the human-support
// contact reply. Only literal stock-out assertions are listed here —
// "no stock" is deliberately excluded, so a genuine "I don't have stock
// information" fallback still matches the fallback regex.
const MESSENGER_STOCK_OUT_PATTERNS =
  /স্টকে নেই|স্টক শেষ|স্টক নেই|not in stock|out of stock|स्टॉक खत्म|स्टॉक में नहीं/i;

// True when the AI reply is a knowledge fallback ("I don't have that
// information") rather than a real answer. A stock-out answer is a verified
// answer from the database, so it is checked first and always returns
// false — even if the text also contains a fallback-looking phrase.
export function isKnowledgeFallbackResponse(text: string): boolean {
  const normalized = text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  if (MESSENGER_STOCK_OUT_PATTERNS.test(normalized)) return false;
  return /(দুঃখিত.*(তথ্য|সুনির্দিষ্ট|জানা|নেই)|তথ্য.*(নেই|অন্তর্ভুক্ত নেই)|তথ্যতালিকায়.*(নেই|অন্তর্ভুক্ত)|সুনির্দিষ্ট তথ্য নেই|জানাতে পারছি না|বিস্তারিত জানতে.*(মানব|সহায়তা)|মানব (সহায়তা|প্রতিনিধি)|human support|human representative|cannot (provide|verify)|don't have (the )?information|no (specific|exact) information)/i.test(normalized);
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

export type MessengerProductFaqMatchScore = {
  overlap: number;
  ratio: number;
  phraseMatch: boolean;
  confident: boolean;
};

// Pure FAQ confidence scoring, shared by findFaq and its tests. Overlap is
// computed on canonical base tokens so one shared word can never count
// twice (see canonicalBaseTokens): "রানি মরিচের বীজ" vs the FAQ question
// "এই মরিচের জাতের নাম কী?" shares only "মরিচ" (overlap 1, ratio 1/3),
// so it is not confident, while the real question "রানি মরিচের বীজের
// জাতের নাম কী?" shares "মরিচ", "জাত" and "নাম" (overlap 3) and is.
export function scoreMessengerProductFaqMatch(
  text: string,
  question: string,
): MessengerProductFaqMatchScore {
  const queryTokens = tokenize(text);
  const queryBaseTokens = canonicalBaseTokens(queryTokens);
  const questionBaseTokens = new Set(canonicalBaseTokens(tokenize(question)));
  const overlap = queryBaseTokens.filter((token) =>
    questionBaseTokens.has(token),
  );
  const ratio = overlap.length / Math.max(1, queryBaseTokens.length);
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

  return { overlap: overlap.length, ratio, phraseMatch, confident };
}

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

      const { overlap, phraseMatch, confident } =
        scoreMessengerProductFaqMatch(text, question);

      if (!confident) continue;

      candidates.push({
        id: row.id,
        question,
        answer,
        // Some legacy FAQ records have English text in the Bengali columns.
        // Record the actual answer language separately from the matched column.
        language: detectMessengerReplyLanguage(answer),
        score:
          overlap * 2 +
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
  if (/(প্যাকেট|packet|কতটি বীজ|কত বীজ|কতগুলো বীজ|কত গুলো বীজ|কতগুলি বীজ|কয়টি বীজ|কয়টি বীজ|কোটগুলো বীজ|কোট গুলো বীজ|বীজের সংখ্যা|seed quantity|seeds? per|पैकेट|कितने बीज)/i.test(normalized)) {
    const packetWeight = firstNonEmpty(product.packet_weight);
    const seedQuantity = firstNonEmpty(product.seed_quantity);
    if (!packetWeight && !seedQuantity) return null;

    if (language === 'English') {
      return [
        prefix,
        packetWeight ? line('📦', 'Packet weight', packetWeight) : '',
        seedQuantity ? line('🌱', 'Seed quantity', seedQuantity) : '',
      ].filter(Boolean).join('\\n');
    }
    if (language === 'Hindi') {
      return [
        prefix,
        packetWeight ? line('📦', 'पैकेट का वजन', packetWeight) : '',
        seedQuantity ? line('🌱', 'बीजों की संख्या', seedQuantity) : '',
      ].filter(Boolean).join('\\n');
    }
    return [
      prefix,
      packetWeight ? line('📦', 'প্যাকেটের ওজন', packetWeight) : '',
      seedQuantity ? line('🌱', 'বীজের পরিমাণ', seedQuantity) : '',
    ].filter(Boolean).join('\\n');
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

  // A bare product name ("রানি মরিচের বীজ") asks nothing: no FAQ reply may
  // answer it, so the deterministic catalog path can reply with the short
  // price reply instead. Real questions still reach the FAQ/field path.
  const bareProductNameQuery = isMessengerBareProductNameQuery(text);
  // A price question must be answered by the catalog's live price, never by
  // a product FAQ whose words merely overlap (e.g. "লাল গোলাপ ফুলের বীজ কত?"
  // matching a germination-time FAQ). Skipping the FAQ lookup lets the
  // catalog short price reply answer instead.
  const hasPriceIntent = isMessengerPriceIntentQuery(text);

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
    const faq = bareProductNameQuery || hasPriceIntent
      ? null
      : await findFaq(supabase, explicitlyMentionedProduct.id, text);
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

  // A unique, country-scoped active product found by its explicit name can
  // safely supply product facts even when fuzzy search labels it "similar".
  // The full read below is constrained by id, country, and is_active.
  if (!candidate && explicitlyMentionedProducts.length === 1) {
    candidate = explicitlyMentionedProducts[0];
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

  const faq = bareProductNameQuery || hasPriceIntent
    ? null
    : await findFaq(supabase, candidate.id, text);
  if (faq) {
    return {
      handled: true,
      productId: candidate.id,
      reply: formatMessengerProductFaqReply(fullProduct, faq, replyLanguage),
    };
  }

  return { handled: false, productId: candidate.id };
}
