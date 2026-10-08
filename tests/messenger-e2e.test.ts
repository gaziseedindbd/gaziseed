import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';

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
  isMessengerProductSpecificKnowledgeQuery,
  isMessengerWebsiteKnowledgeRequest,
  selectMessengerFaqResponse,
} from '../lib/ai/messenger-knowledge-tool';

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
