import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectExplicitMessengerCountry,
  shouldConfirmMessengerCountrySelection,
} from '../lib/ai/messenger-country';

test('detects country from Roman-Banglish country statements', () => {
  // Live-tested failure: "Hello, ami Bangladesh theke bolchi" was not
  // recognized at all, so the country stayed India while the AI replied as
  // if it had been noted ("জানিয়ে ভালো লাগল").
  assert.equal(
    detectExplicitMessengerCountry('Hello, ami Bangladesh theke bolchi'),
    'BD',
  );
  assert.equal(
    detectExplicitMessengerCountry('ami India theke bolchi'),
    'IN',
  );
  assert.equal(
    detectExplicitMessengerCountry('ami Bangladesh theke'),
    'BD',
  );
  assert.equal(
    detectExplicitMessengerCountry('Bangladesh theke order korte chai'),
    'BD',
  );
  assert.equal(
    detectExplicitMessengerCountry('ami Bangladesh'),
    'BD',
  );
  assert.equal(
    detectExplicitMessengerCountry('ami India theke achi'),
    'IN',
  );
  assert.equal(
    detectExplicitMessengerCountry('bharat theke bolchi'),
    'IN',
  );
  assert.equal(
    detectExplicitMessengerCountry('Bangladesh theke delivery hobe?'),
    'BD',
  );
});

test('keeps existing country detection behavior for exact words and English', () => {
  assert.equal(detectExplicitMessengerCountry('bangladesh'), 'BD');
  assert.equal(detectExplicitMessengerCountry('India'), 'IN');
  assert.equal(detectExplicitMessengerCountry('from Bangladesh'), 'BD');
  assert.equal(detectExplicitMessengerCountry('I am in India'), 'IN');
  assert.equal(
    detectExplicitMessengerCountry('বাংলাদেশ থেকে বলছি'),
    'BD',
  );
  assert.equal(
    detectExplicitMessengerCountry('ভারত থেকে অর্ডার করব'),
    'IN',
  );
});

test('does not treat product adjectives or both-country mentions as a selection', () => {
  assert.equal(
    detectExplicitMessengerCountry('Bangladeshi beej chai'),
    null,
  );
  assert.equal(detectExplicitMessengerCountry('Indian seeds'), null);
  assert.equal(detectExplicitMessengerCountry('Indian seeds please'), null);
  assert.equal(
    detectExplicitMessengerCountry('I want Bangladesh delivery and India delivery'),
    null,
  );
  assert.equal(
    detectExplicitMessengerCountry('Bangladesh theke ar India theke'),
    null,
  );
});

test('confirms a free-text sentence that changes the country', () => {
  // India conversation, customer says they are from Bangladesh in a sentence.
  assert.equal(
    shouldConfirmMessengerCountrySelection({
      quickReplyCountry: null,
      freeTextCountry: 'BD',
      currentCountry: 'IN',
      isExactCountrySelection: false,
    }),
    true,
  );
  // New user (no verified country yet) stating their country in a sentence.
  assert.equal(
    shouldConfirmMessengerCountrySelection({
      quickReplyCountry: null,
      freeTextCountry: 'BD',
      currentCountry: null,
      isExactCountrySelection: false,
    }),
    true,
  );
});

test('does not confirm when the free-text country is already the verified one', () => {
  assert.equal(
    shouldConfirmMessengerCountrySelection({
      quickReplyCountry: null,
      freeTextCountry: 'BD',
      currentCountry: 'BD',
      isExactCountrySelection: false,
    }),
    false,
  );
  assert.equal(
    shouldConfirmMessengerCountrySelection({
      quickReplyCountry: null,
      freeTextCountry: 'IN',
      currentCountry: 'IN',
      isExactCountrySelection: false,
    }),
    false,
  );
});

test('keeps exact-word and quick-reply confirmation behavior unchanged', () => {
  // Exact "bangladesh" / "india" always confirms, as before — even when the
  // country is already that one.
  assert.equal(
    shouldConfirmMessengerCountrySelection({
      quickReplyCountry: null,
      freeTextCountry: 'BD',
      currentCountry: 'BD',
      isExactCountrySelection: true,
    }),
    true,
  );
  // Quick-reply button taps keep their existing flow: a free-text detection
  // does not force a confirmation on top of the button.
  assert.equal(
    shouldConfirmMessengerCountrySelection({
      quickReplyCountry: 'BD',
      freeTextCountry: 'BD',
      currentCountry: 'IN',
      isExactCountrySelection: false,
    }),
    false,
  );
  // Nothing detected, nothing to confirm.
  assert.equal(
    shouldConfirmMessengerCountrySelection({
      quickReplyCountry: null,
      freeTextCountry: null,
      currentCountry: 'IN',
      isExactCountrySelection: false,
    }),
    false,
  );
});
