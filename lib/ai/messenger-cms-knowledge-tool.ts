import type { SupabaseClient } from '@supabase/supabase-js';
import { detectMessengerReplyLanguage } from './messenger-language';
import { normalizeMessengerIntentText } from './messenger-intents';

export type MessengerCmsKnowledgeCountry = 'BD' | 'IN';
export type MessengerCmsKnowledgeSource = 'landing_faqs' | 'pages' | 'blogs';

export type MessengerCmsKnowledgeResult = {
  handled: boolean;
  reply?: string;
  source?: MessengerCmsKnowledgeSource;
  sourceSlug?: string | null;
  confidence?: number;
  lookupFailed?: boolean;
};

type KnowledgePair = {
  question: string;
  answer: string;
  language: 'Bengali' | 'English' | 'Hindi';
};

type KnowledgeCandidate = {
  source: MessengerCmsKnowledgeSource;
  title: string;
  slug: string | null;
  answer: string;
  matchedQuestion?: string;
  language: KnowledgePair['language'] | null;
  score: number;
  matchedTokens: number;
  identity: string;
};

type TextScore = {
  score: number;
  matchedTokens: number;
  ratio: number;
  confident: boolean;
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'does', 'for',
  'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or',
  'our', 'please', 'the', 'their', 'this', 'to', 'us', 'what', 'when',
  'where', 'which', 'who', 'why', 'with', 'you', 'your',
  'কি', 'কী', 'কেন', 'কিভাবে', 'কীভাবে', 'আমার', 'আপনার', 'আপনাদের',
  'এটা', 'এটি', 'এই', 'ওই', 'হবে', 'হয়', 'হয়', 'আছে', 'করুন', 'বলুন',
  'का', 'की', 'के', 'है', 'हैं', 'में', 'से', 'और', 'क्या', 'कैसे',
  'कब', 'कहाँ', 'कहां', 'मुझे', 'मेरे', 'आप', 'आपका', 'कृपया',
]);

const QUESTION_HINTS =
  /[?？]|\b(what|when|where|which|who|why|how|does|do i|can i|tell me|explain|policy|policies|return|refund|exchange|warranty|privacy|terms|about us|contact|company|business hours)\b|(?:কী|কি|কেন|কখন|কোথায়|কোথায়|কেমন|কতদিন|কীভাবে|কিভাবে|ফেরত|রিফান্ড|বদল|ওয়ারেন্টি|ওয়্যারেন্টি|যোগাযোগ|পরিচিতি|নীতি|গোপনীয়তা|গোপনীয়তা|শর্তাবলি|ব্যবসার সময়|ব্যবসার সময়)|(?:क्या|क्यों|कब|कहाँ|कहां|कैसे|कौन|वापसी|रिफंड|बदलना|वारंटी|संपर्क|नीति|जानकारी)/i;

const LIVE_TRANSACTIONAL_HINTS =
  /(?:\b(price|pricing|stock|in stock|available stock|current offer|my order|order status|track order|payment status|transaction status|paid or not|cashfree|refund status)\b|(?:দাম|মূল্য|স্টক|বর্তমান অফার|আমার অর্ডার|অর্ডার স্ট্যাটাস|অর্ডারের অবস্থা|পেমেন্ট স্ট্যাটাস|টাকা পেয়েছে|টাকা পেয়েছে|ট্রানজেকশন স্ট্যাটাস)|(?:कीमत|मूल्य|स्टॉक|मेरा ऑर्डर|ऑर्डर स्टेटस|पेमेंट स्टेटस|भुगतान की स्थिति))/i;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value: string): string {
  return normalizeMessengerIntentText(stripMarkup(value))
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkup(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tokens(value: string): string[] {
  return Array.from(new Set(
    (normalizeText(value).match(/[\p{L}\p{N}]+/gu) || [])
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
  ));
}

export function scoreMessengerKnowledgeText(query: string, candidate: string): TextScore {
  const normalizedQuery = normalizeText(query);
  const normalizedCandidate = normalizeText(candidate);
  const queryTokens = tokens(query);
  const candidateTokens = new Set(tokens(candidate));
  const matched = queryTokens.filter((token) => candidateTokens.has(token));
  const ratio = matched.length / Math.max(1, queryTokens.length);
  const directPhrase =
    queryTokens.length >= 2 &&
    normalizedQuery.length >= 8 &&
    normalizedCandidate.length >= 8 &&
    (normalizedCandidate.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedCandidate));
  const confident =
    directPhrase ||
    (matched.length >= 2 && ratio >= 0.55) ||
    (matched.length >= 3 && ratio >= 0.4);

  return {
    score: (directPhrase ? 12 : 0) + matched.length * 2 + ratio * 3,
    matchedTokens: matched.length,
    ratio,
    confident,
  };
}

function isLikelyKnowledgeQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length < 3 || LIVE_TRANSACTIONAL_HINTS.test(normalized)) return false;
  return QUESTION_HINTS.test(normalized);
}

function buildFaqPairs(row: Record<string, unknown>): KnowledgePair[] {
  const pairs: KnowledgePair[] = [
    {
      language: 'Bengali',
      question: asText(row.question),
      answer: asText(row.answer),
    },
    {
      language: 'English',
      question: asText(row.question_en),
      answer: asText(row.answer_en),
    },
    {
      language: 'Hindi',
      question: asText(row.question_hi),
      answer: asText(row.answer_hi),
    },
  ];

  return pairs.filter((pair) => pair.question && pair.answer);
}

export function rankMessengerCmsFaq(
  query: string,
  rows: Array<Record<string, unknown>>,
  requestedLanguage = detectMessengerReplyLanguage(query),
): KnowledgeCandidate | null {
  const candidates: KnowledgeCandidate[] = [];

  for (const row of rows) {
    for (const pair of buildFaqPairs(row)) {
      const match = scoreMessengerKnowledgeText(query, pair.question);
      if (!match.confident) continue;

      candidates.push({
        source: 'landing_faqs',
        title: pair.question,
        slug: null,
        answer: pair.answer,
        matchedQuestion: pair.question,
        // The data can be stored in the wrong language column; detect the
        // actual answer language so the customer is told when translation is missing.
        language: detectMessengerReplyLanguage(pair.answer),
        score: match.score + (pair.language === requestedLanguage ? 0.75 : 0),
        matchedTokens: match.matchedTokens,
        identity: asText(row.id) || pair.question,
      });
    }
  }

  return selectUnambiguousCandidate(candidates);
}

function extractParagraphs(content: string): string[] {
  const sections = content
    .replace(/<\/(?:p|li|h[1-6]|div|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/\n{1,}|(?<=[.!?।])\s+(?=[\p{L}\p{N}])/u)
    .map(stripMarkup)
    .map((item) => item.trim())
    .filter((item) => item.length >= 30 && item.length <= 1400);

  return Array.from(new Set(sections)).slice(0, 120);
}

function makeDocumentCandidate(
  source: 'pages' | 'blogs',
  row: Record<string, unknown>,
  query: string,
): KnowledgeCandidate | null {
  const title = asText(row.title) || asText(row.seo_title);
  const slug = asText(row.slug) || null;
  const content = asText(row.content);
  const excerpt = asText(row.excerpt);
  const metadata = [asText(row.seo_title), asText(row.meta_description), excerpt]
    .filter(Boolean)
    .join(' ');
  const primary = scoreMessengerKnowledgeText(query, [title, metadata].filter(Boolean).join(' '));
  const paragraphs = extractParagraphs(content);
  const paragraphScores = paragraphs
    .map((paragraph) => ({
      paragraph,
      match: scoreMessengerKnowledgeText(query, paragraph),
    }))
    .filter((entry) => entry.match.confident)
    .sort((a, b) => b.match.score - a.match.score);
  const bestParagraph = paragraphScores[0];

  // A title-only match is not enough: the actual returned passage must also
  // match the question, which prevents unrelated pages from hijacking answers.
  if (!bestParagraph) return null;

  const combined = primary.confident
    ? primary.score + bestParagraph.match.score
    : bestParagraph.match.score;

  return {
    source,
    title: title || slug || 'GAZI SEED information',
    slug,
    answer: bestParagraph.paragraph,
    language: detectMessengerReplyLanguage(bestParagraph.paragraph),
    score: combined,
    matchedTokens: bestParagraph.match.matchedTokens,
    identity: slug || title || source,
  };
}

function selectUnambiguousCandidate(
  candidates: KnowledgeCandidate[],
): KnowledgeCandidate | null {
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || b.matchedTokens - a.matchedTokens);

  const best = candidates[0];
  const runnerUp = candidates[1];
  if (
    runnerUp &&
    runnerUp.identity !== best.identity &&
    Math.abs(best.score - runnerUp.score) < 1.5
  ) {
    return null;
  }

  return best;
}

/**
 * Identifies website-specific policy questions that must not be answered from
 * general model knowledge when no verified, country-scoped CMS answer exists.
 * Transaction/order status questions stay with their dedicated handlers.
 */
export function isMessengerWebsitePolicyQuestion(text: string): boolean {
  const normalized = stripMarkup(text)
    .toLocaleLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\\p{L}\\p{N}\\s-]/gu, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
  if (normalized.length < 3) return false;

  // Never intercept live order/payment status queries; those require their
  // dedicated verified transaction handlers.
  if (
    /(?:\b(order|payment|transaction|refund)\s*(?:status|tracking|track)\b|(?:আমার অর্ডার|অর্ডারের অবস্থা|পেমেন্ট স্ট্যাটাস|ট্রানজেকশন স্ট্যাটাস|রিফান্ড স্ট্যাটাস)|(?:ऑर्डर स्टेटस|भुगतान की स्थिति|रिफंड स्टेटस))/i.test(normalized)
  ) {
    return false;
  }

  return /(?:\b(?:return policy|refund policy|refund|return|returns|exchange policy|exchange|replacement|cancellation policy|cancel(?:lation)?|warranty|guarantee|privacy policy|privacy|terms and conditions|terms of service|payment policy|payment methods?|shipping policy|delivery policy|cash on delivery policy|cod policy|company policy|store policy|policies)\b|(?:ফেরত|রিটার্ন|রিফান্ড|টাকা ফেরত|পণ্য বদল|বদলানো|বাতিল|রদ|ওয়ারেন্টি|ওয়্যারেন্টি|গোপনীয়তা|গোপনীয়তা|শর্তাবলি|নীতিমালা|পেমেন্ট পদ্ধতি|পেমেন্ট নীতি|ক্যাশ অন ডেলিভারি নীতি|রিটার্ন পলিসি|রিফান্ড পলিসি)|(?:वापसी|रिफंड|धनवापसी|बदलना|बदलाव|रद्दीकरण|रद्द करना|वारंटी|गारंटी|गोपनीयता|नियम और शर्तें|भुगतान नीति|भुगतान का तरीका|वापसी नीति)|(?:\b(?:ferot|phire pabo|taka ferot|refund pabo|return korte|return korbo|bodol|batil|niyom|shortaboli|privacy policy|payment methods?)\b))/i.test(normalized);
}

export async function getMessengerPublishedContentAnswer(args: {
  supabase: SupabaseClient;
  country: MessengerCmsKnowledgeCountry;
  text: string;
}): Promise<MessengerCmsKnowledgeResult> {
  const { supabase, country, text } = args;
  if (!isLikelyKnowledgeQuestion(text) && !isMessengerWebsitePolicyQuestion(text)) {
    return { handled: false };
  }

  const lookups = await Promise.allSettled([
    supabase
      .from('landing_faqs')
      .select('id,question,answer,question_en,answer_en,question_hi,answer_hi,display_order,landing_pages!inner(status,country_code)')
      .eq('country_code', country)
      .eq('landing_pages.country_code', country)
      .eq('landing_pages.status', 'active')
      .limit(50),
    supabase
      .from('pages')
      .select('title,slug,content,seo_title,meta_description')
      .eq('country_code', country)
      .eq('is_published', true)
      .limit(40),
    supabase
      .from('blogs')
      .select('title,slug,content,excerpt,translations')
      .eq('country_code', country)
      .eq('is_published', true)
      .limit(40),
  ]);

  const faqRows = lookups[0].status === 'fulfilled' && !lookups[0].value.error
    ? (lookups[0].value.data || []) as Array<Record<string, unknown>>
    : [];
  const pageRows = lookups[1].status === 'fulfilled' && !lookups[1].value.error
    ? (lookups[1].value.data || []) as Array<Record<string, unknown>>
    : [];
  const blogRows = lookups[2].status === 'fulfilled' && !lookups[2].value.error
    ? (lookups[2].value.data || []) as Array<Record<string, unknown>>
    : [];

  const candidates: KnowledgeCandidate[] = [];
  const faqMatch = rankMessengerCmsFaq(text, faqRows);
  if (faqMatch) candidates.push(faqMatch);

  for (const row of pageRows) {
    const candidate = makeDocumentCandidate('pages', row, text);
    if (candidate) candidates.push(candidate);
  }
  for (const row of blogRows) {
    const candidate = makeDocumentCandidate('blogs', row, text);
    if (candidate) candidates.push(candidate);
  }

  const lookupFailed = lookups.some((lookup) =>
    lookup.status === 'rejected' ||
    (lookup.status === 'fulfilled' && Boolean(lookup.value.error)),
  );

  const best = selectUnambiguousCandidate(candidates);
  if (!best) return { handled: false, lookupFailed };

  const language = detectMessengerReplyLanguage(text);
  const missingTranslationNote =
    best.language && best.language !== language
      ? language === 'Hindi'
        ? 'इस जानकारी का हिन्दी अनुवाद अभी उपलब्ध नहीं है; नीचे डेटाबेस में दर्ज उत्तर दिया गया है।'
        : language === 'English'
          ? 'A translated answer is not available yet; the verified database answer is shown below.'
          : 'এই তথ্যের বাংলা অনুবাদ নেই; নিচে database-এ থাকা যাচাইকৃত উত্তর দেওয়া হলো।'
      : '';

  return {
    handled: true,
    source: best.source,
    sourceSlug: best.slug,
    confidence: best.score,
    reply: [
      best.source === 'landing_faqs' ? '📌' : '📚',
      best.title,
      missingTranslationNote,
      best.answer,
    ].filter(Boolean).join('\n\n'),
  };
}
