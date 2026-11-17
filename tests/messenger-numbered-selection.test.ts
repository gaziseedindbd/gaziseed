import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMessengerProductListSnapshot,
  formatMessengerListNumeral,
  formatMessengerNumberedListLine,
  formatMessengerProductSelectionReply,
  formatMessengerShortProductReply,
  messengerNumberedListInstruction,
  parseMessengerProductNumberSelection,
  parseMessengerProductNumberSelections,
  parseMessengerStoredProductList,
  type MessengerListedProduct,
} from '../lib/ai/messenger-product-tool';

// Fixture products shaped like serialized DB rows (effective_price is what
// the catalog list shows; search_match_type decides selectability).
const chiliRows = [
  {
    id: 'p-rani',
    name_bn: 'হাইব্রিড মরিচ – রানি লঙ্কা',
    name_en: 'Hybrid Chili Pepper – Rani Lanka (Commercial Cultivation)',
    slug: 'hybrid-chili-rani-lanka',
    effective_price: 190,
    stock: 12,
    search_match_type: 'strong',
    search_match_score: 2,
  },
  {
    id: 'p-banana',
    name_bn: '১২ মাসি বানানা লম্বা মরিচের বীজ',
    name_en: '12-Month Banana Long Chilli Seeds',
    slug: 'banana-long-chilli-seeds',
    effective_price: 120,
    stock: 8,
    search_match_type: 'strong',
    search_match_score: 2,
  },
  {
    id: 'p-naga',
    name_bn: 'নাগা বোম্বাই মরিচের বীজ',
    name_en: 'High-Yield Naga Bombay Chilli Seeds',
    slug: 'naga-bombay-chilli-seeds',
    effective_price: 180,
    stock: 5,
    search_match_type: 'strong',
    search_match_score: 2,
  },
  {
    id: 'p-rose',
    name_bn: 'লাল গোলাপ ফুলের বীজ',
    name_en: 'Red Rose Flower Seeds',
    slug: 'red-rose-flower-seeds',
    effective_price: 97,
    stock: 0,
    // Similar-only rows are shown as discovery hints, never numbered.
    search_match_type: 'similar',
    search_match_score: 1,
  },
];

const storedList: MessengerListedProduct[] = buildMessengerProductListSnapshot(chiliRows);

test('numbered list snapshot keeps the shown trusted products in order', () => {
  assert.deepEqual(
    storedList.map((item) => item.id),
    ['p-rani', 'p-banana', 'p-naga'],
  );
  assert.equal(storedList[0].price, 190);
  assert.equal(storedList[0].stock, 12);
  assert.equal(storedList[0].name_en, 'Hybrid Chili Pepper – Rani Lanka (Commercial Cultivation)');
});

test('list numerals use Bengali digits for Bengali and Latin digits otherwise', () => {
  assert.equal(formatMessengerListNumeral(1, 'Bengali'), '১');
  assert.equal(formatMessengerListNumeral(2, 'Bengali'), '২');
  assert.equal(formatMessengerListNumeral(12, 'Bengali'), '১২');
  assert.equal(formatMessengerListNumeral(1, 'English'), '1');
  assert.equal(formatMessengerListNumeral(2, 'Hindi'), '2');
});

test('numbered list lines show numeral, name and price in each language', () => {
  const item = storedList[0];
  assert.equal(
    formatMessengerNumberedListLine(item, 0, 'IN', 'Bengali'),
    '১. হাইব্রিড মরিচ – রানি লঙ্কা — ₹190',
  );
  assert.equal(
    formatMessengerNumberedListLine(item, 0, 'IN', 'English'),
    '1. Hybrid Chili Pepper – Rani Lanka (Commercial Cultivation) — ₹190',
  );
  assert.equal(
    formatMessengerNumberedListLine(item, 1, 'IN', 'Hindi'),
    '2. Hybrid Chili Pepper – Rani Lanka (Commercial Cultivation) — ₹190',
  );
  const bangladeshItem: MessengerListedProduct = { ...item, price: 240 };
  assert.equal(
    formatMessengerNumberedListLine(bangladeshItem, 0, 'BD', 'Bengali'),
    '১. হাইব্রিড মরিচ – রানি লঙ্কা — ৳240',
  );
});

test('numbered list instruction is localized in all three languages', () => {
  assert.equal(
    messengerNumberedListInstruction('English'),
    'Reply with the product number to choose it.',
  );
  assert.equal(messengerNumberedListInstruction('Bengali'), 'পণ্য বেছে নিতে নম্বর লিখুন।');
  assert.equal(messengerNumberedListInstruction('Hindi'), 'उत्पाद चुनने के लिए नंबर लिखें।');
});

test('bare Latin number selects the right product', () => {
  assert.equal(parseMessengerProductNumberSelection('2'), 2);
  assert.equal(parseMessengerProductNumberSelection(' 2 '), 2);
  assert.equal(parseMessengerProductNumberSelections('2')?.join(','), '2');
  assert.equal(storedList[parseMessengerProductNumberSelection('2')! - 1].id, 'p-banana');
});

test('bare Bengali digit selects the right product', () => {
  assert.equal(parseMessengerProductNumberSelection('২'), 2);
  assert.equal(parseMessengerProductNumberSelection('৩'), 3);
  assert.equal(parseMessengerProductNumberSelections('২')?.join(','), '2');
  assert.equal(storedList[parseMessengerProductNumberSelection('৩')! - 1].id, 'p-naga');
});

test('multi-select parses comma-separated Latin and Bengali numbers', () => {
  assert.deepEqual(parseMessengerProductNumberSelections('1, 3'), [1, 3]);
  assert.deepEqual(parseMessengerProductNumberSelections('1,3'), [1, 3]);
  assert.deepEqual(parseMessengerProductNumberSelections('১, ৩'), [1, 3]);
  assert.deepEqual(parseMessengerProductNumberSelections('১,৩'), [1, 3]);
  assert.deepEqual(parseMessengerProductNumberSelections('2, 1'), [2, 1]);
  // Duplicates collapse to one selection per product.
  assert.deepEqual(parseMessengerProductNumberSelections('1, 1, 2'), [1, 2]);
});

test('multi-select with an out-of-range number is not a selection at all', () => {
  const selections = parseMessengerProductNumberSelections('1, 9');
  assert.deepEqual(selections, [1, 9]);
  // The route only selects when EVERY number is in range of the stored list.
  const inRange =
    selections !== null && selections.every((n) => n >= 1 && n <= storedList.length);
  assert.equal(inRange, false);
});

test('trailing comma, empty part or mixed valid/invalid is not a selection', () => {
  assert.equal(parseMessengerProductNumberSelections('1,'), null);
  assert.equal(parseMessengerProductNumberSelections('1, '), null);
  assert.equal(parseMessengerProductNumberSelections(', 2'), null);
  assert.equal(parseMessengerProductNumberSelections('1, abc'), null);
  assert.equal(parseMessengerProductNumberSelections('1, 2 packet'), null);
  assert.equal(parseMessengerProductNumberSelections(''), null);
  assert.equal(parseMessengerProductNumberSelections('   '), null);
});

test('out-of-range number and missing list mean no selection', () => {
  assert.equal(parseMessengerProductNumberSelection('9'), 9);
  const inRange = 9 >= 1 && 9 <= storedList.length;
  assert.equal(inRange, false);
  assert.equal(parseMessengerStoredProductList(null), null);
  assert.equal(parseMessengerStoredProductList(undefined), null);
  assert.equal(parseMessengerStoredProductList([]), null);
  assert.equal(parseMessengerStoredProductList('not a list'), null);
  assert.equal(parseMessengerStoredProductList([{ name: 'no id' }]), null);
});

test('stored list round-trips through metadata validation', () => {
  const parsed = parseMessengerStoredProductList(JSON.parse(JSON.stringify(storedList)));
  assert.deepEqual(parsed, storedList);
});

test('quantity messages are not selections', () => {
  assert.equal(parseMessengerProductNumberSelection('2 packet'), null);
  assert.equal(parseMessengerProductNumberSelections('2 packet'), null);
  assert.equal(parseMessengerProductNumberSelection('মরিচ 3টা'), null);
  assert.equal(parseMessengerProductNumberSelections('মরিচ 3টা'), null);
  assert.equal(parseMessengerProductNumberSelection('3টা'), null);
  assert.equal(parseMessengerProductNumberSelection('2 ta lagbe'), null);
  assert.equal(parseMessengerProductNumberSelection('1 2'), null);
  assert.equal(parseMessengerProductNumberSelection('0'), null);
});

test('single selection reply is the exact short price reply', () => {
  const reply = formatMessengerProductSelectionReply([storedList[0]], 'IN', 'Bengali');
  assert.equal(
    reply,
    formatMessengerShortProductReply(
      storedList[0] as unknown as Parameters<typeof formatMessengerShortProductReply>[0],
      'IN',
      'Bengali',
      { stock: false, weight: false },
    ),
  );
  assert.equal(
    reply,
    'হাইব্রিড মরিচ – রানি লঙ্কা\nদাম: ₹190 প্রতি প্যাকেট\nঅর্ডার করবেন?',
  );
});

test('multi-selection reply is one short line per product plus the order question', () => {
  const reply = formatMessengerProductSelectionReply(
    [storedList[0], storedList[2]],
    'IN',
    'Bengali',
  );
  assert.equal(
    reply,
    '১. হাইব্রিড মরিচ – রানি লঙ্কা — ₹190\n' +
      '২. নাগা বোম্বাই মরিচের বীজ — ₹180\n' +
      'অর্ডার করবেন?',
  );
  const englishReply = formatMessengerProductSelectionReply(
    [storedList[1], storedList[0]],
    'IN',
    'English',
  );
  assert.equal(
    englishReply,
    '1. 12-Month Banana Long Chilli Seeds — ₹120\n' +
      '2. Hybrid Chili Pepper – Rani Lanka (Commercial Cultivation) — ₹190\n' +
      'Would you like to order?',
  );
});
