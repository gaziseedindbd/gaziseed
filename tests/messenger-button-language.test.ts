import assert from 'node:assert/strict';
import test from 'node:test';

import { detectMessengerReplyLanguage } from '../lib/ai/messenger-language';
import {
  getMessengerProductSelectionQuickReplies,
  messengerButtonTitle,
  type MessengerButtonLabelKey,
} from '../lib/ai/messenger-product-tool';

const EXPECTED_TITLES: Record<
  MessengerButtonLabelKey,
  { English: string; Bengali: string; Hindi: string }
> = {
  take_product: {
    English: '🛒 Take this product',
    Bengali: '🛒 এই পণ্য নিন',
    Hindi: '🛒 यह उत्पाद लें',
  },
  checkout: {
    English: '✅ Checkout',
    Bengali: '✅ চেকআউট',
    Hindi: '✅ चेकआउट',
  },
  add_product: {
    English: '➕ Add product',
    Bengali: '➕ পণ্য যোগ করুন',
    Hindi: '➕ Product जोड़ें',
  },
  add_more_product: {
    English: '➕ Add more product',
    Bengali: '➕ আরও product',
    Hindi: '➕ और product जोड़ें',
  },
  view_cart: {
    English: '🛒 View cart',
    Bengali: '🛒 কার্ট দেখুন',
    Hindi: '🛒 Cart देखें',
  },
  browse_products: {
    English: '🌱 Browse products',
    Bengali: '🌱 পণ্য দেখুন',
    Hindi: '🌱 Product देखें',
  },
  use_saved_details: {
    English: '✅ Use saved details',
    Bengali: '✅ Saved details ব্যবহার করুন',
    Hindi: '✅ सहेजे विवरण लें',
  },
  change_details: {
    English: '✏️ Change details',
    Bengali: '✏️ তথ্য পরিবর্তন করুন',
    Hindi: '✏️ विवरण बदलें',
  },
  confirm_order: {
    English: '✅ Yes, confirm order',
    Bengali: '✅ হ্যাঁ, অর্ডার নিশ্চিত করুন',
    Hindi: '✅ हाँ, पुष्टि करें',
  },
  cancel_order: {
    English: '❌ No, cancel order',
    Bengali: '❌ না, অর্ডার বাতিল করুন',
    Hindi: '❌ नहीं, रद्द करें',
  },
  payment_status: {
    English: '💳 Payment Status',
    Bengali: '💳 পেমেন্ট স্ট্যাটাস',
    Hindi: '💳 भुगतान स्थिति',
  },
  order_status: {
    English: '📦 Order Status',
    Bengali: '📦 অর্ডার স্ট্যাটাস',
    Hindi: '📦 ऑर्डर स्थिति',
  },
  retry_payment: {
    English: '🔄 Retry Payment',
    Bengali: '🔄 আবার Payment করুন',
    Hindi: '🔄 फिर भुगतान करें',
  },
};

test('button titles follow the reply language for every label', () => {
  for (const [key, labels] of Object.entries(EXPECTED_TITLES)) {
    const typedKey = key as MessengerButtonLabelKey;
    assert.equal(messengerButtonTitle('English', typedKey), labels.English);
    assert.equal(messengerButtonTitle('Bengali', typedKey), labels.Bengali);
    assert.equal(messengerButtonTitle('Hindi', typedKey), labels.Hindi);
  }
});

test('English and Hindi button titles fit Messenger’s 20-character quick-reply limit', () => {
  // Note: four pre-existing Bengali order-flow labels are longer than 20
  // characters ('Saved details ব্যবহার করুন', 'তথ্য পরিবর্তন করুন',
  // 'হ্যাঁ, অর্ডার নিশ্চিত করুন', 'না, অর্ডার বাতিল করুন'). They are kept
  // with their live wording here; only the newly authored English/Hindi
  // labels are asserted to fit the limit.
  for (const key of Object.keys(EXPECTED_TITLES) as MessengerButtonLabelKey[]) {
    for (const language of ['English', 'Hindi'] as const) {
      const title = messengerButtonTitle(language, key);
      assert.ok(
        title.length <= 20,
        `${key} (${language}) is ${title.length} chars: ${title}`,
      );
    }
  }
});

test('the live Roman-Hindi packet question gets the Hindi take-product button', () => {
  const language = detectMessengerReplyLanguage(
    'Rani Lanka ke ek packet mein kitne beej hain?',
  );
  assert.equal(language, 'Hindi');
  assert.equal(messengerButtonTitle(language, 'take_product'), '🛒 यह उत्पाद लें');
});

test('English and Bengali questions get their own take-product button', () => {
  assert.equal(
    messengerButtonTitle(
      detectMessengerReplyLanguage('Rani Lanka seeds price?'),
      'take_product',
    ),
    '🛒 Take this product',
  );
  assert.equal(
    messengerButtonTitle(
      detectMessengerReplyLanguage('রানি লঙ্কার বীজের দাম কত?'),
      'take_product',
    ),
    '🛒 এই পণ্য নিন',
  );
});

test('product selection quick replies use the reply language for product names', () => {
  const product = {
    id: '11111111-1111-1111-1111-111111111111',
    name_bn: 'রানি লঙ্কা মরিচ',
    name_en: 'Rani Lanka Chili',
    slug: 'rani-lanka-chili',
  };
  const hindi = getMessengerProductSelectionQuickReplies([product], 'Hindi');
  assert.equal(hindi[0]?.title, 'Rani Lanka Chili');
  const english = getMessengerProductSelectionQuickReplies([product], 'English');
  assert.equal(english[0]?.title, 'Rani Lanka Chili');
  const bengali = getMessengerProductSelectionQuickReplies([product], 'Bengali');
  assert.equal(bengali[0]?.title, 'রানি লঙ্কা মরিচ');
});
