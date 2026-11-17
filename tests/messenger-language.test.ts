import assert from 'node:assert/strict';
import test from 'node:test';

import { detectMessengerReplyLanguage } from '../lib/ai/messenger-language';

// "dam"/"daam" (price) is the same word in Hindi (दाम) and Bengali (দাম),
// so it must never short-circuit language detection to Bengali on its own.
// A Roman-Hindi question such as "Rani chili ka dam kya hai?" must stay
// Hindi: hindi hints (ka, kya, hai) outscore the single Banglish hint (dam).
test('Roman-Hindi price questions stay Hindi even though they contain dam', () => {
  assert.equal(
    detectMessengerReplyLanguage('Rani chili ka dam kya hai?'),
    'Hindi',
  );
  assert.equal(
    detectMessengerReplyLanguage('Rani chili ka dam kitna hai?'),
    'Hindi',
  );
  assert.equal(
    detectMessengerReplyLanguage('iska dam kitna hai?'),
    'Hindi',
  );
});

test('Devanagari Hindi is detected as Hindi', () => {
  assert.equal(
    detectMessengerReplyLanguage('रानी मिर्च का दाम क्या है?'),
    'Hindi',
  );
});

test('Banglish price questions stay Bengali', () => {
  assert.equal(
    detectMessengerReplyLanguage('Rani chili er dam koto?'),
    'Bengali',
  );
  assert.equal(detectMessengerReplyLanguage('dam koto?'), 'Bengali');
});

test('dam alone as the only signal still resolves to Bengali by scoring', () => {
  assert.equal(
    detectMessengerReplyLanguage('Rani chili dam?'),
    'Bengali',
  );
});

test('English price questions stay English', () => {
  assert.equal(
    detectMessengerReplyLanguage('What is the price of Rani Chili Seed?'),
    'English',
  );
  assert.equal(
    detectMessengerReplyLanguage('Rani Chili Seed price?'),
    'English',
  );
});

test('Bengali-script questions stay Bengali', () => {
  assert.equal(
    detectMessengerReplyLanguage('রানি লঙ্কার বীজের দাম কত?'),
    'Bengali',
  );
});
