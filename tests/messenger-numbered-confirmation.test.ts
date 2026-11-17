import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  formatMessengerOptionNumeral,
  formatMessengerSavedDetailsOptions,
  getMessengerOrderResumeReply,
  getMessengerSavedDetailsReply,
  handleMessengerOrderFlow,
  parseMessengerSavedDetailsNumberSelection,
  type PendingMessengerOrder,
} from '../lib/ai/messenger-order-tool';

// The order-flow paths under test never touch Supabase (no product search,
// no DB writes): the pending-step dispatch is pure, and a bare "1" with no
// pending order returns unhandled before any lookup.
const stubSupabase = undefined as unknown as SupabaseClient;

const savedDetailsPending: PendingMessengerOrder = {
  step: 'saved_details_confirmation',
  product_id: 'p-rani',
  product_name: 'হাইব্রিড মরিচ – রানি লঙ্কা',
  unit_price: 190,
  stock: 12,
  quantity: 2,
  customer_name: 'Test Customer',
  customer_phone: '6002786881',
  delivery_address: 'Test address, Kolkata',
};

const quantityPending: PendingMessengerOrder = {
  step: 'quantity',
  product_id: 'p-rani',
  product_name: 'হাইব্রিড মরিচ – রানি লঙ্কা',
  unit_price: 190,
  stock: 12,
};

type OrderFlowResult = Awaited<ReturnType<typeof handleMessengerOrderFlow>>;

function expectHandled(result: OrderFlowResult) {
  assert.equal(result.handled, true);
  if (!('pending' in result) || !('reply' in result)) {
    throw new Error('expected a handled order-flow result with reply and pending');
  }
  return result;
}

async function runOrderFlow(text: string, pending: PendingMessengerOrder | null) {
  return handleMessengerOrderFlow({
    supabase: stubSupabase,
    country: 'IN',
    text,
    metadata: pending ? { pending_messenger_order: pending } : {},
  });
}

test('numbered option numerals use Bengali digits for Bengali, Latin otherwise', () => {
  assert.equal(formatMessengerOptionNumeral(1, 'Bengali'), '১');
  assert.equal(formatMessengerOptionNumeral(2, 'Bengali'), '২');
  assert.equal(formatMessengerOptionNumeral(1, 'English'), '1');
  assert.equal(formatMessengerOptionNumeral(2, 'English'), '2');
  assert.equal(formatMessengerOptionNumeral(1, 'Hindi'), '1');
  assert.equal(formatMessengerOptionNumeral(2, 'Hindi'), '2');
});

test('saved-details options are two numbered lines with full untruncated labels', () => {
  assert.equal(
    formatMessengerSavedDetailsOptions('Bengali'),
    '১. Saved details ব্যবহার করুন\n২. তথ্য পরিবর্তন করুন',
  );
  assert.equal(
    formatMessengerSavedDetailsOptions('English'),
    '1. Use saved details\n2. Change details',
  );
  assert.equal(
    formatMessengerSavedDetailsOptions('Hindi'),
    '1. Saved details उपयोग करें\n2. Details change करें',
  );
});

test('saved-details reply lists both numbered options in all languages', () => {
  const bengali = getMessengerSavedDetailsReply(
    savedDetailsPending,
    [],
    '₹',
    'Bengali',
  );
  assert.match(bengali, /১\. Saved details ব্যবহার করুন/);
  assert.match(bengali, /২\. তথ্য পরিবর্তন করুন/);
  // The original "type yes / change details" wording is kept as well.
  assert.match(bengali, /“হ্যাঁ” লিখুন/);
  assert.match(bengali, /“তথ্য পরিবর্তন” লিখুন/);
  // Cart total for 2 packets at ₹190.
  assert.match(bengali, /₹380/);

  const english = getMessengerSavedDetailsReply(
    savedDetailsPending,
    [],
    '₹',
    'English',
  );
  assert.match(english, /1\. Use saved details/);
  assert.match(english, /2\. Change details/);
  assert.match(english, /type “yes”/);

  const hindi = getMessengerSavedDetailsReply(
    savedDetailsPending,
    [],
    '₹',
    'Hindi',
  );
  assert.match(hindi, /1\. Saved details उपयोग करें/);
  assert.match(hindi, /2\. Details change करें/);
});

test('resumed saved-details confirmation also shows the numbered options', () => {
  const reply = getMessengerOrderResumeReply(savedDetailsPending, 'Bengali');
  assert.match(reply, /১\. Saved details ব্যবহার করুন/);
  assert.match(reply, /২\. তথ্য পরিবর্তন করুন/);
});

test('bare "1" and "১" parse as confirm, "2" and "২" as change', () => {
  assert.equal(parseMessengerSavedDetailsNumberSelection('1'), 'confirm');
  assert.equal(parseMessengerSavedDetailsNumberSelection('১'), 'confirm');
  assert.equal(parseMessengerSavedDetailsNumberSelection(' 1 '), 'confirm');
  assert.equal(parseMessengerSavedDetailsNumberSelection('2'), 'change');
  assert.equal(parseMessengerSavedDetailsNumberSelection('২'), 'change');
  assert.equal(parseMessengerSavedDetailsNumberSelection(' 2 '), 'change');
});

test('non-bare numbers do not parse as confirmation answers', () => {
  assert.equal(parseMessengerSavedDetailsNumberSelection(''), null);
  assert.equal(parseMessengerSavedDetailsNumberSelection('3'), null);
  assert.equal(parseMessengerSavedDetailsNumberSelection('0'), null);
  assert.equal(parseMessengerSavedDetailsNumberSelection('1, 2'), null);
  assert.equal(parseMessengerSavedDetailsNumberSelection('1 packet'), null);
  assert.equal(parseMessengerSavedDetailsNumberSelection('2টা'), null);
  assert.equal(parseMessengerSavedDetailsNumberSelection('yes'), null);
  assert.equal(parseMessengerSavedDetailsNumberSelection('হ্যাঁ'), null);
});

test('"1" and "১" confirm with saved details while confirmation is pending', async () => {
  for (const text of ['1', '১']) {
    const result = expectHandled(await runOrderFlow(text, savedDetailsPending));
    assert.equal(result.pending?.step, 'confirmation', `text ${text}`);
    assert.match(result.reply, /Order details|অর্ডারের বিস্তারিত/);
  }
});

test('"2" and "২" change details while confirmation is pending', async () => {
  for (const text of ['2', '২']) {
    const result = expectHandled(await runOrderFlow(text, savedDetailsPending));
    assert.equal(result.pending?.step, 'name', `text ${text}`);
    assert.equal(
      (result.pending as PendingMessengerOrder | null)?.customer_name,
      undefined,
    );
  }
});

test('existing "yes" and "change details" words still work', async () => {
  const yesResult = expectHandled(await runOrderFlow('yes', savedDetailsPending));
  assert.equal(yesResult.pending?.step, 'confirmation');

  const haanResult = expectHandled(await runOrderFlow('হ্যাঁ', savedDetailsPending));
  assert.equal(haanResult.pending?.step, 'confirmation');

  const changeResult = expectHandled(
    await runOrderFlow('তথ্য পরিবর্তন', savedDetailsPending),
  );
  assert.equal(changeResult.pending?.step, 'name');

  const englishChangeResult = expectHandled(
    await runOrderFlow('change details', savedDetailsPending),
  );
  assert.equal(englishChangeResult.pending?.step, 'name');
});

test('unrelated text at confirmation stays on the confirmation step', async () => {
  const result = expectHandled(await runOrderFlow('hello', savedDetailsPending));
  assert.equal(result.pending?.step, 'saved_details_confirmation');
});

test('"1" with no confirmation pending does not trigger confirmation', async () => {
  const result = await runOrderFlow('1', null);
  assert.equal(result.handled, false);
});

test('"1" at the quantity step means quantity, not confirmation', async () => {
  const result = expectHandled(await runOrderFlow('1', quantityPending));
  assert.equal(result.pending?.step, 'name');
  assert.equal((result.pending as PendingMessengerOrder | null)?.quantity, 1);
});
