import assert from 'node:assert/strict';
import test from 'node:test';

import { isKnowledgeFallbackResponse } from '../lib/ai/messenger-knowledge-tool';

test('stock-out detector: a legitimate "not in stock" answer is never a fallback', () => {
  // Live-tested failure: the AI correctly replied "দুঃখিত, এই প্রোডাক্টটি
  // এই দেশে স্টকে নেই।" and the fallback detector ate it (it matches
  // "দুঃখিত.*নেই"), replacing it with the human-support contact reply.
  assert.equal(
    isKnowledgeFallbackResponse('দুঃখিত, এই প্রোডাক্টটি এই দেশে স্টকে নেই।'),
    false,
  );
  assert.equal(
    isKnowledgeFallbackResponse('দুঃখিত, এই মরিচের বীজ বাংলাদেশে স্টকে নেই।'),
    false,
  );
  assert.equal(
    isKnowledgeFallbackResponse('এই প্রোডাক্টটি এই দেশে স্টকে নেই।'),
    false,
  );
  assert.equal(isKnowledgeFallbackResponse('এই মুহূর্তে স্টক শেষ।'), false);
  assert.equal(isKnowledgeFallbackResponse('দুঃখিত, এই মুহূর্তে স্টক নেই।'), false);
  assert.equal(
    isKnowledgeFallbackResponse(
      'Sorry, this product is not in stock in this country.',
    ),
    false,
  );
  assert.equal(isKnowledgeFallbackResponse('Currently out of stock.'), false);
  assert.equal(isKnowledgeFallbackResponse('फिलहाल स्टॉक खत्म है।'), false);
  assert.equal(
    isKnowledgeFallbackResponse('यह उत्पाद स्टॉक में नहीं है।'),
    false,
  );
});

test('stock-out detector: stock-out wins even over a fallback-looking phrase', () => {
  // The stock-out early return runs first: a reply that states the
  // product is out of stock is a verified answer, even if it also
  // contains words the fallback regex would otherwise catch.
  assert.equal(
    isKnowledgeFallbackResponse(
      'দুঃখিত, এই প্রোডাক্টটি স্টকে নেই, তাই এ বিষয়ে আর তথ্য নেই।',
    ),
    false,
  );
  assert.equal(
    isKnowledgeFallbackResponse(
      "Sorry, this product is not in stock and I don't have more information.",
    ),
    false,
  );
});

test('stock-out detector: genuine fallbacks are still caught', () => {
  assert.equal(
    isKnowledgeFallbackResponse(
      'দুঃখিত, আমাদের কাছে থাকা তথ্য থেকে নিশ্চিত উত্তর পেলাম না',
    ),
    true,
  );
  assert.equal(
    isKnowledgeFallbackResponse("I don't have information on this product"),
    true,
  );
  assert.equal(
    isKnowledgeFallbackResponse('দুঃখিত, এই বিষয়ে তথ্য নেই।'),
    true,
  );
  assert.equal(
    isKnowledgeFallbackResponse('দুঃখিত, সুনির্দিষ্ট তথ্য নেই।'),
    true,
  );
  assert.equal(
    isKnowledgeFallbackResponse('I cannot verify this information.'),
    true,
  );
});

test('stock-out detector: mentioning stock is not enough to escape the fallback check', () => {
  // "no stock" is deliberately NOT a stock-out pattern: a reply that
  // says it has no stock information is a genuine fallback, not a
  // stock-out answer.
  assert.equal(
    isKnowledgeFallbackResponse(
      "Sorry, I don't have information about the stock of this product.",
    ),
    true,
  );
  assert.equal(
    isKnowledgeFallbackResponse('দুঃখিত, স্টক সম্পর্কে তথ্য নেই।'),
    true,
  );
});

test('stock-out detector: ordinary answers are not fallbacks', () => {
  assert.equal(
    isKnowledgeFallbackResponse(
      'হাইব্রিড মরিচ – রানি লঙ্কা\nদাম: ₹190 প্রতি প্যাকেট\nঅর্ডার করবেন?',
    ),
    false,
  );
  assert.equal(
    isKnowledgeFallbackResponse('Rani Lanka is available at ₹190 per packet.'),
    false,
  );
});
