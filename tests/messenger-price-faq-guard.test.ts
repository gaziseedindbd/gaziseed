import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getMessengerWebsiteKnowledgeAnswer,
  isMessengerPriceIntentQuery,
} from '../lib/ai/messenger-knowledge-tool';
import { scoreMessengerProductMatch } from '../lib/ai/messenger-product-tool';

test('price-intent detector: price questions in Bangla, English and Hindi', () => {
  // Live-tested failure: "লাল গোলাপ ফুলের বীজ কত?" was answered with a
  // germination-time FAQ instead of the price.
  assert.equal(
    isMessengerPriceIntentQuery('লাল গোলাপ ফুলের বীজ কত?'),
    true,
  );
  assert.equal(
    isMessengerPriceIntentQuery('Rani chili ka dam kya hai?'),
    true,
  );
  assert.equal(isMessengerPriceIntentQuery('What is the price?'), true);
  assert.equal(isMessengerPriceIntentQuery('Rani Chili Seed price?'), true);
  assert.equal(isMessengerPriceIntentQuery('কত টাকা?'), true);
  assert.equal(
    isMessengerPriceIntentQuery('What is the cost of Rani Chili Seed?'),
    true,
  );
  assert.equal(isMessengerPriceIntentQuery('How much is this?'), true);
  assert.equal(isMessengerPriceIntentQuery('Golap er bij koto dam?'), true);
  assert.equal(
    isMessengerPriceIntentQuery('रानी मिर्च का दाम क्या है?'),
    true,
  );
  assert.equal(
    isMessengerPriceIntentQuery('Rani chili ka dam kitna hai?'),
    true,
  );
  assert.equal(isMessengerPriceIntentQuery('kitne ka hai?'), true);
});

test('price-intent detector: time and how-to questions are not price questions', () => {
  // "কতদিন" is one token after normalization, so it never matches bare "কত".
  assert.equal(
    isMessengerPriceIntentQuery('লাল গোলাপের বীজ থেকে চারা হতে কতদিন লাগে?'),
    false,
  );
  // The same duration question written with a space ("কত দিন") must also
  // stay a time question: a duration word right after কত disambiguates it.
  assert.equal(
    isMessengerPriceIntentQuery('লাল গোলাপের বীজ থেকে চারা হতে কত দিন লাগে?'),
    false,
  );
  assert.equal(isMessengerPriceIntentQuery('কতদিনে ফল আসে?'), false);
  assert.equal(isMessengerPriceIntentQuery('kitne din me ugega?'), false);
  assert.equal(
    isMessengerPriceIntentQuery('How much time does it take to germinate?'),
    false,
  );
  // "germination rate" is a field question, not a price question.
  assert.equal(
    isMessengerPriceIntentQuery('What is the germination rate?'),
    false,
  );
  assert.equal(
    isMessengerPriceIntentQuery('মরিচের বীজ কীভাবে লাগাবো?'),
    false,
  );
  assert.equal(isMessengerPriceIntentQuery('রানি মরিচের বীজ'), false);
});

type FakeRows = {
  rpcRow: Record<string, unknown>;
  faqRows: Array<Record<string, unknown>>;
  fullProductRow: Record<string, unknown>;
};

class FakeQueryBuilder {
  readonly result: { data: unknown; error: unknown };

  constructor(result: { data: unknown; error: unknown }) {
    this.result = result;
  }

  select(): this {
    return this;
  }

  eq(): this {
    return this;
  }

  ilike(): this {
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    return this.result;
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function createFakeSupabase(rows: FakeRows): SupabaseClient {
  return {
    rpc: async () => ({ data: [rows.rpcRow], error: null }),
    from: (table: string) => {
      if (table === 'product_faqs') {
        return new FakeQueryBuilder({ data: rows.faqRows, error: null });
      }
      if (table === 'products') {
        return new FakeQueryBuilder({ data: rows.fullProductRow, error: null });
      }
      return new FakeQueryBuilder({ data: [], error: null });
    },
  } as unknown as SupabaseClient;
}

const ROSE_PRODUCT = {
  id: 'rose-1',
  name_bn: 'লাল গোলাপ ফুলের বীজ',
  name_en: 'Red Rose Flower Seeds',
  slug: 'red-rose-flower-seeds',
  short_description: null,
  regular_price: 150,
  sale_price: null,
  offer_price: null,
  price: 150,
  stock: 20,
  is_active: true,
  seed_type: 'Flower',
  variety: null,
  brand: null,
  origin: null,
  season: null,
  planting_season: null,
  germination_time: null,
  germination_rate: null,
  harvest_time: null,
  plant_spacing: null,
  planting_depth: null,
  sunlight: null,
  water_requirement: null,
  soil_type: null,
  growing_location: null,
  packet_weight: null,
  seed_quantity: '100',
  expected_yield: null,
  cultivation_instructions: null,
  storage_instructions: null,
  description: null,
  country_code: 'IN',
};

const ROSE_GERMINATION_FAQ = {
  id: 'faq-rose-germination',
  question_bn: 'লাল গোলাপের বীজ থেকে চারা হতে কতদিন লাগে?',
  answer_bn:
    'সঠিক পরিবেশে সাধারণত কয়েক সপ্তাহ সময় লাগতে পারে। Rose seed-এর dormancy-এর কারণে কিছু বীজ আরও বেশি সময় নিতে পারে।',
  question_en: 'How many days does it take for red rose seeds to sprout?',
  answer_en:
    'In the right conditions it usually takes a few weeks. Some seeds may take longer because of rose seed dormancy.',
  display_order: 1,
};

test('price question is not answered with a product FAQ', async () => {
  // The trusted-match (candidate) path: without the price guard, findFaq
  // matches the germination FAQ here (shared tokens লাল/গোলাপ/বীজ, overlap
  // 3 of 4 query tokens) and the price question gets a FAQ answer.
  assert.equal(
    scoreMessengerProductMatch(
      'লাল গোলাপ ফুলের বীজ কত?',
      ROSE_PRODUCT,
    ).type,
    'strong',
  );

  const supabase = createFakeSupabase({
    rpcRow: ROSE_PRODUCT,
    faqRows: [ROSE_GERMINATION_FAQ],
    fullProductRow: ROSE_PRODUCT,
  });

  const result = await getMessengerWebsiteKnowledgeAnswer({
    supabase,
    country: 'IN',
    text: 'লাল গোলাপ ফুলের বীজ কত?',
  });

  assert.equal(result.handled, false);
  assert.equal(result.reply, undefined);
});

test('price question skips the FAQ lookup on the similar-match path too', async () => {
  // One shared distinctive token (গোলাপ) with a two-token query is only a
  // "similar" match, so the first findFaq call site runs. The FAQ below
  // would match confidently (shared tokens গোলাপ/চারা, ratio 1.0), so
  // without the guard this price question would still get a FAQ answer.
  const yellowRose = {
    ...ROSE_PRODUCT,
    id: 'rose-2',
    name_bn: 'হলুদ গোলাপ ফুলের বীজ',
    name_en: 'Yellow Rose Flower Seeds',
    slug: 'yellow-rose-flower-seeds',
  };
  assert.equal(
    scoreMessengerProductMatch('গোলাপের চারা কত?', yellowRose).type,
    'similar',
  );

  const supabase = createFakeSupabase({
    rpcRow: yellowRose,
    faqRows: [
      {
        id: 'faq-rose-seedling',
        question_bn: 'গোলাপের চারা কতদিনে হয়?',
        answer_bn: 'সাধারণত ২-৩ সপ্তাহে চারা হয়।',
        question_en: 'How many days does it take for a rose seedling to grow?',
        answer_en: 'Seedlings usually grow in 2-3 weeks.',
        display_order: 1,
      },
    ],
    fullProductRow: yellowRose,
  });

  const result = await getMessengerWebsiteKnowledgeAnswer({
    supabase,
    country: 'IN',
    text: 'গোলাপের চারা কত?',
  });

  assert.equal(result.handled, false);
  assert.equal(result.reply, undefined);
});

test('a real germination question still gets its FAQ answer', async () => {
  const supabase = createFakeSupabase({
    rpcRow: ROSE_PRODUCT,
    faqRows: [ROSE_GERMINATION_FAQ],
    fullProductRow: ROSE_PRODUCT,
  });

  const result = await getMessengerWebsiteKnowledgeAnswer({
    supabase,
    country: 'IN',
    text: 'লাল গোলাপের বীজ থেকে চারা হতে কতদিন লাগে?',
  });

  assert.equal(result.handled, true);
  assert.ok(
    typeof result.reply === 'string' &&
      result.reply.includes('লাল গোলাপের বীজ থেকে চারা হতে কতদিন লাগে?'),
  );
});
