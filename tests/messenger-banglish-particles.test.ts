import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyMessengerProductMatch,
  scoreMessengerProductMatch,
} from '../lib/ai/messenger-product-tool';

const RED_ROSE = {
  name_bn: 'লাল গোলাপ ফুলের বীজ',
  name_en: 'Red Rose Flower Seeds',
  slug: 'red-rose-flower-seeds',
};

const RANI_LANKA = {
  name_bn: 'হাইব্রিড মরিচ – রানি লঙ্কা',
  name_en: 'Hybrid Chili – Rani Lanka',
  slug: 'hybrid-chili-rani-lanka',
};

const NAGA_BOMBAY = {
  name_bn: 'উচ্চ ফলনশীল নাগা বোম্বাই মরিচের বীজ',
  name_en: 'High-Yield Naga Bombay Chili Seeds',
  slug: 'high-yield-naga-bombay-chili-seeds',
};

test('Banglish genitive "er" does not stop a one-token product from matching', () => {
  // Live-tested failure: "Golap er bij koto dam?" scored only "similar"
  // (overlap ["rose"], query tokens {rose, er}), so the bot showed a
  // "similar products" list with no price — including Naga Bombay chili as
  // similar to a rose. Without "er" the same query was already "strong".
  const score = scoreMessengerProductMatch('Golap er bij koto dam?', RED_ROSE);
  assert.equal(score.type, 'strong');
  assert.deepEqual(score.overlap, ['rose']);
  assert.equal(
    classifyMessengerProductMatch('Golap er bij koto dam?', RED_ROSE),
    'strong',
  );
  assert.equal(
    classifyMessengerProductMatch('Golap er bij', RED_ROSE),
    'strong',
  );
});

test('Banglish genitive "er" does not stop a two-token product from matching', () => {
  assert.equal(
    classifyMessengerProductMatch('Rani Lanka er bij koto dam?', RANI_LANKA),
    'strong',
  );
});

test('other Roman Banglish grammar particles do not break matching', () => {
  // Classifiers (টা/টি): "bij ta" / "bij ti".
  assert.equal(
    classifyMessengerProductMatch('Golap er bij ta koto dam?', RED_ROSE),
    'strong',
  );
  assert.equal(
    classifyMessengerProductMatch('Golap er bij ti koto dam?', RED_ROSE),
    'strong',
  );
  // Possessive (তার): "tar dam koto?" — "what is its price?"
  assert.equal(
    classifyMessengerProductMatch('Golap er bij tar dam koto?', RED_ROSE),
    'strong',
  );
  // Plural (গুলো/গুলা): "bij gulo" / "bij gula".
  assert.equal(
    classifyMessengerProductMatch('Golap er bij gulo koto dam?', RED_ROSE),
    'strong',
  );
  assert.equal(
    classifyMessengerProductMatch('Golap er bij gula koto dam?', RED_ROSE),
    'strong',
  );
  // "from" (থেকে) — the particle itself must not count. Note a query that
  // also names the country ("Bangladesh theke golap er bij") still has the
  // country name itself as a second distinctive token — that is correct:
  // the country is handled by the country detector, not the product
  // matcher — so the "theke" case is pinned with the particle alone.
  assert.equal(
    classifyMessengerProductMatch('golap er bij theke koto dam?', RED_ROSE),
    'strong',
  );
});

test('Roman Hindi genitives "ka" / "ke" do not break matching', () => {
  // "gulab ka beej" / "gulab ke beej" — Roman Hindi for "rose seeds".
  assert.equal(
    classifyMessengerProductMatch('gulab ka beej ka dam kya hai?', RED_ROSE),
    'strong',
  );
  assert.equal(
    classifyMessengerProductMatch('gulab ke beej ka dam kya hai?', RED_ROSE),
    'strong',
  );
});

test('no regression: Bengali and English queries still match, wrong products stay similar', () => {
  assert.equal(
    classifyMessengerProductMatch('মরিচের বীজ', RANI_LANKA),
    'strong',
  );
  assert.equal(
    classifyMessengerProductMatch('Rani Chili Seed', RANI_LANKA),
    'strong',
  );
  assert.equal(
    classifyMessengerProductMatch('লাল গোলাপ ফুলের বীজ কত?', RED_ROSE),
    'strong',
  );
  // A genuinely different product must NOT become trusted just because the
  // query particles are now ignored: the rose question shares no
  // distinctive token with the chili.
  const nagaScore = scoreMessengerProductMatch(
    'Golap er bij koto dam?',
    NAGA_BOMBAY,
  );
  assert.equal(nagaScore.type, 'similar');
  assert.deepEqual(nagaScore.overlap, []);
});
