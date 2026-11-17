import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMessengerAIProviderFallbackReply,
  formatMessengerCatalogReply,
  formatMessengerShortProductReply,
  scoreMessengerProductMatch,
} from '../lib/ai/messenger-product-tool';
import {
  isProductCatalogRequest,
  isProductListRequest,
} from '../lib/ai/messenger-intents';

// Serialized catalog rows, as the webhook's getProductContext returns them:
// search_match_type + search_match_score come from the search, the rest
// from the products table (effective_price is set by serialization).
function row(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    name_bn: null,
    name_en: null,
    slug: null,
    regular_price: null,
    sale_price: null,
    offer_price: null,
    price: null,
    effective_price: null,
    stock: 10,
    packet_weight: null,
    search_match_type: null,
    search_match_score: null,
    ...overrides,
  };
}

const RANI = {
  id: '11111111-1111-1111-1111-111111111111',
  name_bn: 'হাইব্রিড মরিচ – রানি লঙ্কা',
  name_en: 'Hybrid Chili – Rani Lanka',
  slug: 'hybrid-chili-rani-lanka',
  sale_price: 190,
  effective_price: 190,
};

const BANANA_LONG_CHILLI = {
  id: '22222222-2222-2222-2222-222222222222',
  name_bn: '১২ মাসের কলা লম্বা মরিচের বীজ',
  name_en: '12-Month Banana Long Chilli Seeds',
  slug: '12-month-banana-long-chilli-seeds',
  sale_price: 120,
  effective_price: 120,
};

const IMPORTED_LONG_RED_CHILI = {
  id: '33333333-3333-3333-3333-333333333333',
  name_bn: 'ইমপোর্টেড লম্বা লাল মরিচের বীজ',
  name_en: 'Imported Long Red Chili Seeds',
  slug: 'imported-long-red-chili-seeds',
  sale_price: 190,
  effective_price: 190,
};

const RED_ROSE = {
  id: '44444444-4444-4444-4444-444444444444',
  name_bn: 'লাল গোলাপ ফুলের বীজ',
  name_en: 'Red Rose Flower Seeds',
  slug: 'red-rose-flower-seeds',
  sale_price: 97,
  effective_price: 97,
  stock: 0,
};

test('live case: bare product name gets the short price reply when the AI fails', () => {
  // "রানি মরিচের বীজ" has no দাম/price/stock word, so the catalog branch
  // never runs for it — the query needs the AI call, and when all
  // providers fail the handler handed off instead of answering.
  assert.equal(isProductCatalogRequest('রানি মরিচের বীজ'), false);
  const match = scoreMessengerProductMatch('রানি মরিচের বীজ', RANI);
  assert.equal(match.type, 'strong');

  const products = [
    row({ ...RANI, search_match_type: match.type, search_match_score: match.score }),
  ];
  const fallback = buildMessengerAIProviderFallbackReply(
    'রানি মরিচের বীজ',
    products,
    'IN',
    'Bengali',
  );
  assert.ok(fallback);
  // Identical to what the normal catalog path would send.
  assert.equal(
    fallback.reply,
    formatMessengerCatalogReply('রানি মরিচের বীজ', products, 'IN', 'Bengali'),
  );
  assert.equal(
    fallback.reply,
    'হাইব্রিড মরিচ – রানি লঙ্কা\nদাম: ₹190 প্রতি প্যাকেট\nঅর্ডার করবেন?',
  );
  assert.equal(fallback.isSingleShortReply, true);
  assert.equal(fallback.selectedProduct?.name_en, 'Hybrid Chili – Rani Lanka');
  assert.deepEqual(fallback.numberedProductList, []);
});

test('fallback: single trusted sold-out product ends with the sold-out line', () => {
  const products = [
    row({ ...RED_ROSE, search_match_type: 'strong', search_match_score: 2 }),
  ];
  const fallback = buildMessengerAIProviderFallbackReply(
    'লাল গোলাপ ফুলের বীজ',
    products,
    'IN',
    'Bengali',
  );
  assert.ok(fallback);
  assert.equal(
    fallback.reply,
    formatMessengerCatalogReply('লাল গোলাপ ফুলের বীজ', products, 'IN', 'Bengali'),
  );
  assert.match(fallback.reply, /এই মুহূর্তে স্টক শেষ।/);
  assert.doesNotMatch(fallback.reply, /অর্ডার করবেন\?/);
  assert.equal(fallback.isSingleShortReply, true);
});

test('fallback: tied trusted products get the numbered list reply', () => {
  const products = [
    row({ ...RANI, search_match_type: 'strong', search_match_score: 2 }),
    row({ ...BANANA_LONG_CHILLI, search_match_type: 'strong', search_match_score: 2 }),
  ];
  const fallback = buildMessengerAIProviderFallbackReply(
    'মরিচের বীজ',
    products,
    'IN',
    'Bengali',
  );
  assert.ok(fallback);
  assert.equal(
    fallback.reply,
    formatMessengerCatalogReply('মরিচের বীজ', products, 'IN', 'Bengali'),
  );
  assert.match(fallback.reply, /১\. হাইব্রিড মরিচ – রানি লঙ্কা — ₹190/);
  assert.match(fallback.reply, /২\. ১২ মাসের কলা লম্বা মরিচের বীজ — ₹120/);
  assert.match(fallback.reply, /পণ্য বেছে নিতে নম্বর লিখুন।/);
  assert.equal(fallback.isSingleShortReply, false);
  assert.equal(fallback.selectedProduct, null);
  assert.equal(fallback.numberedProductList.length, 2);
  assert.equal(fallback.numberedProductList[0].id, RANI.id);
  assert.equal(fallback.numberedProductList[0].price, 190);
  assert.equal(fallback.numberedProductList[1].id, BANANA_LONG_CHILLI.id);
  assert.equal(fallback.numberedProductList[1].price, 120);
});

test('fallback: best-match wins the short reply when it strictly outscores', () => {
  const query = 'Imported long red chili seeds price?';
  const imported = scoreMessengerProductMatch(query, IMPORTED_LONG_RED_CHILI);
  const banana = scoreMessengerProductMatch(query, BANANA_LONG_CHILLI);
  assert.equal(imported.score, 4);
  assert.equal(banana.score, 2);

  const products = [
    row({
      ...IMPORTED_LONG_RED_CHILI,
      search_match_type: imported.type,
      search_match_score: imported.score,
    }),
    row({
      ...BANANA_LONG_CHILLI,
      search_match_type: banana.type,
      search_match_score: banana.score,
    }),
  ];
  const fallback = buildMessengerAIProviderFallbackReply(
    query,
    products,
    'IN',
    'English',
  );
  assert.ok(fallback);
  assert.equal(
    fallback.reply,
    formatMessengerCatalogReply(query, products, 'IN', 'English'),
  );
  assert.equal(
    fallback.reply,
    formatMessengerShortProductReply(
      products[0] as unknown as Parameters<typeof formatMessengerShortProductReply>[0],
      'IN',
      'English',
    ),
  );
  assert.match(fallback.reply, /Imported Long Red Chili Seeds/);
  assert.match(fallback.reply, /Price: ₹190 per packet/);
  assert.equal(fallback.isSingleShortReply, true);
  assert.equal(fallback.selectedProduct?.name_en, 'Imported Long Red Chili Seeds');
  assert.deepEqual(fallback.numberedProductList, []);
});

test('fallback: no trusted products returns null (handoff unchanged)', () => {
  assert.equal(
    buildMessengerAIProviderFallbackReply('Hi', [], 'IN', 'English'),
    null,
  );
  assert.equal(
    buildMessengerAIProviderFallbackReply(
      'মরিচের বীজ',
      [row({ ...RED_ROSE, search_match_type: 'similar', search_match_score: 1 })],
      'IN',
      'Bengali',
    ),
    null,
  );
});

test('fallback: similar rows never win over a trusted product', () => {
  const products = [
    row({ ...RED_ROSE, search_match_type: 'similar', search_match_score: 3 }),
    row({ ...RANI, search_match_type: 'strong', search_match_score: 2 }),
  ];
  const fallback = buildMessengerAIProviderFallbackReply(
    'রানি মরিচের বীজ',
    products,
    'IN',
    'Bengali',
  );
  assert.ok(fallback);
  assert.equal(fallback.isSingleShortReply, true);
  assert.equal(fallback.selectedProduct?.name_en, 'Hybrid Chili – Rani Lanka');
  assert.match(fallback.reply, /হাইব্রিড মরিচ – রানি লঙ্কা/);
  assert.match(fallback.reply, /দাম: ₹190 প্রতি প্যাকেট/);
});

test('fallback: English and Hindi replies follow the reply language', () => {
  const products = [
    row({ ...RANI, search_match_type: 'strong', search_match_score: 3 }),
  ];
  const english = buildMessengerAIProviderFallbackReply(
    'Rani Chili Seed',
    products,
    'IN',
    'English',
  );
  assert.ok(english);
  assert.equal(
    english.reply,
    'Hybrid Chili – Rani Lanka\nPrice: ₹190 per packet\nWould you like to order?',
  );

  const hindi = buildMessengerAIProviderFallbackReply(
    'Rani chili ka dam kya hai?',
    products,
    'IN',
    'Hindi',
  );
  assert.ok(hindi);
  assert.equal(
    hindi.reply,
    'Hybrid Chili – Rani Lanka\nकीमत: ₹190 प्रति पैकेट\nऑर्डर करना चाहेंगे?',
  );
});

test('fallback: explicit list request with one trusted product stays a list', () => {
  assert.equal(isProductListRequest('available products'), true);
  const products = [
    row({ ...RANI, search_match_type: 'strong', search_match_score: 3 }),
  ];
  const fallback = buildMessengerAIProviderFallbackReply(
    'available products',
    products,
    'IN',
    'English',
  );
  assert.ok(fallback);
  assert.equal(
    fallback.reply,
    formatMessengerCatalogReply('available products', products, 'IN', 'English'),
  );
  assert.match(fallback.reply, /1\. Hybrid Chili – Rani Lanka — ₹190/);
  assert.match(fallback.reply, /Reply with the product number to choose it\./);
  assert.equal(fallback.isSingleShortReply, false);
  assert.equal(fallback.selectedProduct, null);
  assert.equal(fallback.numberedProductList.length, 1);
  assert.equal(fallback.numberedProductList[0].id, RANI.id);
});

test('fallback: stock asked in the question is shown in the short reply', () => {
  const products = [
    row({ ...RANI, search_match_type: 'strong', search_match_score: 3 }),
  ];
  const fallback = buildMessengerAIProviderFallbackReply(
    'Rani Lanka stock e ache?',
    products,
    'IN',
    'Bengali',
  );
  assert.ok(fallback);
  assert.match(fallback.reply, /স্টক: 10 প্যাকেট/);
  assert.match(fallback.reply, /দাম: ₹190 প্রতি প্যাকেট/);
});
