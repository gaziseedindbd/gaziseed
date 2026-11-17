import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasMessengerGenericProductWord,
  isMessengerBareProductNameQuery,
  shouldAnswerMessengerBareNameDeterministically,
} from '../lib/ai/messenger-knowledge-tool';
import { isProductCatalogRequest } from '../lib/ai/messenger-intents';
import {
  buildMessengerProductListSnapshot,
  findMessengerBestMatchProduct,
  formatMessengerCatalogReply,
  scoreMessengerProductMatch,
} from '../lib/ai/messenger-product-tool';

// Serialized catalog rows, as formatMessengerCatalogReply receives them:
// search_match_type + search_match_score come from the search, the rest
// from the products table. Serialized rows carry effective_price, which
// the numbered list lines read directly.
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
  name_bn: 'হাইব্রিড মরিচ – রানি লঙ্কা',
  name_en: 'Hybrid Chili – Rani Lanka',
  slug: 'hybrid-chili-rani-lanka',
};

const BANANA = {
  name_bn: '১২ মাসের কলা লম্বা মরিচের বীজ',
  name_en: '12-Month Banana Long Chilli Seeds',
  slug: '12-month-banana-long-chilli-seeds',
};

const NAGA = {
  name_bn: 'উচ্চ ফলনশীল নাগা বোম্বাই মরিচের বীজ',
  name_en: 'High-Yield Naga Bombay Chilli Seeds',
  slug: 'high-yield-naga-bombay-chilli-seeds',
};

const IMPORTED = {
  name_bn: 'ইমপোর্টেড লম্বা লাল মরিচের বীজ',
  name_en: 'Imported Long Red Chili Seeds',
  slug: 'imported-long-red-chili-seeds',
};

const FIVE_COLOR = {
  name_bn: 'এক গাছেই ৫ রঙের মরিচের বীজ',
  name_en: 'Five-Color Chili Seeds',
  slug: 'five-color-chili-seeds',
};

const RED_ROSE = {
  name_bn: 'লাল গোলাপ',
  name_en: 'Red Rose',
  slug: 'red-rose',
};

// A scored row: the match type/score come from the real scorer, exactly
// as the search RPC path re-ranks rows before the catalog branch sees them.
function scoredRow(
  query: string,
  product: { name_bn: string; name_en: string; slug: string },
  price: number,
  stock = 10,
): Record<string, unknown> {
  const scored = scoreMessengerProductMatch(query, product);
  return row({
    ...product,
    sale_price: price,
    effective_price: price,
    stock,
    search_match_type: scored.type,
    search_match_score: scored.score,
  });
}

test('bare product names are recognized by the guard', () => {
  // Live failure: "রানি মরিচের বীজ" has no price/stock word, so it is not
  // a catalog request — yet it names one product and asks nothing.
  for (const query of [
    'রানি মরিচের বীজ',
    'মরিচের বীজ',
    'Rani Lanka',
    'Rani Chili Seed',
    'লাল গোলাপ',
    'Red Rose',
  ]) {
    assert.equal(isMessengerBareProductNameQuery(query), true, query);
    assert.equal(isProductCatalogRequest(query), false, query);
  }
});

test('question-shaped messages are not bare names', () => {
  // A germination question must keep its existing FAQ/knowledge routing.
  assert.equal(
    isMessengerBareProductNameQuery('লাল গোলাপের বীজ থেকে চারা হতে কতদিন লাগে?'),
    false,
  );
  // Price questions are already catalog requests, not bare names.
  for (const query of [
    'Rani Chili Seed price?',
    'Golap er bij koto dam?',
    'Rani Lanka er beej koto dam?',
  ]) {
    assert.equal(isMessengerBareProductNameQuery(query), false, query);
    assert.equal(isProductCatalogRequest(query), true, query);
  }
});

test('cultivation questions rely on the route-level general-advice exclusion', () => {
  // The guard alone does NOT reject "মরিচের বীজ কীভাবে লাগাবো?" — "কীভাবে"
  // (one word) is not a guard question word and "লাগাবো" is not "লাগে".
  // That message stays out of the deterministic catalog path only because
  // the route keeps the !isGeneralSeedAdviceRequest exclusion in the
  // catalog-branch condition. Do not drop that exclusion.
  assert.equal(isMessengerBareProductNameQuery('মরিচের বীজ কীভাবে লাগাবো?'), true);
});

test('greetings are bare names by the guard, so the gate must keep them out', () => {
  // "Hi" / "ধন্যবাদ" ask nothing, so the guard calls them bare names —
  // but they name no product, so the deterministic gate (no local
  // products, no generic product word, nothing in the other country) must
  // return false and leave them to the AI greeting.
  for (const query of ['Hi', 'ধন্যবাদ']) {
    assert.equal(isMessengerBareProductNameQuery(query), true, query);
    assert.equal(
      shouldAnswerMessengerBareNameDeterministically({
        isBareProductName: isMessengerBareProductNameQuery(query),
        hasLocalProducts: false,
        hasGenericProductWord: hasMessengerGenericProductWord(query),
        existsInOtherCountry: false,
      }),
      false,
      query,
    );
  }
});

test('generic product word detection', () => {
  for (const query of [
    'রানি মরিচের বীজ',
    'Rani Chili Seed',
    'ম্যাংগো টমেটোর বীজ',
    'Rani Lanka beej',
  ]) {
    assert.equal(hasMessengerGenericProductWord(query), true, query);
  }
  for (const query of ['Rani Lanka', 'Hi', 'ধন্যবাদ', 'লাল গোলাপ']) {
    assert.equal(hasMessengerGenericProductWord(query), false, query);
  }
});

test('deterministic-answer decision matrix', () => {
  const decide = shouldAnswerMessengerBareNameDeterministically;
  // A bare name with a local match, a generic product word, or a product
  // in the other country is a product mention: answer deterministically.
  assert.equal(
    decide({ isBareProductName: true, hasLocalProducts: true, hasGenericProductWord: false, existsInOtherCountry: false }),
    true,
  );
  assert.equal(
    decide({ isBareProductName: true, hasLocalProducts: false, hasGenericProductWord: true, existsInOtherCountry: false }),
    true,
  );
  assert.equal(
    decide({ isBareProductName: true, hasLocalProducts: false, hasGenericProductWord: false, existsInOtherCountry: true }),
    true,
  );
  // A bare name with none of those is not a product at all.
  assert.equal(
    decide({ isBareProductName: true, hasLocalProducts: false, hasGenericProductWord: false, existsInOtherCountry: false }),
    false,
  );
  // A question is never routed by the bare-name decision, whatever matches.
  assert.equal(
    decide({ isBareProductName: false, hasLocalProducts: true, hasGenericProductWord: true, existsInOtherCountry: true }),
    false,
  );
});

test('bare Rani name in India gets the short price reply', () => {
  const query = 'রানি মরিচের বীজ';
  const products = [
    scoredRow(query, RANI, 190),
    scoredRow(query, BANANA, 120),
    scoredRow(query, NAGA, 180),
  ];
  // Rani overlaps 2 distinctive tokens, the others only 1: best-match wins.
  const best = findMessengerBestMatchProduct(products);
  assert.ok(best);
  assert.equal(best.name_en, 'Hybrid Chili – Rani Lanka');

  assert.equal(
    formatMessengerCatalogReply(query, products, 'IN'),
    'হাইব্রিড মরিচ – রানি লঙ্কা\nদাম: ₹190 প্রতি প্যাকেট\nঅর্ডার করবেন?',
  );
});

test('generic bare chili name gets the numbered list', () => {
  // Live case: "মরিচের বীজ" returned the numbered chili list. Every chili
  // overlaps the single distinctive token equally, so there is no strict
  // best match and the list is kept.
  const query = 'মরিচের বীজ';
  const products = [
    scoredRow(query, RANI, 190),
    scoredRow(query, BANANA, 120),
    scoredRow(query, NAGA, 180),
    scoredRow(query, IMPORTED, 190),
    scoredRow(query, FIVE_COLOR, 45),
  ];
  assert.equal(findMessengerBestMatchProduct(products), null);
  assert.equal(buildMessengerProductListSnapshot(products).length, 5);

  assert.equal(
    formatMessengerCatalogReply(query, products, 'IN'),
    '🌱 GAZI SEED-এর matching products:\n' +
      '\n' +
      '১. হাইব্রিড মরিচ – রানি লঙ্কা — ₹190\n' +
      '২. ১২ মাসের কলা লম্বা মরিচের বীজ — ₹120\n' +
      '৩. উচ্চ ফলনশীল নাগা বোম্বাই মরিচের বীজ — ₹180\n' +
      '৪. ইমপোর্টেড লম্বা লাল মরিচের বীজ — ₹190\n' +
      '৫. এক গাছেই ৫ রঙের মরিচের বীজ — ₹45\n' +
      '\n' +
      'পণ্য বেছে নিতে নম্বর লিখুন।',
  );
});

test('bare name with no trusted product in the country gets not in stock', () => {
  // The catalog formatter's empty-products branch is the deterministic
  // answer for a bare name whose product is absent here (or only in the
  // other country): the route passes an empty list when the bare-name arm
  // found no trusted match.
  assert.equal(
    formatMessengerCatalogReply('রানি মরিচের বীজ', [], 'BD'),
    'দুঃখিত, এই প্রোডাক্টটি এই দেশে স্টকে নেই।',
  );
  assert.equal(
    formatMessengerCatalogReply('Mango Tomato', [], 'IN', 'English'),
    'Sorry, this product is not in stock in this country.',
  );
});

test('bare name of a sold-out product ends with the sold-out line', () => {
  const query = 'লাল গোলাপ';
  const products = [scoredRow(query, RED_ROSE, 97, 0)];
  const best = findMessengerBestMatchProduct(products);
  assert.ok(best);
  assert.equal(best.name_en, 'Red Rose');

  const reply = formatMessengerCatalogReply(query, products, 'IN');
  assert.equal(
    reply,
    'লাল গোলাপ\nদাম: ₹97 প্রতি প্যাকেট\nএই মুহূর্তে স্টক শেষ।',
  );
  assert.ok(!reply.includes('অর্ডার করবেন?'));
});

test('English bare name gets the English short price reply', () => {
  const query = 'Rani Lanka';
  const products = [scoredRow(query, RANI, 190)];
  assert.ok(findMessengerBestMatchProduct(products));

  assert.equal(
    formatMessengerCatalogReply(query, products, 'IN'),
    'Hybrid Chili – Rani Lanka\nPrice: ₹190 per packet\nWould you like to order?',
  );
});
