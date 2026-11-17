import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION,
  appendGeneralAgricultureRewriteInstruction,
  hasUnsafeGeneralAgricultureSpecifics,
  shouldRewriteGeneralAgricultureReply,
} from '../lib/ai/messenger-general-advice-guard';
import type { AIChatMessage } from '../lib/ai/types';

test('ordinary how-to numbers in general advice are not unsafe specifics', () => {
  // The live failure: "মরিচের বীজ কীভাবে লাগাবো?" was refused because
  // any number near a farming word was treated as an unsafe prescription.
  // Soaking hours, sowing depth, spacing and watering numbers are normal
  // how-to guidance and must reach the customer.
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'বীজ ৬-৮ ঘণ্টা ভিজিয়ে রাখুন, ১ সেমি গভীরে বপন করুন, গাছের দূরত্ব ৪৫ সেমি রাখুন',
    ),
    false,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'মরিচের বীজ ৬-৮ ঘণ্টা ভিজিয়ে রাখুন, ১ সেমি গভীরে বপন করুন, মাটি ভেজা রাখুন',
    ),
    false,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'বীজ হালকা ভিজিয়ে নিন, অগভীরভাবে বপন করুন, মাটি সমানভাবে ভেজা রাখুন',
    ),
    false,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'চারা গজাতে ৭-১০ দিন লাগে, প্রতিদিন পানি দিন',
    ),
    false,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'Soak the seeds for 6-8 hours, sow 1 cm deep, keep 45 cm between plants and water daily',
    ),
    false,
  );
});

test('safe preventive wording with nearby numbers is not a diagnosis', () => {
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'রোগমুক্ত বীজ ব্যবহার করুন, ৭ দিনে চারা গজায়',
    ),
    false,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'পোকা এড়াতে গাছের চারপাশ পরিষ্কার রাখুন, পচা পাতা সরিয়ে ফেলুন',
    ),
    false,
  );
});

test('fertilizer and pesticide dosages are still unsafe specifics', () => {
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'ইউরিয়া ৫০ গ্রাম প্রতি লিটার পানিতে মিশিয়ে স্প্রে করুন',
    ),
    true,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'Urea 50 grams per litre of water, spray on the plants',
    ),
    true,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'সার ২ কেজি প্রতি গাছে প্রয়োগ করুন',
    ),
    true,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics('কার্বেনডাজিম দিন'),
    true,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      '৫০ গ্রাম প্রতি লিটার দ্রবণ মিশিয়ে দিন',
    ),
    true,
  );
});

test('disease and pest diagnoses with treatment are still unsafe specifics', () => {
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'পাতায় ছত্রাকের দাগ দেখা গেলে কার্বেনডাজিম ২ গ্রাম প্রতি লিটার পানিতে মিশিয়ে ৭ দিন অন্তর স্প্রে করুন',
    ),
    true,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics('এফিড লাগলে নিম তেল স্প্রে করুন'),
    true,
  );
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'পাতায় দাগ দেখা দিলে আক্রান্ত পাতা ছিঁড়ে ফেলুন',
    ),
    true,
  );
});

test('the rewrite decision only fires for flagged general-agriculture replies', () => {
  const dosageReply =
    'ইউরিয়া ৫০ গ্রাম প্রতি লিটার পানিতে মিশিয়ে স্প্রে করুন';
  const cleanReply =
    'বীজ ৬-৮ ঘণ্টা ভিজিয়ে রাখুন, ১ সেমি গভীরে বপন করুন';

  assert.equal(
    shouldRewriteGeneralAgricultureReply(true, dosageReply),
    true,
  );
  assert.equal(
    shouldRewriteGeneralAgricultureReply(true, cleanReply),
    false,
  );
  // Non-agriculture messages keep today's refusal behaviour unchanged.
  assert.equal(
    shouldRewriteGeneralAgricultureReply(false, dosageReply),
    false,
  );
});

test('the rewrite retry asks for a short answer without any specifics', () => {
  const chatMessages: AIChatMessage[] = [
    { role: 'system', content: 'You are GAZI SEED customer support AI.' },
    { role: 'user', content: 'মরিচের বীজ কীভাবে লাগাবো?' },
  ];

  const retryMessages =
    appendGeneralAgricultureRewriteInstruction(chatMessages);

  assert.equal(retryMessages.length, 3);
  assert.deepEqual(retryMessages.slice(0, 2), chatMessages);
  assert.equal(retryMessages[2].role, 'user');
  assert.equal(
    retryMessages[2].content,
    MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION,
  );
  assert.match(
    MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION,
    /3-4 short lines/,
  );
  assert.match(
    MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION,
    /numbers/,
  );
  assert.match(
    MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION,
    /chemical names/,
  );
  assert.match(
    MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION,
    /treatment schedules/,
  );

  // A clean rewrite passes the filter, so it would be used instead of the
  // human-support refusal.
  assert.equal(
    hasUnsafeGeneralAgricultureSpecifics(
      'বীজ হালকা ভিজিয়ে নিন, অগভীরভাবে বপন করুন, মাটি সমানভাবে ভেজা রাখুন',
    ),
    false,
  );
});
