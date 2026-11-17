/**
 * Generic product-search vocabulary for Messenger.
 *
 * This file maps GENERIC words only — seed categories, question words and
 * spelling variants that apply to every product in the catalog. It never
 * contains a product name, a variety name, a slug or any per-product list.
 *
 * How a new product works without any code change:
 * - Its distinctive tokens (for example "sunflower", "সূর্যমুখী", "naga",
 *   "bombay") pass through this layer unchanged, so generic token-overlap
 *   matching in messenger-product-tool.ts finds it from the database fields
 *   (name_bn / name_en / slug) alone.
 * - Only the generic words below are canonicalized, so a customer can write
 *   the same generic word in Bangla, Banglish, English or Hindi and still
 *   match the same product.
 *
 * Surface forms are matched after lower-casing and Bengali variant
 * normalization, so "রানী" and "রানি", "লঙ্কার" and "লঙ্কা" collapse to the
 * same canonical token.
 */

// Generic concept -> surface forms (Bangla, Banglish, English, Hindi).
// Keep this list to generic catalog/question vocabulary only.
const GENERIC_CONCEPT_SURFACES: Array<[string, string[]]> = [
  [
    'seed',
    ['বীজ', 'বিজ', 'seed', 'seeds', 'bij', 'beej', 'बीज'],
  ],
  [
    'chili',
    [
      'মরিচ', 'মরিছ', 'লঙ্কা', 'লংকা', 'chili', 'chilli', 'chilly',
      'morich', 'moric', 'lonka', 'lanka', 'mirch', 'मिर्च',
    ],
  ],
  [
    'flower',
    ['ফুল', 'flower', 'flowers', 'phool', 'phul', 'ful', 'fuler', 'फूल'],
  ],
  [
    'tomato',
    ['টমেটো', 'tomato', 'tometo', 'टमाटर'],
  ],
  [
    'rose',
    ['গোলাপ', 'golap', 'rose', 'gulab', 'गुलाब'],
  ],
  [
    'lotus',
    ['পদ্ম', 'lotus', 'kamal', 'कमल'],
  ],
  [
    'pumpkin',
    ['কুমড়া', 'কুমড়ো', 'pumpkin', 'kaddu', 'कद्दू'],
  ],
  [
    'gourd',
    ['লাউ', 'gourd', 'lauki', 'लौकी'],
  ],
  [
    'eggplant',
    ['বেগুন', 'eggplant', 'brinjal', 'baingan', 'बैंगन'],
  ],
  [
    'watermelon',
    ['তরমুজ', 'watermelon', 'tarbooj', 'तरबूज'],
  ],
  [
    'strawberry',
    ['স্ট্রবেরি', 'strawberry'],
  ],
  [
    'capsicum',
    ['ক্যাপসিকাম', 'capsicum', 'shimla', 'शिमला'],
  ],
  [
    'rani',
    ['রানী', 'রানি', 'rani', 'रानी'],
  ],
  [
    'hybrid',
    ['হাইব্রিড', 'hybrid', 'हाइब्रिड'],
  ],
  [
    'price',
    ['দাম', 'মূল্য', 'price', 'cost', 'dam', 'daam', 'कीमत', 'मूल्य'],
  ],
  [
    'stock',
    ['স্টক', 'stock', 'स्टॉक'],
  ],
  [
    'weight',
    ['ওজন', 'weight', 'वजन'],
  ],
  [
    'packet',
    ['প্যাকেট', 'packet', 'pack', 'पैकेट'],
  ],
];

const SURFACE_TO_CONCEPT = new Map<string, string>();
for (const [concept, surfaces] of GENERIC_CONCEPT_SURFACES) {
  for (const surface of surfaces) {
    SURFACE_TO_CONCEPT.set(surface, concept);
  }
}

/**
 * Tokens that carry no product identity on their own. They are kept for
 * exact-string matching but excluded from the distinctive-token count used
 * for trusted (exact/strong) matching, so "মরিচের বীজ" (chili + seed) is
 * judged on "chili" and "রানি লঙ্কার বীজ" is judged on "rani" + "chili".
 */
export const MESSENGER_GENERIC_MATCH_TOKENS = new Set(['seed']);

/**
 * Question words (after canonicalization) that also carry no product
 * identity: "দাম কত" must not stop "সূর্যমুখী বীজের দাম কত" from matching
 * a sunflower product on its one distinctive token.
 *
 * Roman Banglish/Hindi grammar particles belong here too: "Golap er bij
 * koto dam?" must be judged on "golap" alone, not on "er" (এর, genitive),
 * or the one-token product only ever scores "similar" and its price stays
 * hidden. The Bengali ("এর") and Devanagari ("का"/"की"/"के") forms of the
 * same particles are already stop words in TRANSACTIONAL_QUERY_STOP_WORDS;
 * these are their Roman forms, which were missing.
 */
export const MESSENGER_NON_DISTINCTIVE_TOKENS = new Set(
  Array.from(MESSENGER_GENERIC_MATCH_TOKENS).concat([
  'price',
  'stock',
  'weight',
  'packet',
  'কত',
  'koto',
  'how',
  'much',
  'আছে',
  'ase',
  'ache',
  'কী',
  'কি',
  'ki',
  'kya',
  'hai',
  'hain',
  'kemon',
  'tell',
  'me',
  'please',
  'batao',
  'bolun',
  'বলুন',
  // Roman Banglish genitive / classifier / plural particles — grammar only,
  // never a product word ("golap er bij", "bij ta", "bij gulo", "tar dam").
  'er',
  'ta',
  'ti',
  'tar',
  'gulo',
  'gula',
  // Roman Hindi genitives (का/के) — "gulab ka beej", "gulab ke beej".
  'ka',
  'ke',
  // Roman Banglish "from" (থেকে) — "Bangladesh theke ... beej".
  'theke',
]));

/** Normalize Bengali spelling variants that customers mix freely. */
export function normalizeBengaliVariantToken(token: string): string {
  let normalized = token;
  // ী (long i) and ূ (long u) are routinely written as ি / ু, and vice versa.
  normalized = normalized.replace(/ী/g, 'ি').replace(/ূ/g, 'ু');
  // ংক / ংগ are routinely written as ঙ্ক / ঙ্গ (লংকা vs লঙ্কা).
  normalized = normalized.replace(/ংক/g, 'ঙ্ক').replace(/ংগ/g, 'ঙ্গ');
  return normalized;
}

/**
 * Strip a Bengali genitive suffix: "লঙ্কার" -> "লঙ্কা", "মরিচের" -> "মরিচ",
 * "বীজের" -> "বীজ". A trailing "র" is stripped only when it follows a vowel
 * sign, so a stem that naturally ends in র (for example "গাজর") is kept.
 */
export function stripBengaliGenitiveSuffix(token: string): string {
  // The genitive suffix is the vowel sign ে (U+09C7) + র, as in "ফুলের",
  // "মরিচের", "বীজের" — not the independent vowel এ + র.
  if (token.endsWith('ের') && token.length > 3) {
    return token.slice(0, -2);
  }
  if (token.endsWith('এর') && token.length > 3) {
    return token.slice(0, -2);
  }
  if (
    token.endsWith('র') &&
    token.length >= 4 &&
    /[ািীোেৈৌ]/.test(token.charAt(token.length - 2))
  ) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Canonicalize one search token to its generic concept, or return the token
 * unchanged (after Bengali variant + genitive normalization) when it is a
 * distinctive product token. Distinctive tokens are what make a future
 * product findable without any code change.
 */
export function canonicalizeMessengerSearchToken(rawToken: string): string {
  const lowered = rawToken.toLocaleLowerCase().trim();
  if (!lowered) return lowered;

  // Latin tokens: singularize "seeds" -> "seed" before concept lookup.
  const latinSingular =
    /^[a-z]+$/.test(lowered) && lowered.endsWith('s') && lowered.length > 3
      ? lowered.slice(0, -1)
      : lowered;

  const concept = SURFACE_TO_CONCEPT.get(latinSingular);
  if (concept) return concept;

  const normalized = stripBengaliGenitiveSuffix(
    normalizeBengaliVariantToken(latinSingular),
  );
  return SURFACE_TO_CONCEPT.get(normalized) || normalized;
}

/** Canonicalize a whole phrase token-by-token (generic words only). */
export function canonicalizeMessengerSearchText(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => canonicalizeMessengerSearchToken(token))
    .join(' ');
}

/**
 * Database surface forms to try for one canonical token in the ilike
 * fallback path. A concept returns one Bengali and one Latin/English form
 * (for example "chili" -> ["মরিচ", "chili"]) so a Banglish query can still
 * find a product stored under either name. A distinctive token returns
 * itself: future products are found by their own tokens, with no list.
 */
export function messengerSearchSurfacesForToken(token: string): string[] {
  const canonical = canonicalizeMessengerSearchToken(token);
  const surfaces: string[] = [];
  for (const [concept, forms] of GENERIC_CONCEPT_SURFACES) {
    if (concept !== canonical) continue;
    const bengali = forms.find((form) => /[\u0980-\u09FF]/.test(form));
    const latin = forms.find((form) => /^[a-z]+$/.test(form));
    // Normalize the Bengali surface (ী -> ি) so ilike matches the stored
    // spelling even when the catalog lists the other variant.
    if (bengali) surfaces.push(normalizeBengaliVariantToken(bengali));
    if (latin && latin !== bengali) surfaces.push(latin);
    return surfaces.length ? surfaces : [canonical];
  }
  return [token];
}
