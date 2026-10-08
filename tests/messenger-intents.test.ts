import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMessengerMonitoringSummary } from '../lib/ai/messenger-monitoring';
import {
  addPendingMessengerOrderToCart,
  applyMessengerCustomerProfileToPending,
  formatMessengerCartSummary,
  isMessengerOrderIntent,
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
  isMessengerChangeDetailsRequest,
  isMessengerOrderResumeRequest,
  isMessengerOrderTrackingRequest,
  isMessengerPaymentStatusRequest,
  isMessengerRecommendationRequest,
  isMessengerRestockNotificationRequest,
  isMessengerOrderLinkRequest,
  isMessengerDeliveryIntent,
  isMessengerHumanSupportIntent,
  isMessengerSeedKnowledgeQuestion,
  isOtherProductRequest,
  isProductCatalogRequest,
  isProductListRequest,
  normalizeMessengerIntentText,
} from '../lib/ai/messenger-intents';
import {
  getMessengerProductSelectionQuickReplies,
  classifyMessengerProductMatch,
  isTrustedMessengerProductMatch,
  normalizeMessengerSearchSlug,
  normalizeMessengerSearchTerm,
  serializeMessengerProducts,
} from '../lib/ai/messenger-product-tool';
import {
  getBangladeshPaymentMethodReply,
  isMessengerExplicitProductKnowledgeQuery,
  isBangladeshPaymentMethodQuestion,
  isMessengerProductSpecificKnowledgeQuery,
} from '../lib/ai/messenger-knowledge-tool';
import {
  getMessengerHumanSupportQueueState,
} from '../lib/ai/messenger-human-support';
import {
  classifyMessengerTransactionalReply,
  getMessengerTransactionalGuardReply,
  isUnsafeMessengerTransactionalReply,
} from '../lib/ai/messenger-transactional-guard';
import {
  formatMessengerPaymentIntentStatus,
  isMessengerPaymentRetryableStatus,
} from '../lib/ai/messenger-payment-status';
import {
  getMessengerRateLimitReply,
  hashMessengerMessage,
  resolveMessengerRateLimitCountry,
} from '../lib/ai/messenger-rate-limit';
import {
  extractMessengerPhone,
  normalizeMessengerPhone,
} from '../lib/ai/messenger-phone';
import { shouldIncludeMessengerAIHistoryMessage } from '../lib/ai/messenger-history';
import { detectExplicitMessengerCountry } from '../lib/ai/messenger-country';
import {
  detectMessengerReplyLanguage,
  getMessengerProviderFailureHandoffReply,
} from '../lib/ai/messenger-language';



test('localizes all-provider-failure handoff replies without touching normal AI routing', () => {
  assert.match(getMessengerProviderFailureHandoffReply('English'), /automated assistance/i);
  assert.match(getMessengerProviderFailureHandoffReply('Hindi'), /स्वचालित सहायता/);
  assert.match(getMessengerProviderFailureHandoffReply('Bengali'), /স্বয়ংক্রিয় সহায়তা/);
});

test('detects Messenger country only from explicit country intent', () => {
  assert.equal(detectExplicitMessengerCountry('India'), 'IN');
  assert.equal(detectExplicitMessengerCountry('Bangladesh'), 'BD');
  assert.equal(detectExplicitMessengerCountry('I am in India'), 'IN');
  assert.equal(detectExplicitMessengerCountry('deliver to India'), 'IN');
  assert.equal(detectExplicitMessengerCountry('India delivery'), 'IN');
  assert.equal(detectExplicitMessengerCountry('Indian customer'), 'IN');
  assert.equal(detectExplicitMessengerCountry('Bangladesh branch'), 'BD');
  assert.equal(detectExplicitMessengerCountry('বাংলাদেশে ডেলিভারি'), 'BD');
  assert.equal(detectExplicitMessengerCountry('ভারত থেকে অর্ডার করব'), 'IN');

  assert.equal(detectExplicitMessengerCountry('Indian seeds please'), null);
  assert.equal(detectExplicitMessengerCountry('Indian tomato variety'), null);
  assert.equal(detectExplicitMessengerCountry('from Indian seeds'), null);
  assert.equal(detectExplicitMessengerCountry('Bangladeshi seeds'), null);
  assert.equal(detectExplicitMessengerCountry('বাংলাদেশি জাতের বীজ আছে?'), null);
  assert.equal(detectExplicitMessengerCountry('ভারতীয় বীজ আছে?'), null);

  assert.equal(
    detectExplicitMessengerCountry('Indian seeds, deliver to Bangladesh'),
    'BD',
  );
});

test('keeps internal Messenger AI delivery states out of future context', () => {
  assert.equal(
    shouldIncludeMessengerAIHistoryMessage({ action_status: 'provider_result' }),
    false,
  );
  assert.equal(
    shouldIncludeMessengerAIHistoryMessage({ action_status: 'generated' }),
    false,
  );
  assert.equal(
    shouldIncludeMessengerAIHistoryMessage({ action_status: 'failed' }),
    false,
  );
  assert.equal(
    shouldIncludeMessengerAIHistoryMessage({ action_status: 'sent' }),
    true,
  );
  assert.equal(
    shouldIncludeMessengerAIHistoryMessage({ action_status: 'transactional_guard' }),
    true,
  );
  assert.equal(
    shouldIncludeMessengerAIHistoryMessage({ action_status: null }),
    true,
  );
  assert.equal(
    shouldIncludeMessengerAIHistoryMessage({}),
    true,
  );
});

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


test('recognizes Romanized Bangla purchase intent without affecting normal browsing', () => {
  assert.equal(isMessengerOrderIntent('ROSE SEED KINTE CHAIE'), true);
  assert.equal(isMessengerOrderIntent('golap seed kinte chai'), true);
  assert.equal(isMessengerOrderIntent('ROSE SEED KINTE CHAY'), true);
  assert.equal(isMessengerOrderIntent('rose seed nite chai'), true);
  assert.equal(isMessengerOrderIntent('what products do you have'), false);
  assert.equal(isMessengerOrderIntent('how to plant rose seeds'), false);
});

test('recognizes common Messenger product spelling typos', () => {
  assert.equal(isProductListRequest('ki ki prodcut ase?'), true);
  assert.equal(isProductCatalogRequest('kono prodcut naie?'), true);
  assert.equal(isProductListRequest('ki ki prodcuts ase?'), true);
});

test('routes Banglish and Hindi catalog, order, delivery, and seed questions', () => {
  assert.equal(isProductCatalogRequest('ami rose seed er dam koto?'), true);
  assert.equal(isMessengerOrderIntent('ami rose seed kinte chai'), true);
  assert.equal(isMessengerDeliveryIntent('delivery charge koto?'), true);
  assert.equal(isMessengerSeedKnowledgeQuestion('rose seed kivabe lagabo?'), true);
  assert.equal(detectMessengerReplyLanguage('ami amar order er status jante chai'), 'Bengali');

  assert.equal(isProductCatalogRequest('गुलाब के बीज की कीमत क्या है?'), true);
  assert.equal(isProductListRequest('आपके पास कौन से बीज उपलब्ध हैं?'), true);
  assert.equal(isMessengerDeliveryIntent('डिलीवरी में कितने दिन लगेंगे?'), true);
  assert.equal(isMessengerOrderIntent('मुझे गुलाब के बीज चाहिए'), true);
  assert.equal(isMessengerSeedKnowledgeQuestion('गुलाब के बीज की मिट्टी कैसी होनी चाहिए?'), true);
  assert.equal(detectMessengerReplyLanguage('गुलाब के बीज की कीमत क्या है?'), 'Hindi');
  assert.match(normalizeMessengerIntentText('गुलाब के बीज की कीमत'), /গোলাপ.*বীজ.*দাম/);
});

test('keeps similar Messenger matches out of transactional product data', () => {
  assert.equal(
    isTrustedMessengerProductMatch({ search_match_type: 'exact' }),
    true,
  );
  assert.equal(
    isTrustedMessengerProductMatch({ search_match_type: 'strong' }),
    true,
  );
  assert.equal(
    isTrustedMessengerProductMatch({ search_match_type: 'similar' }),
    false,
  );

  const serialized = serializeMessengerProducts([
    {
      id: 'p-similar',
      name_bn: 'লাল গোলাপ ফুলের বীজ',
      name_en: 'Red Rose Flower Seeds',
      slug: 'lal-golap-fuler-bij',
      short_description: null,
      image: null,
      regular_price: 99,
      sale_price: 89,
      offer_price: null,
      price: null,
      stock: 25,
      is_active: true,
      seed_type: null,
      variety: null,
      season: null,
      planting_season: null,
      packet_weight: null,
      germination_time: null,
      germination_rate: null,
      harvest_time: null,
      country_code: 'IN',
      search_match_type: 'similar',
      search_match_score: 0.21,
    },
  ])[0];

  assert.equal(serialized.transactional_data_verified, false);
  assert.equal(serialized.effective_price, null);
  assert.equal(serialized.stock, null);
  assert.equal(serialized.regular_price, null);
  assert.equal(serialized.sale_price, null);
  assert.equal(serialized.offer_price, null);
});

test('prefers an explicitly named crop over a stale referenced product', () => {
  const rose = {
    name_bn: 'লাল গোলাপ ফুলের বীজ',
    name_en: 'Red Rose Flower Seeds',
    slug: 'lal-golap-fuler-bij',
  };
  const chili = {
    name_bn: 'বিদেশি লাল লম্বা মরিচের বীজ',
    name_en: 'Foreign Red Long Chili Seeds',
    slug: 'bideshi-lal-lomba-moricher-bij',
  };
  const question = 'বিদেশি লাল লম্বা মরিচের বীজ etar germination kemon?';

  assert.equal(isMessengerExplicitProductKnowledgeQuery(question, chili), true);
  assert.equal(isMessengerExplicitProductKnowledgeQuery(question, rose), false);
  assert.equal(isMessengerProductSpecificKnowledgeQuery(question, chili), true);
  assert.equal(isMessengerProductSpecificKnowledgeQuery(question, rose), false);
  assert.equal(isMessengerProductSpecificKnowledgeQuery('এটার germination কেমন?', rose), true);
});

test('offers selectable options for similar product matches without disclosing their price', () => {
  const options = getMessengerProductSelectionQuickReplies([
    {
      id: '00000000-0000-4000-8000-000000000001',
      name_bn: 'লাল গোলাপ ফুলের বীজ',
      name_en: 'Red Rose Flower Seeds',
      slug: 'lal-golap-fuler-bij',
      search_match_type: 'similar',
    },
  ], 'English');

  assert.deepEqual(options, [{
    title: 'Red Rose Flower See…',
    payload: 'PRODUCT_SELECT:00000000-0000-4000-8000-000000000001',
  }]);
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



test('recognizes Bangladesh COD-only payment questions', () => {
  assert.equal(isBangladeshPaymentMethodQuestion('আপনাদের payment method কী কী?'), true);
  assert.equal(isBangladeshPaymentMethodQuestion('cash on delivery আছে?'), true);
  assert.equal(isBangladeshPaymentMethodQuestion('delivery charge koto'), false);
  assert.match(getBangladeshPaymentMethodReply(), /Cash on Delivery/);
  assert.match(getBangladeshPaymentMethodReply('English'), /currently accepts Cash on Delivery/);
  assert.match(getBangladeshPaymentMethodReply('Hindi'), /Bangladesh में अभी केवल/);
});

test('keeps generic agriculture process questions out of stale product context', () => {
  const product = {
    name_bn: 'লাল গোলাপ ফুলের বীজ',
    name_en: 'Red Rose Flower Seeds',
    slug: 'lal-golap-fuler-bij',
  };

  assert.equal(
    isMessengerProductSpecificKnowledgeQuery('বীজ বপনের আগে মাটি কীভাবে প্রস্তুত করব?', product),
    false,
  );
  assert.equal(
    isMessengerProductSpecificKnowledgeQuery('এই বীজের মাটি কেমন?', product),
    true,
  );
  assert.equal(
    isMessengerProductSpecificKnowledgeQuery('লাল গোলাপের মাটি কেমন?', product),
    true,
  );
});

test('recognizes interrupting intents', () => {
  assert.equal(isMessengerOrderInterruptRequest('delivery charge koto'), true);
  assert.equal(isMessengerOrderInterruptRequest('এই বীজ কীভাবে লাগাব'), true);
  assert.equal(isMessengerOrderInterruptRequest('human support chai'), true);
  assert.equal(isMessengerOrderInterruptRequest('হ্যালো'), true);
  assert.equal(isMessengerOrderInterruptRequest('hello'), true);
  assert.equal(isMessengerOrderInterruptRequest('আমি অন্য বেপারে জানতে চাই'), true);
  assert.equal(isMessengerOrderInterruptRequest('আমি অন্য বিষয়ে জানতে চাই'), true);
  assert.equal(isMessengerOrderInterruptRequest('I want to ask about something else'), true);
  assert.equal(isMessengerOrderInterruptRequest('ami onno bepare jante chai'), true);
  assert.equal(isMessengerOrderInterruptRequest('नमस्ते'), true);
  assert.equal(isMessengerOrderInterruptRequest('मुझे कुछ और पूछना है'), true);
  assert.equal(isMessengerOrderInterruptRequest('আগের অর্ডারটা চালিয়ে যেতে চাই'), false);
});

test('prefills repeat-customer checkout from a verified Messenger profile', () => {
  const pending = applyMessengerCustomerProfileToPending(
    {
      step: 'name',
      product_id: 'p1',
      product_name: 'Tomato',
      unit_price: 99,
      stock: 10,
      quantity: 2,
    },
    {
      name: 'Test Customer',
      phone: '01000000000',
      address: 'Saved address',
    },
  );

  assert.equal(pending.step, 'saved_details_confirmation');
  assert.equal(pending.customer_name, 'Test Customer');
  assert.equal(pending.customer_phone, '01000000000');
  assert.equal(pending.delivery_address, 'Saved address');

  const incomplete = applyMessengerCustomerProfileToPending(
    {
      step: 'name',
      product_id: 'p1',
      product_name: 'Tomato',
      unit_price: 99,
      stock: 10,
      quantity: 2,
    },
    { name: 'Test Customer', phone: null, address: 'Saved address' },
  );
  assert.equal(incomplete.step, 'name');
});

test('recognizes repeat-checkout detail changes', () => {
  assert.equal(isMessengerChangeDetailsRequest('তথ্য পরিবর্তন'), true);
  assert.equal(isMessengerChangeDetailsRequest('change my address'), true);
  assert.equal(isMessengerChangeDetailsRequest('hello'), false);
});

test('recognizes order resume phrases and never treats resume as interrupt', () => {
  assert.equal(isMessengerOrderResumeRequest('continue order'), true);
  assert.equal(isMessengerOrderResumeRequest('আগের অর্ডারটা চালিয়ে যেতে চাই'), true);
  assert.equal(isMessengerOrderInterruptRequest('আগের অর্ডারটা চালিয়ে যেতে চাই'), false);
});

test('recognizes deterministic Messenger payment status requests', () => {
  assert.equal(isMessengerPaymentStatusRequest('payment status'), true);
  assert.equal(isMessengerPaymentStatusRequest('payment check'), true);
  assert.equal(isMessengerPaymentStatusRequest('পেমেন্টের অবস্থা কী'), true);
  assert.equal(isMessengerPaymentStatusRequest('অগ্রিম payment status'), true);
  assert.equal(isMessengerPaymentStatusRequest('GS-IN-ABCDEFGH payment status'), true);
  assert.equal(isMessengerPaymentStatusRequest('delivery status'), false);
  assert.equal(isMessengerPaymentStatusRequest('order status'), false);
});

test('routes previous-order history away from tracking unless an order number is explicit', () => {
  assert.equal(isMessengerOrderHistoryRequest('আমার আগের অর্ডারগুলো দেখান'), true);
  assert.equal(isMessengerOrderTrackingRequest('আমার আগের অর্ডারগুলো দেখান'), false);
  assert.equal(isMessengerOrderTrackingRequest('track GS-BD-ABCDEFGH'), true);
});

test('routes Order Number + mobile-number linking into customer history instead of tracking', () => {
  const linkText = 'GS-BD-14B96466 01994098536';
  assert.equal(isMessengerOrderLinkRequest(linkText), true);
  assert.equal(isMessengerOrderTrackingRequest(linkText), false);
  assert.equal(isMessengerOrderTrackingRequest('track GS-BD-14B96466 01994098536'), true);
});

test('extracts Messenger contact numbers only from standalone numeric tokens', () => {
  const mobile = '0'.repeat(11);
  const linkText = 'GS-BD-AB12CD34 ' + mobile;

  assert.equal(extractMessengerPhone(linkText), mobile);
  assert.equal(extractMessengerPhone('prefix' + mobile), null);
  assert.equal(normalizeMessengerPhone('+880 0000 000000'), '8800000000000');
});

test('classifies delivery, support, and seed knowledge questions independently', () => {
  assert.equal(isMessengerDeliveryIntent('delivery time koto'), true);
  assert.equal(isMessengerHumanSupportIntent('talk to a person'), true);
  assert.equal(isMessengerSeedKnowledgeQuestion('লাউয়ের বীজ কীভাবে বপন করব'), true);
});


test('allows Messenger payment retry only for non-final payment states', () => {
  assert.equal(isMessengerPaymentRetryableStatus('created'), true);
  assert.equal(isMessengerPaymentRetryableStatus('pending'), true);
  assert.equal(isMessengerPaymentRetryableStatus('failed'), true);
  assert.equal(isMessengerPaymentRetryableStatus('expired'), true);
  assert.equal(isMessengerPaymentRetryableStatus('completed'), false);
  assert.equal(isMessengerPaymentRetryableStatus('processing'), false);
  assert.match(formatMessengerPaymentIntentStatus('failed'), /failed/);
});

test('classifies structured Messenger transactional risks safely', () => {
  assert.equal(
    classifyMessengerTransactionalReply('✅ আপনার অর্ডার তৈরি হয়েছে।'),
    'order_success',
  );
  assert.equal(
    classifyMessengerTransactionalReply('Your order has been processed successfully.'),
    'order_success',
  );
  assert.equal(
    classifyMessengerTransactionalReply('Your purchase is complete.'),
    'order_success',
  );
  assert.equal(
    classifyMessengerTransactionalReply('🔐 Pay ₹90 Now - payment button নিচে দেওয়া হলো।'),
    'payment_action',
  );
  assert.equal(
    classifyMessengerTransactionalReply('Please click the payment link to pay ₹90 now.'),
    'payment_action',
  );
  assert.equal(
    classifyMessengerTransactionalReply('Payment successful হয়েছে।'),
    'payment_success',
  );
  assert.equal(
    classifyMessengerTransactionalReply('Your transaction went through successfully.'),
    'payment_success',
  );
  assert.equal(
    classifyMessengerTransactionalReply('লেনদেন সফলভাবে সম্পন্ন হয়েছে।'),
    'payment_success',
  );

  assert.equal(
    classifyMessengerTransactionalReply('Bangladesh-এ Cash on Delivery (COD) payment গ্রহণ করি।'),
    null,
  );
  assert.equal(
    classifyMessengerTransactionalReply('অর্ডার করতে product-এর নাম লিখুন।'),
    null,
  );
  assert.equal(
    isUnsafeMessengerTransactionalReply('Payment successful হয়েছে।'),
    true,
  );
  assert.match(getMessengerTransactionalGuardReply(), /official order flow/);
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


test('recognizes Messenger back-in-stock notification requests safely', () => {
  assert.equal(isMessengerRestockNotificationRequest('notify me when rose seed is back in stock'), true);
  assert.equal(isMessengerRestockNotificationRequest('rose seed restock hole janaben'), true);
  assert.equal(isMessengerRestockNotificationRequest('গোলাপ ফুলের বীজ stock এলে জানাবেন'), true);
  assert.equal(isMessengerRestockNotificationRequest('stock koto ache'), false);
  assert.equal(isMessengerRestockNotificationRequest('what products do you have'), false);
});

test('recognizes Messenger recommendation requests without affecting ordinary product queries', () => {
  assert.equal(isMessengerRecommendationRequest('recommend some seeds for me'), true);
  assert.equal(isMessengerRecommendationRequest('what should i buy'), true);
  assert.equal(isMessengerRecommendationRequest('আমার জন্য কোনটা নেব'), true);
  assert.equal(isMessengerRecommendationRequest('product list'), false);
  assert.equal(isMessengerRecommendationRequest('ROSE SEED KINTE CHAIE'), false);
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

test('keeps pre-verification rate limiting in a neutral country state', () => {
  assert.equal(
    resolveMessengerRateLimitCountry({
      quickReplyCountry: null,
      detectedCountry: null,
      verifiedCountry: null,
    }),
    'UNKNOWN',
  );

  assert.equal(
    resolveMessengerRateLimitCountry({
      quickReplyCountry: null,
      detectedCountry: null,
      verifiedCountry: 'IN',
    }),
    'IN',
  );

  assert.equal(
    resolveMessengerRateLimitCountry({
      quickReplyCountry: 'BD',
      detectedCountry: 'IN',
      verifiedCountry: 'IN',
    }),
    'BD',
  );

  assert.equal(
    resolveMessengerRateLimitCountry({
      quickReplyCountry: null,
      detectedCountry: 'IN',
      verifiedCountry: null,
    }),
    'IN',
  );
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
