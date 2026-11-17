import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findMessengerBestMatchProduct,
  formatMessengerShortProductReply,
  scoreMessengerProductMatch,
} from '../lib/ai/messenger-product-tool';
import { isProductListRequest } from '../lib/ai/messenger-intents';

// Serialized catalog rows, as formatMessengerCatalogReply receives them:
// search_match_type + search_match_score come from the search, the rest
// from the products table.
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
    stock: 10,
    packet_weight: null,
    search_match_type: null,
    search_match_score: null,
    ...overrides,
  };
}

const IMPORTED_LONG_RED_CHILI = {
  name_bn: 'ইমপোর্টেড লম্বা লাল মরিচের বীজ',
  name_en: 'Imported Long Red Chili Seeds',
  slug: 'imported-long-red-chili-seeds',
};

const BANANA_LONG_CHILLI = {
  name_bn: '১২ মাসের কলা লম্বা মরিচের বীজ',
  name_en: '12-Month Banana Long Chilli Seeds',
  slug: '12-month-banana-long-chilli-seeds',
};

test('best-match wins: one named product outscores the other trusted match', () => {
  // Live-tested failure: "Imported long red chili seeds price?" got a
  // 2-product list instead of the short price reply for the one product
  // named, because both rows were trusted ("strong") and the short-reply
  // branch only fired for a single product.
  const query = 'Imported long red chili seeds price?';
  const imported = scoreMessengerProductMatch(query, IMPORTED_LONG_RED_CHILI);
  const banana = scoreMessengerProductMatch(query, BANANA_LONG_CHILLI);
  assert.equal(imported.type, 'strong');
  assert.equal(imported.score, 4);
  assert.equal(banana.type, 'strong');
  assert.equal(banana.score, 2);

  const products = [
    row({
      ...IMPORTED_LONG_RED_CHILI,
      sale_price: 190,
      search_match_type: imported.type,
      search_match_score: imported.score,
    }),
    row({
      ...BANANA_LONG_CHILLI,
      sale_price: 120,
      search_match_type: banana.type,
      search_match_score: banana.score,
    }),
  ];

  const best = findMessengerBestMatchProduct(products);
  assert.ok(best);
  assert.equal(best.name_en, 'Imported Long Red Chili Seeds');

  // The reply for that one product alone is the short 3-line price reply.
  const reply = formatMessengerShortProductReply(
    best as unknown as Parameters<typeof formatMessengerShortProductReply>[0],
    'IN',
    'English',
  );
  assert.equal(
    reply,
    'Imported Long Red Chili Seeds\nPrice: ₹190 per packet\nWould you like to order?',
  );
});

test('genuine tie at the top score keeps the list (no best match)', () => {
  // A generic "chili seeds" query matching several chilis equally is real
  // ambiguity — the customer should still see the list and choose.
  const products = [
    row({
      name_en: 'Imported Long Red Chili Seeds',
      search_match_type: 'strong',
      search_match_score: 2,
    }),
    row({
      name_en: '12-Month Banana Long Chilli Seeds',
      search_match_type: 'strong',
      search_match_score: 2,
    }),
  ];
  assert.equal(findMessengerBestMatchProduct(products), null);

  // A tie at the top with a lower third row is still a tie.
  const threeWay = [
    row({
      name_en: 'Imported Long Red Chili Seeds',
      search_match_type: 'strong',
      search_match_score: 3,
    }),
    row({
      name_en: '12-Month Banana Long Chilli Seeds',
      search_match_type: 'strong',
      search_match_score: 3,
    }),
    row({
      name_en: 'High-Yield Naga Bombay Chilli Seeds',
      search_match_type: 'strong',
      search_match_score: 2,
    }),
  ];
  assert.equal(findMessengerBestMatchProduct(threeWay), null);
});

test('single trusted product still answers alone (no regression)', () => {
  const products = [
    row({
      name_en: 'Hybrid Chili Pepper – Rani Lanka (Commercial Cultivation)',
      search_match_type: 'strong',
      search_match_score: 3,
    }),
  ];
  const best = findMessengerBestMatchProduct(products);
  assert.ok(best);
  assert.equal(
    best.name_en,
    'Hybrid Chili Pepper – Rani Lanka (Commercial Cultivation)',
  );
});

test('untrusted rows never win, and no trusted product means no best match', () => {
  // Similar rows carry unverified price/stock, even if one somehow has a
  // higher score than the trusted rows.
  const mixed = [
    row({
      name_en: 'Red Rose Flower Seeds',
      search_match_type: 'similar',
      search_match_score: 1,
    }),
    row({
      name_en: 'Imported Long Red Chili Seeds',
      search_match_type: 'strong',
      search_match_score: 2,
    }),
  ];
  const best = findMessengerBestMatchProduct(mixed);
  assert.ok(best);
  assert.equal(best.name_en, 'Imported Long Red Chili Seeds');

  assert.equal(
    findMessengerBestMatchProduct([
      row({
        name_en: 'Red Rose Flower Seeds',
        search_match_type: 'similar',
        search_match_score: 1,
      }),
    ]),
    null,
  );
  assert.equal(findMessengerBestMatchProduct([]), null);
});

test('explicit list request still lists (route gate, not the matcher)', () => {
  // The best-match rule only applies when the customer did NOT ask for a
  // list: formatMessengerCatalogReply keeps its !isProductListRequest
  // gate, so an explicit list request still gets the multi-product list.
  assert.equal(isProductListRequest('show all chili seeds'), true);
  assert.equal(isProductListRequest('Imported long red chili seeds price?'), false);
});
