import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMessengerShortProductReply } from '../lib/ai/messenger-product-tool';

const soldOutRose = {
  name_bn: 'লাল গোলাপ ফুলের বীজ',
  name_en: 'Red Rose Flower Seeds',
  slug: 'red-rose-flower-seeds',
  regular_price: 120,
  sale_price: 97,
  offer_price: null,
  price: null,
  stock: 0,
  packet_weight: null,
};

const inStockRose = { ...soldOutRose, stock: 12 };

const unknownStockRose = { ...soldOutRose, stock: null };

test('sold-out product with stock asked shows stock 0 and a sold-out line, never the order question', () => {
  const bengali = formatMessengerShortProductReply(soldOutRose, 'IN', 'Bengali', {
    stock: true,
  });
  assert.match(bengali, /দাম: ₹97 প্রতি প্যাকেট/);
  assert.match(bengali, /স্টক: 0 প্যাকেট/);
  assert.match(bengali, /এই মুহূর্তে স্টক শেষ।/);
  assert.doesNotMatch(bengali, /অর্ডার করবেন\?/);

  const english = formatMessengerShortProductReply(soldOutRose, 'IN', 'English', {
    stock: true,
  });
  assert.match(english, /Price: ₹97 per packet/);
  assert.match(english, /Stock: 0 packets/);
  assert.match(english, /Currently out of stock\./);
  assert.doesNotMatch(english, /Would you like to order\?/);

  const hindi = formatMessengerShortProductReply(soldOutRose, 'IN', 'Hindi', {
    stock: true,
  });
  assert.match(hindi, /कीमत: ₹97 प्रति पैकेट/);
  assert.match(hindi, /स्टॉक: 0 पैकेट/);
  assert.match(hindi, /फिलहाल स्टॉक खत्म है।/);
  assert.doesNotMatch(hindi, /ऑर्डर करना चाहेंगे\?/);
});

test('sold-out product with stock not asked shows price and sold-out line, no stock line, no order question', () => {
  const bengali = formatMessengerShortProductReply(soldOutRose, 'IN', 'Bengali');
  assert.match(bengali, /দাম: ₹97 প্রতি প্যাকেট/);
  assert.match(bengali, /এই মুহূর্তে স্টক শেষ।/);
  assert.doesNotMatch(bengali, /স্টক: 0 প্যাকেট/);
  assert.doesNotMatch(bengali, /অর্ডার করবেন\?/);

  const english = formatMessengerShortProductReply(soldOutRose, 'IN', 'English');
  assert.match(english, /Currently out of stock\./);
  assert.doesNotMatch(english, /Stock: 0 packets/);
  assert.doesNotMatch(english, /Would you like to order\?/);
});

test('in-stock product still ends with the order question', () => {
  const bengali = formatMessengerShortProductReply(inStockRose, 'IN', 'Bengali', {
    stock: true,
  });
  assert.match(bengali, /স্টক: 12 প্যাকেট/);
  assert.match(bengali, /অর্ডার করবেন\?/);
  assert.doesNotMatch(bengali, /স্টক শেষ/);

  const english = formatMessengerShortProductReply(inStockRose, 'IN', 'English');
  assert.match(english, /Would you like to order\?/);
  assert.doesNotMatch(english, /out of stock/);
});

test('product with unknown stock still ends with the order question', () => {
  const bengali = formatMessengerShortProductReply(unknownStockRose, 'IN', 'Bengali');
  assert.match(bengali, /অর্ডার করবেন\?/);
  assert.doesNotMatch(bengali, /স্টক শেষ/);

  const english = formatMessengerShortProductReply(unknownStockRose, 'IN', 'English');
  assert.match(english, /Would you like to order\?/);
  assert.doesNotMatch(english, /out of stock/);
});
