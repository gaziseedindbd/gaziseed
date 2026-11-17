import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  MessengerAIProviderError,
  getConfiguredMessengerProviders,
  getMessengerProviderOrder,
  messengerAIChat,
} from '../lib/ai/messenger-provider-router';
import {
  getMessengerAIDeliveryActionStatus,
  shouldTrackMessengerAIDeliveryStatus,
} from '../lib/ai/messenger-delivery-state';
import { verifyMessengerWebhookSignature } from '../lib/ai/messenger-webhook-security';
import {
  classifyMessengerProductMatch,
  formatMessengerShortProductReply,
  getMessengerProductSelectionQuickReplies,
  normalizeMessengerProductQuery,
  serializeMessengerProducts,
  type MessengerProduct,
} from '../lib/ai/messenger-product-tool';
import {
  limitMessengerAIHistoryMessages,
  shouldIncludeMessengerAIHistoryMessage,
} from '../lib/ai/messenger-history';
import {
  getMessengerWebsiteKnowledgeAnswer,
  isMessengerBareProductNameQuery,
  isMessengerExplicitProductKnowledgeQuery,
  isMessengerProductSpecificKnowledgeQuery,
  isMessengerWebsiteKnowledgeRequest,
  scoreMessengerProductFaqMatch,
  selectMessengerFaqResponse,
} from '../lib/ai/messenger-knowledge-tool';
import {
  isMessengerWebsitePolicyQuestion,
  rankMessengerCmsFaq,
  scoreMessengerKnowledgeText,
} from '../lib/ai/messenger-cms-knowledge-tool';
import {
  formatMessengerDeliveryPolicyReply,
  isMessengerDeliveryPolicyQuestion,
  type MessengerDeliveryPolicy,
} from '../lib/ai/messenger-delivery-tool';
import { isMessengerOrderInterruptRequest } from '../lib/ai/messenger-intents';
import { detectExplicitMessengerCountry } from '../lib/ai/messenger-country';

const TEST_ENV_KEYS = [
  'AI_MESSENGER_ENABLED',
  'GEMINI_API_KEY',
  'GEMINI_MESSENGER_ENABLED',
  'GROQ_API_KEY',
  'CEREBRAS_API_KEY',
  'OPENROUTER_API_KEY',
  'MESSENGER_AI_PROVIDER_TIMEOUT_MS',
] as const;

function saveEnv(): Record<string, string | undefined> {
  return Object.fromEntries(
    TEST_ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<string, string | undefined>;
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of TEST_ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureProviderTestEnv() {
  process.env.AI_MESSENGER_ENABLED = 'true';
  process.env.GEMINI_API_KEY = '';
  process.env.GEMINI_MESSENGER_ENABLED = 'false';
  process.env.GROQ_API_KEY = 'test-groq';
  process.env.CEREBRAS_API_KEY = 'test-cerebras';
  process.env.OPENROUTER_API_KEY = '';
  process.env.MESSENGER_AI_PROVIDER_TIMEOUT_MS = '3000';
}

test('verifies Messenger webhook signatures without weakening malformed-header handling', () => {
  const body = JSON.stringify({ object: 'page', entry: [] });
  const secret = 'test-app-secret';
  const digest = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

  assert.equal(
    verifyMessengerWebhookSignature(body, 'sha256=' + digest, secret),
    true,
  );
  assert.equal(
    verifyMessengerWebhookSignature(body, 'sha256=' + digest.slice(0, -1) + '0', secret),
    false,
  );
  assert.equal(
    verifyMessengerWebhookSignature(body, 'sha1=' + digest, secret),
    false,
  );
  assert.equal(
    verifyMessengerWebhookSignature(body, null, secret),
    false,
  );
  assert.equal(
    verifyMessengerWebhookSignature(body, 'sha256=' + digest + '=extra', secret),
    false,
  );
});

test('exercises Messenger provider failover without making real provider calls', async () => {
  const snapshot = saveEnv();
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  try {
    configureProviderTestEnv();

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      if (url.includes('api.groq.com')) {
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: async () => JSON.stringify({ error: { message: 'forced groq failure' } }),
        } as Response;
      }

      assert.equal(url.includes('api.cerebras.ai'), true);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({
          model: 'test-cerebras-model',
          choices: [{ message: { content: 'Verified fallback response' } }],
        }),
      } as Response;
    }) as typeof fetch;

    assert.deepEqual(getMessengerProviderOrder(), [
      'gemini',
      'groq',
      'cerebras',
      'openrouter',
    ]);
    assert.deepEqual(getConfiguredMessengerProviders(), ['groq', 'cerebras']);

    const result = await messengerAIChat({
      messages: [
        { role: 'system', content: 'Return a short test response.' },
        { role: 'user', content: 'hello' },
      ],
    });

    assert.equal(result.provider, 'cerebras');
    assert.equal(result.content, 'Verified fallback response');
    assert.deepEqual(result.attempts.map((attempt) => ({
      provider: attempt.provider,
      ok: attempt.ok,
      status: attempt.status,
    })), [
      { provider: 'groq', ok: false, status: 503 },
      { provider: 'cerebras', ok: true, status: undefined },
    ]);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});

test('exercises all-provider failure and preserves the attempt trail for handoff telemetry', async () => {
  const snapshot = saveEnv();
  const originalFetch = globalThis.fetch;

  try {
    configureProviderTestEnv();

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const status = url.includes('api.groq.com') ? 429 : 500;
      return {
        ok: false,
        status,
        statusText: 'Forced Failure',
        text: async () => JSON.stringify({ error: { message: 'forced provider failure' } }),
      } as Response;
    }) as typeof fetch;

    await assert.rejects(
      () => messengerAIChat({
        messages: [{ role: 'user', content: 'hello' }],
      }),
      (error: unknown) => {
        assert.equal(error instanceof MessengerAIProviderError, true);
        const providerError = error as MessengerAIProviderError;
        assert.equal(providerError.attempts.length, 2);
        assert.deepEqual(
          providerError.attempts.map((attempt) => [
            attempt.provider,
            attempt.ok,
            attempt.status,
          ]),
          [
            ['groq', false, 429],
            ['cerebras', false, 500],
          ],
        );
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});

test('keeps Messenger AI delivery state transitions narrow and deterministic', () => {
  assert.equal(shouldTrackMessengerAIDeliveryStatus('generated'), true);
  assert.equal(shouldTrackMessengerAIDeliveryStatus('transactional_guard'), false);
  assert.equal(shouldTrackMessengerAIDeliveryStatus('knowledge_fallback_support'), false);
  assert.equal(shouldTrackMessengerAIDeliveryStatus(null), false);

  assert.equal(
    getMessengerAIDeliveryActionStatus('send_success'),
    'sent',
  );
  assert.equal(
    getMessengerAIDeliveryActionStatus('send_failure'),
    'failed',
  );
});


test('keeps a bounded recent suffix in chronological order', () => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: 'message-' + index,
  }));

  const result = limitMessengerAIHistoryMessages(messages, {
    maxMessages: 30,
    maxCharacters: 10_000,
  });

  assert.equal(result.length, 30);
  assert.equal(result[0].content, 'message-10');
  assert.equal(result.at(-1)?.content, 'message-39');
});

test('drops older history to stay within the character budget', () => {
  const messages = [
    { role: 'user', content: 'oldest' },
    { role: 'assistant', content: 'older' },
    { role: 'user', content: 'recent' },
    { role: 'assistant', content: 'latest' },
  ];

  const result = limitMessengerAIHistoryMessages(messages, {
    maxMessages: 10,
    maxCharacters: 12,
  });

  assert.deepEqual(result.map((message) => message.content), ['recent', 'latest']);
});

test('preserves the latest message intact when it exceeds the budget', () => {
  const messages = [
    { role: 'user', content: 'an older turn that is too long to keep' },
    { role: 'user', content: 'the complete latest customer message' },
  ];

  const result = limitMessengerAIHistoryMessages(messages, {
    maxMessages: 10,
    maxCharacters: 8,
  });

  assert.deepEqual(result, [messages[1]]);
});

test('excludes provider and failed internal states from history', () => {
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: 'provider_result' }), false);
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: 'generated' }), false);
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: 'failed' }), false);
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: 'sent' }), true);
  assert.equal(shouldIncludeMessengerAIHistoryMessage({ action_status: null }), true);
});


test('exposes growing instructions only for trusted catalog matches', () => {
  const products = serializeMessengerProducts([
    {
      id: 'trusted-product',
      name_bn: 'পরীক্ষার বীজ',
      name_en: 'Test Seed',
      slug: 'test-seed',
      cultivation_instructions: 'Verified sowing instructions',
      plant_spacing: '30 cm',
      search_match_type: 'exact',
    } as unknown as MessengerProduct,
    {
      id: 'similar-product',
      name_bn: 'অনুরূপ বীজ',
      name_en: 'Similar Seed',
      slug: 'similar-seed',
      cultivation_instructions: 'Unverified instructions',
      plant_spacing: '90 cm',
      search_match_type: 'similar',
    } as unknown as MessengerProduct,
  ]);

  assert.equal(products[0].cultivation_instructions, 'Verified sowing instructions');
  assert.equal(products[0].plant_spacing, '30 cm');
  assert.equal(products[1].cultivation_instructions, null);
  assert.equal(products[1].plant_spacing, null);
});

test('selects the FAQ answer in the customer language when available', () => {
  const faq = {
    id: 'faq-1',
    question_bn: 'কখন বপন করব?',
    answer_bn: 'বাংলা উত্তর',
    question_en: 'When should I sow?',
    answer_en: 'English answer',
    question_hi: 'मुझे कब बुवाई करनी चाहिए?',
    answer_hi: 'उपयुक्त मौसम में बुवाई करें।',
    display_order: 1,
  };

  assert.deepEqual(selectMessengerFaqResponse(faq, 'Bengali'), {
    question: faq.question_bn,
    answer: faq.answer_bn,
  });
  assert.deepEqual(selectMessengerFaqResponse(faq, 'English'), {
    question: faq.question_en,
    answer: faq.answer_en,
  });
  assert.deepEqual(selectMessengerFaqResponse(faq, 'Hindi'), {
    question: faq.question_hi,
    answer: faq.answer_hi,
  });
  assert.deepEqual(
    selectMessengerFaqResponse({ ...faq, question_hi: null, answer_hi: null }, 'Hindi'),
    { question: faq.question_en, answer: faq.answer_en },
  );
  assert.deepEqual(
    selectMessengerFaqResponse({ ...faq, question_en: null, answer_en: null }, 'English'),
    { question: faq.question_bn, answer: faq.answer_bn },
  );
});

test('routes Hindi product-growing questions into the database knowledge path', () => {
  assert.equal(isMessengerWebsiteKnowledgeRequest('केरल बीन्स के बीज कितने दिनों में अंकुरित होते हैं?'), true);
  assert.equal(
    isMessengerProductSpecificKnowledgeQuery('इस बीज को कितनी धूप चाहिए?', {
      name_bn: 'পরীক্ষার বীজ',
      name_en: 'Test Seed',
      slug: 'test-seed',
    }),
    true,
  );
});

test('recognizes a distinctive product name in a general agriculture FAQ question', () => {
  assert.equal(
    isMessengerExplicitProductKnowledgeQuery('জিনিয়া ফুলের জন্য কতটা রোদ প্রয়োজন?', {
      name_bn: 'লাল জিনিয়া ফুলের বীজ',
      name_en: 'Red Zinnia Flower Seeds',
      slug: 'red-zinnia-flower-seeds',
    }),
    true,
  );
});

test('recognizes English FAQ questions naming a product despite general sunlight wording', () => {
  assert.equal(
    isMessengerExplicitProductKnowledgeQuery('How much sunlight does Zinnia need?', {
      name_bn: 'লাল জিনিয়া ফুলের বীজ',
      name_en: 'Red Zinnia Flower Seeds',
      slug: 'red-zinnia-flower-seeds',
    }),
    true,
  );
});
test('normalizes Bengali price and stock questions into precise product matches', () => {
  const query = normalizeMessengerProductQuery('গোলাপ ফুলের বীজের দাম ও স্টক কত?');

  assert.equal(query, 'গোলাপ ফুলের বীজ');
  assert.equal(
    classifyMessengerProductMatch(query, {
      name_bn: 'লাল গোলাপ ফুলের বীজ',
      name_en: 'Red Rose Flower Seeds',
      slug: 'lal-golap-fuler-bij',
    }),
    'strong',
  );
  assert.equal(
    classifyMessengerProductMatch(query, {
      name_bn: 'মিক্স ডালিয়া ফুলের বীজ',
      name_en: 'Mixed Dahlia Flower Seeds',
      slug: 'mix-dalia-fuler-bij',
    }),
    'similar',
  );
});

test('normalizes Rani Lanka price questions into a trusted product match', () => {
  const product = {
    name_bn: 'হাইব্রিড মরিচ – রানি লঙ্কা',
    name_en: 'Hybrid Chili – Rani Lanka',
    slug: 'hybrid-chili-rani-lanka',
  };

  assert.equal(
    normalizeMessengerProductQuery('রানী লঙ্কার বীজের দাম কত?'),
    'রানী লঙ্কার বীজ',
  );
  assert.equal(
    classifyMessengerProductMatch(
      normalizeMessengerProductQuery('রানী লঙ্কার বীজের দাম কত?'),
      product,
    ),
    'strong',
  );
  assert.equal(
    classifyMessengerProductMatch(
      normalizeMessengerProductQuery('Rani Chili Seed price koto?'),
      product,
    ),
    'strong',
  );
});

test('matches a hyphenated English product exactly in a Hindi price and stock question', () => {
  const query = normalizeMessengerProductQuery(
    'Five-Color Chili Seeds की कीमत और स्टॉक कितना है?',
  );

  assert.equal(query, 'five color chili seeds');
  assert.equal(
    classifyMessengerProductMatch(query, {
      name_bn: 'ফাইভ কালার মরিচের বীজ',
      name_en: 'Five-Color Chili Seeds',
      slug: 'five-color-chili-seeds',
    }),
    'exact',
  );
  assert.equal(
    classifyMessengerProductMatch(query, {
      name_bn: 'নাগা বোম্বাই মরিচের বীজ',
      name_en: 'Naga Bombay Chili Seeds',
      slug: 'naga-bombay-chili-seeds',
    }),
    'similar',
  );
});
test('offers selection options for trusted and similar products', () => {
  const options = getMessengerProductSelectionQuickReplies([
    {
      id: '2bd79fb9-c9ca-4e45-9db1-2a1f8fc075ae',
      name_bn: 'লাল গোলাপ ফুলের বীজ',
      name_en: 'Red Rose Flower Seeds',
      slug: 'lal-golap-fuler-bij',
      search_match_type: 'strong',
    },
    {
      id: 'd47e1d77-7ec2-4d0c-9f1b-d97d7ac640e4',
      name_bn: 'মিক্স ডালিয়া ফুলের বীজ',
      name_en: 'Mixed Dahlia Flower Seeds',
      slug: 'mix-dalia-fuler-bij',
      search_match_type: 'similar',
    },
  ]);

  assert.deepEqual(options, [
    {
      title: 'লাল গোলাপ ফুলের বীজ',
      payload: 'PRODUCT_SELECT:2bd79fb9-c9ca-4e45-9db1-2a1f8fc075ae',
    },
    {
      title: 'মিক্স ডালিয়া ফুলের …',
      payload: 'PRODUCT_SELECT:d47e1d77-7ec2-4d0c-9f1b-d97d7ac640e4',
    },
  ]);
});


test('database FAQ matching stays paired with its source-language question and answer', () => {
  const match = rankMessengerCmsFaq(
    'How deep should I sow rose seeds?',
    [{
      id: 'mixed-language-row',
      question_en: 'How deep should I sow rose seeds?',
      answer_en: 'Sow the seeds about 0.5 cm deep.',
      question: 'লাল গোলাপের বীজ থেকে চারা হতে কতদিন লাগে?',
      answer: 'গোলাপের বীজ থেকে চারা হতে কয়েক সপ্তাহ লাগতে পারে।',
    }],
    'English',
  );

  assert.equal(match?.language, 'English');
  assert.equal(match?.answer, 'Sow the seeds about 0.5 cm deep.');
});

const RANI_FAQ_QUESTION = 'এই মরিচের জাতের নাম কী?';
const RANI_FAQ_ANSWER =
  'এটি হাইব্রিড মরিচ, রানি লঙ্কা (বাণিজ্যিক চাষ) নামে তালিকাভুক্ত।';

const RANI_SHORT_REPLY_PRODUCT = {
  name_bn: 'হাইব্রিড মরিচ, রানি লঙ্কা (বাণিজ্যিক চাষ)',
  name_en: 'Hybrid Chili – Rani Lanka',
  slug: 'hybrid-chili-rani-lanka',
  regular_price: 190,
  sale_price: null,
  offer_price: null,
  price: 190,
  stock: 25,
  packet_weight: '200 g',
};

// Minimal stand-in for the Supabase client used by
// getMessengerWebsiteKnowledgeAnswer: the indexed RPC returns the Rani
// product, product_faqs returns its variety FAQ, and product reads return
// the full Rani record. `variety: null` forces the field-answer path to
// miss so the FAQ path is exercised.
function makeRaniKnowledgeSupabase(variety: string | null = 'হাইব্রিড মরিচ') {
  const rani = {
    ...RANI_SHORT_REPLY_PRODUCT,
    id: 'rani-lanka-id',
    short_description: 'হাইব্রিড মরিচ, রানি লঙ্কা',
    description: 'হাইব্রিড মরিচ, রানি লঙ্কা (বাণিজ্যিক চাষ)',
    is_active: true,
    seed_type: 'মরিচ',
    variety,
    brand: null,
    origin: null,
    season: null,
    planting_season: null,
    germination_time: null,
    germination_rate: null,
    harvest_time: null,
    plant_spacing: null,
    planting_depth: null,
    sunlight: null,
    water_requirement: null,
    soil_type: null,
    growing_location: null,
    seed_quantity: null,
    expected_yield: null,
    cultivation_instructions: null,
    storage_instructions: null,
    country_code: 'IN',
  };

  const faqs = [
    {
      id: 'faq-rani-variety-name',
      question_bn: RANI_FAQ_QUESTION,
      answer_bn: RANI_FAQ_ANSWER,
      question_en: 'What is the name of this chili variety?',
      answer_en:
        'It is listed as Hybrid Chili, Rani Lanka (Commercial Cultivation).',
      display_order: 1,
    },
  ];

  type FakeQueryResult = { data: unknown; error: null };
  const makeQuery = (table: string) => {
    const result: FakeQueryResult = {
      data: table === 'product_faqs' ? faqs : [rani],
      error: null,
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      or: () => builder,
      order: () => builder,
      limit: () => builder,
      in: () => builder,
      maybeSingle: async () => ({ data: rani, error: null }),
      then: (resolve: (value: FakeQueryResult) => void) => resolve(result),
    };
    return builder;
  };

  return {
    rpc: async () => ({ data: [rani], error: null }),
    from: (table: string) => makeQuery(table),
  } as unknown as SupabaseClient;
}

test('a bare Rani product name does not confidently match its variety FAQ', () => {
  const score = scoreMessengerProductFaqMatch(
    'রানি মরিচের বীজ',
    RANI_FAQ_QUESTION,
  );

  // One shared word ("মরিচ") must not count twice via the genitive
  // expansion ("মরিচের" + "মরিচ").
  assert.equal(score.overlap, 1);
  assert.equal(score.confident, false);
});

test('a real Rani variety question still confidently matches the same FAQ', () => {
  const score = scoreMessengerProductFaqMatch(
    'রানি মরিচের বীজের জাতের নাম কী?',
    RANI_FAQ_QUESTION,
  );

  assert.equal(score.overlap, 3);
  assert.equal(score.confident, true);

  assert.equal(isMessengerBareProductNameQuery('রানি মরিচের বীজ'), true);
  assert.equal(
    isMessengerBareProductNameQuery('রানি মরিচের বীজের জাতের নাম কী?'),
    false,
  );
  assert.equal(isMessengerBareProductNameQuery('এই বীজের দাম কত?'), false);
  assert.equal(isMessengerBareProductNameQuery('Rani Chili Seed'), true);
});

test('a bare Rani product name falls through to the catalog short price reply', async () => {
  const knowledge = await getMessengerWebsiteKnowledgeAnswer({
    supabase: makeRaniKnowledgeSupabase(),
    country: 'IN',
    text: 'রানি মরিচের বীজ',
  });

  // The knowledge path must not answer a bare product name with a FAQ
  // reply, so the deterministic catalog path can answer with the price.
  assert.equal(knowledge.handled, false);
  assert.equal(knowledge.productId, 'rani-lanka-id');

  const shortReply = formatMessengerShortProductReply(
    RANI_SHORT_REPLY_PRODUCT,
    'IN',
    'Bengali',
  );

  assert.equal(
    shortReply,
    [
      'হাইব্রিড মরিচ, রানি লঙ্কা (বাণিজ্যিক চাষ)',
      'দাম: ₹190 প্রতি প্যাকেট',
      'অর্ডার করবেন?',
    ].join('\n'),
  );
  assert.equal(shortReply.includes('❓'), false);
  assert.equal(shortReply.includes('জাতের নাম'), false);
});

test('an English bare Rani product name still gives the short price reply', async () => {
  const knowledge = await getMessengerWebsiteKnowledgeAnswer({
    supabase: makeRaniKnowledgeSupabase(),
    country: 'IN',
    text: 'Rani Chili Seed',
  });

  assert.equal(knowledge.handled, false);

  assert.equal(
    formatMessengerShortProductReply(
      RANI_SHORT_REPLY_PRODUCT,
      'IN',
      'English',
    ),
    [
      'Hybrid Chili – Rani Lanka',
      'Price: ₹190 per packet',
      'Would you like to order?',
    ].join('\n'),
  );
});

test('a real Rani variety question still gets a verified FAQ answer', async () => {
  const knowledge = await getMessengerWebsiteKnowledgeAnswer({
    supabase: makeRaniKnowledgeSupabase(null),
    country: 'IN',
    text: 'রানি মরিচের বীজের জাতের নাম কী?',
  });

  assert.equal(knowledge.handled, true);
  assert.ok(knowledge.reply?.includes('❓'));
  assert.ok(knowledge.reply?.includes(RANI_FAQ_ANSWER));
});

test('a real Rani variety question still gets a verified field answer', async () => {
  const knowledge = await getMessengerWebsiteKnowledgeAnswer({
    supabase: makeRaniKnowledgeSupabase('হাইব্রিড মরিচ'),
    country: 'IN',
    text: 'রানি মরিচের বীজের জাতের নাম কী?',
  });

  assert.equal(knowledge.handled, true);
  assert.ok(knowledge.reply?.includes('জাত/ভ্যারাইটি'));
  assert.ok(knowledge.reply?.includes('হাইব্রিড মরিচ'));
});

test('requires verified CMS answers for website-specific policy questions', () => {
  for (const query of [
    'What is your return policy?',
    'Can I get a refund?',
    'পণ্য ফেরত দেওয়ার নিয়ম কী?',
    'taka ferot pabo kivabe?',
    'मेरी वापसी की नीति क्या है?',
    'What are your terms and conditions?',
    'What payment methods do you accept?',
  ]) {
    assert.equal(isMessengerWebsitePolicyQuestion(query), true, query);
  }

  // Dedicated transactional status questions must continue through their
  // verified order/payment handlers rather than the generic policy fallback.
  assert.equal(isMessengerWebsitePolicyQuestion('What is my order status?'), false);
  assert.equal(isMessengerWebsitePolicyQuestion('What is my payment status?'), false);

  // Ordinary agriculture and product questions must remain eligible for the
  // existing verified product-knowledge / general-advice flow.
  assert.equal(isMessengerWebsitePolicyQuestion('How do I grow tomato seeds?'), false);
  assert.equal(isMessengerWebsitePolicyQuestion('What is the price and stock?'), false);
});

test('database knowledge matching rejects unrelated text and ambiguous FAQ hits', () => {
  assert.equal(
    scoreMessengerKnowledgeText(
      'What is the return policy?',
      'Sweet-tasting seeds suitable for home gardening.',
    ).confident,
    false,
  );

  const ambiguous = rankMessengerCmsFaq(
    'What is my account policy?',
    [
      { id: 'faq-a', question_en: 'What is my account policy?', answer_en: 'Answer A' },
      { id: 'faq-b', question_en: 'What is my account policy?', answer_en: 'Answer B' },
    ],
    'English',
  );
  assert.equal(ambiguous, null);
});

test('database FAQ answer language is detected from content, not trusted solely from column name', () => {
  const mislabeled = rankMessengerCmsFaq(
    'What is the return policy?',
    [{
      id: 'legacy-mixed-language',
      question: 'What is the return policy?',
      answer: 'Returns are reviewed by our customer support team.',
    }],
    'English',
  );

  assert.equal(mislabeled?.answer, 'Returns are reviewed by our customer support team.');
  assert.equal(mislabeled?.language, 'English');
});


function makeTestDeliveryPolicy(country: 'BD' | 'IN' = 'BD'): MessengerDeliveryPolicy {
  const currency = country === 'IN' ? 'INR' : 'BDT';
  const rules = country === 'IN'
    ? [
        { title: null, subtitle: null, min_order: 1000, max_order: null, charge: 0, currency, is_free: true, featured: true, display_order: 1 },
        { title: null, subtitle: null, min_order: 600, max_order: 999, charge: 99, currency, is_free: false, featured: false, display_order: 2 },
        { title: null, subtitle: null, min_order: 300, max_order: 599, charge: 149, currency, is_free: false, featured: false, display_order: 3 },
        { title: null, subtitle: null, min_order: 0, max_order: 299, charge: 199, currency, is_free: false, featured: false, display_order: 4 },
      ]
    : [
        { title: null, subtitle: null, min_order: 600, max_order: null, charge: 0, currency, is_free: true, featured: true, display_order: 1 },
        { title: null, subtitle: null, min_order: 400, max_order: 599, charge: 50, currency, is_free: false, featured: false, display_order: 2 },
        { title: null, subtitle: null, min_order: 200, max_order: 399, charge: 70, currency, is_free: false, featured: false, display_order: 3 },
        { title: null, subtitle: null, min_order: 0, max_order: 199, charge: 120, currency, is_free: false, featured: false, display_order: 4 },
      ];

  return {
    country_settings: [{
      country_code: country,
      country_name: country === 'IN' ? 'India' : 'Bangladesh',
      currency,
      hero_title: null,
      hero_subtitle: null,
      delivery_time_primary_label: null,
      delivery_time_primary_value: '১ – ২ দিন',
      delivery_time_secondary_label: null,
      delivery_time_secondary_value: '২ – ৩ দিন',
      notes: [],
    }],
    charge_rules: rules,
    zones: country === 'IN'
      ? [{
          zone_name: 'India Standard Delivery',
          charge: 90,
          estimated_time: '4–7 business days',
          cod_enabled: true,
          display_order: 1,
        }]
      : [],
  };
}

test('delivery questions interrupt an unrelated pending product order and should route to delivery policy', () => {
  const question = 'ভারতে ₹৫০০ টাকার অর্ডারে ডেলিভারি চার্জ কত?';

  assert.equal(isMessengerDeliveryPolicyQuestion(question), true);
  assert.equal(isMessengerOrderInterruptRequest(question), true);
});

test('detects Bangladesh from a subtotal delivery question even when the amount follows the country phrase', () => {
  assert.equal(
    detectExplicitMessengerCountry('বাংলাদেশে ৳৫০০ টাকার অর্ডারে ডেলিভারি চার্জ কত?'),
    'BD',
  );
  assert.equal(
    detectExplicitMessengerCountry('ভারতে ₹৫০০ টাকার অর্ডারে ডেলিভারি চার্জ কত?'),
    'IN',
  );
  assert.equal(detectExplicitMessengerCountry('বাংলাদেশি বীজের দাম কত?'), null);
});

test('Messenger delivery-charge replies use the checkout order-value rules directly', () => {
  const reply = formatMessengerDeliveryPolicyReply(
    makeTestDeliveryPolicy('BD'),
    'BD',
    '500 taka delivery charge',
    'Bengali',
  );

  assert.ok(reply);
  assert.match(reply, /৳৫০/);
  assert.match(reply, /৳৪০০–৳৫৯৯/);
  assert.doesNotMatch(reply, /৳৭০/);
});

test('Messenger delivery times are localized and unknown coverage is not guessed', () => {
  const policy = makeTestDeliveryPolicy('BD');
  const reply = formatMessengerDeliveryPolicyReply(policy, 'BD', 'delivery time', 'English');

  assert.ok(reply);
  assert.match(reply, /Inside Dhaka: 1–2 days/);
  assert.match(reply, /Outside Dhaka: 2–3 days/);
  assert.equal(
    formatMessengerDeliveryPolicyReply(policy, 'BD', 'Do you deliver to Kolkata?', 'English'),
    null,
  );
  assert.equal(
    formatMessengerDeliveryPolicyReply(policy, 'BD', 'Kolkata te delivery hobe?', 'English'),
    null,
  );
});

test('Messenger delivery intent recognizes Hindi and Romanized Bangla', () => {
  assert.equal(isMessengerDeliveryPolicyQuestion('delivery charge koto?'), true);
  assert.equal(isMessengerDeliveryPolicyQuestion('डिलीवरी शुल्क कितना है?'), true);
});

test('India COD replies explain the configured limit and checkout eligibility instead of overpromising', () => {
  const reply = formatMessengerDeliveryPolicyReply(
    makeTestDeliveryPolicy('IN'),
    'IN',
    'Is COD available?',
    'English',
  );

  assert.match(reply || '', /configured India delivery options/i);
  assert.match(reply || '', /checkout will confirm eligibility/i);
});
