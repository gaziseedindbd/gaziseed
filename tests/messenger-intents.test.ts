import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMessengerMonitoringSummary } from '../lib/ai/messenger-monitoring';

import {
  isMessengerOrderInterruptRequest,
  isMessengerOrderResumeRequest,
  isMessengerDeliveryIntent,
  isMessengerHumanSupportIntent,
  isMessengerSeedKnowledgeQuestion,
  isOtherProductRequest,
  isProductCatalogRequest,
  isProductListRequest,
} from '../lib/ai/messenger-intents';

test('recognizes typo-tolerant other-product request', () => {
  assert.equal(isOtherProductRequest('OTHER PRODCUT DEKHTE CHAIE'), true);
  assert.equal(isOtherProductRequest('OTHER PRODUCT DEKHTE CHAI'), true);
  assert.equal(isOtherProductRequest('SHOW ME OTHER PRODUCTS'), true);
  assert.equal(isOtherProductRequest('আরও পণ্য দেখান'), true);
});

test('does not classify ordinary order details as catalog intent', () => {
  assert.equal(isProductCatalogRequest('2'), false);
  assert.equal(isProductListRequest('Rahim'), false);
  assert.equal(isOtherProductRequest('01XXXXXXXXX'), false);
});

test('recognizes catalog and list requests', () => {
  assert.equal(isProductCatalogRequest('what products do you have'), true);
  assert.equal(isProductListRequest('product list'), true);
});

test('recognizes interrupting intents', () => {
  assert.equal(isMessengerOrderInterruptRequest('delivery charge koto'), true);
  assert.equal(isMessengerOrderInterruptRequest('এই বীজ কীভাবে লাগাব'), true);
  assert.equal(isMessengerOrderInterruptRequest('human support chai'), true);
});

test('recognizes order resume phrases and never treats resume as interrupt', () => {
  assert.equal(isMessengerOrderResumeRequest('continue order'), true);
  assert.equal(isMessengerOrderResumeRequest('আগের অর্ডারটা চালিয়ে যেতে চাই'), true);
  assert.equal(isMessengerOrderInterruptRequest('আগের অর্ডারটা চালিয়ে যেতে চাই'), false);
});

test('classifies delivery, support, and seed knowledge questions independently', () => {
  assert.equal(isMessengerDeliveryIntent('delivery time koto'), true);
  assert.equal(isMessengerHumanSupportIntent('talk to a person'), true);
  assert.equal(isMessengerSeedKnowledgeQuestion('লাউয়ের বীজ কীভাবে বপন করব'), true);
});


test('aggregates Messenger provider monitoring without double-counting provider_result rows', () => {
  const summary = buildMessengerMonitoringSummary([
    {
      role: 'assistant',
      provider: 'gemini',
      action_status: 'provider_result',
      source_context: {
        attempts: [
          { provider: 'gemini', model: 'm1', ok: true, duration_ms: 100 },
        ],
        usage: { total_tokens: 100 },
      },
    },
    {
      role: 'assistant',
      provider: 'gemini',
      action_status: 'sent',
      source_context: {
        attempts: [
          { provider: 'gemini', model: 'm1', ok: true, duration_ms: 100 },
        ],
        usage: { total_tokens: 100 },
      },
    },
    {
      role: 'assistant',
      provider: 'groq',
      action_status: 'sent',
      source_context: {
        attempts: [
          { provider: 'gemini', model: 'm1', ok: false, duration_ms: 200 },
          { provider: 'groq', model: 'm2', ok: true, duration_ms: 300 },
        ],
        usage: { total_tokens: 200 },
      },
    },
    {
      role: 'assistant',
      provider: null,
      action_status: 'handoff',
      source_context: {
        attempts: [
          { provider: 'gemini', model: 'm1', ok: false, duration_ms: 150 },
          { provider: 'groq', model: 'm2', ok: false, duration_ms: 250 },
        ],
      },
    },
  ]);

  assert.equal(summary.responses, 3);
  assert.equal(summary.successful_responses, 2);
  assert.equal(summary.fallback_responses, 1);
  assert.equal(summary.provider_failure_responses, 1);
  assert.equal(summary.total_tokens, 300);
  assert.equal(summary.average_success_latency_ms, 200);

  const gemini = summary.provider_stats.find((row) => row.provider === 'gemini');
  const groq = summary.provider_stats.find((row) => row.provider === 'groq');

  assert.deepEqual(gemini, {
    provider: 'gemini',
    attempts: 3,
    successes: 1,
    failures: 2,
    fallback_hits: 1,
    average_latency_ms: 150,
  });

  assert.deepEqual(groq, {
    provider: 'groq',
    attempts: 2,
    successes: 1,
    failures: 1,
    fallback_hits: 0,
    average_latency_ms: 275,
  });
});
