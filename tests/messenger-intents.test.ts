import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMessengerMonitoringSummary } from '../lib/ai/messenger-monitoring';
import {
  addPendingMessengerOrderToCart,
  formatMessengerCartSummary,
  parseMessengerCartItems,
} from '../lib/ai/messenger-order-tool';
import {
  formatMessengerCustomerProfile,
  formatMessengerOrderHistory,
} from '../lib/ai/messenger-customer-tool';

import {
  isMessengerAddAnotherProductRequest,
  isMessengerCheckoutRequest,
  isMessengerCustomerProfileRequest,
  isMessengerOrderHistoryRequest,
  isMessengerOrderInterruptRequest,
  isMessengerOrderResumeRequest,
  isMessengerDeliveryIntent,
  isMessengerHumanSupportIntent,
  isMessengerSeedKnowledgeQuestion,
  isOtherProductRequest,
  isProductCatalogRequest,
  isProductListRequest,
} from '../lib/ai/messenger-intents';
import {
  classifyMessengerProductMatch,
  normalizeMessengerSearchSlug,
  normalizeMessengerSearchTerm,
} from '../lib/ai/messenger-product-tool';
import {
  getMessengerHumanSupportQueueState,
} from '../lib/ai/messenger-human-support';
import {
  getMessengerRateLimitReply,
  hashMessengerMessage,
} from '../lib/ai/messenger-rate-limit';

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

test('normalizes and classifies Messenger product search matches', () => {
  assert.equal(normalizeMessengerSearchTerm('  গোলাপ   ফুল  '), 'গোলাপ ফুল');
  assert.equal(normalizeMessengerSearchSlug('  lal golap fuler bij  '), 'lal-golap-fuler-bij');

  const product = {
    name_bn: 'লাল গোলাপ ফুলের বীজ',
    name_en: 'Red Rose Flower Seeds',
    slug: 'lal-golap-fuler-bij',
  };

  assert.equal(classifyMessengerProductMatch('Red Rose Flower Seeds', product), 'exact');
  assert.equal(classifyMessengerProductMatch('golap', product), 'strong');
  assert.equal(classifyMessengerProductMatch('golp', product), 'similar');
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


test('recognizes Messenger multi-product cart intents', () => {
  assert.equal(isMessengerAddAnotherProductRequest('add another product'), true);
  assert.equal(isMessengerAddAnotherProductRequest('আরও পণ্য যোগ করতে চাই'), true);
  assert.equal(isMessengerCheckoutRequest('checkout'), true);
  assert.equal(isMessengerCheckoutRequest('এখন অর্ডার করুন'), true);
});

test('builds and validates Messenger cart items', () => {
  const cart = parseMessengerCartItems([
    {
      product_id: 'p1',
      product_name: 'Tomato',
      unit_price: 50,
      stock: 20,
      quantity: 2,
    },
  ]);
  assert.equal(cart.length, 1);

  const merged = addPendingMessengerOrderToCart(cart, {
    step: 'name',
    product_id: 'p1',
    product_name: 'Tomato',
    unit_price: 50,
    stock: 20,
    quantity: 1,
  });
  assert.equal(merged[0].quantity, 3);
  assert.match(formatMessengerCartSummary(merged, '৳'), /Tomato × 3/);
});


test('maps Bangladesh human-support queue states', () => {
  assert.equal(getMessengerHumanSupportQueueState('open'), 'pending');
  assert.equal(getMessengerHumanSupportQueueState('assigned'), 'open');
  assert.equal(getMessengerHumanSupportQueueState('resolved'), 'closed');
  assert.equal(getMessengerHumanSupportQueueState('cancelled'), 'closed');
});

test('provides deterministic Messenger abuse-protection helpers', () => {
  assert.equal(hashMessengerMessage('hello'), hashMessengerMessage('hello'));
  assert.notEqual(hashMessengerMessage('hello'), hashMessengerMessage('hello!'));

  assert.match(
    getMessengerRateLimitReply({
      allowed: false,
      reason: 'duplicate_burst',
      retry_after_seconds: 60,
      notify_customer: true,
      minute_count: 5,
      hour_count: 5,
      day_count: 5,
      ai_minute_count: 0,
      ai_hour_count: 0,
      duplicate_count: 4,
      blocked_until: null,
    }),
    /বারবার/,
  );
});


test('recognizes Messenger customer profile and previous-order history', () => {
  assert.equal(isMessengerCustomerProfileRequest('show my profile'), true);
  assert.equal(isMessengerCustomerProfileRequest('আমার ফোন দেখাও'), true);
  assert.equal(isMessengerOrderHistoryRequest('previous orders'), true);
  assert.equal(isMessengerOrderHistoryRequest('আমার আগের অর্ডারগুলো দেখাও'), true);
  assert.equal(isMessengerOrderHistoryRequest('order status'), false);
  assert.equal(isMessengerOrderHistoryRequest('track my order'), false);
});

test('formats Messenger customer profile and order history', () => {
  const profile = formatMessengerCustomerProfile(
    {
      id: 'profile-1',
      name: 'Rahim',
      phone: '01700000000',
      address: 'Dhaka',
      total_orders: 2,
      total_spent: 500,
      last_order_number: 'GS-BD-ABCDEFGH',
      order_numbers: ['GS-BD-ABCDEFGH', 'GS-BD-IJKLMNOP'],
    },
    'BD',
  );
  assert.match(profile, /Rahim/);
  assert.match(profile, /মোট Messenger orders: 2/);

  const history = formatMessengerOrderHistory(
    [
      {
        id: 'order-1',
        order_number: 'GS-BD-ABCDEFGH',
        customer_name: 'Rahim',
        status: 'pending',
        order_status: 'pending',
        payment_status: 'unpaid',
        final_amount: 250,
        created_at: '2026-09-29T10:00:00Z',
      },
    ],
    [
      {
        order_id: 'order-1',
        product_name: 'Tomato',
        quantity: 2,
        unit_price: 50,
        total_price: 100,
      },
    ],
    'BD',
  );
  assert.match(history, /GS-BD-ABCDEFGH/);
  assert.match(history, /Tomato × 2/);
});
