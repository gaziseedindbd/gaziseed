import assert from 'node:assert/strict';
import test from 'node:test';

import { getMessengerOrderTrackingReply } from '../lib/ai/messenger-order-tracking';

type GateRow = { allowed: boolean; failed_attempts: number; retry_after_seconds: number };
type MockOptions = {
  gateRows?: GateRow[];
  gateError?: boolean;
  profilePhone?: string | null;
  profileError?: boolean;
  orders?: Array<Record<string, unknown>>;
  ordersError?: boolean;
};

function makeSupabase(options: MockOptions = {}) {
  const calls: Array<{ kind: string; args?: Record<string, unknown>; filters?: Array<[string, unknown]> }> = [];
  const gateRows = [...(options.gateRows || [{ allowed: true, failed_attempts: 0, retry_after_seconds: 0 }])];
  let profileReadCount = 0;
  let orderReadCount = 0;

  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ kind: 'rpc:' + name, args });
      if (options.gateError) return { data: null, error: { message: 'limiter unavailable' } };
      return { data: [gateRows.shift() || { allowed: true, failed_attempts: 0, retry_after_seconds: 0 }], error: null };
    },
    from: (table: string) => {
      let filters: Array<[string, unknown]> = [];
      const query = {
        select: (_columns: string) => query,
        eq: (field: string, value: unknown) => {
          filters = [...filters, [field, value]];
          return query;
        },
        limit: (_limit: number) => query,
        maybeSingle: async () => {
          calls.push({ kind: 'profile:' + table, filters });
          profileReadCount += 1;
          return {
            data: options.profileError ? null : { phone: options.profilePhone || null },
            error: options.profileError ? { message: 'profile read failed' } : null,
          };
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          calls.push({ kind: 'orders:' + table, filters });
          orderReadCount += 1;
          return Promise.resolve({
            data: options.ordersError ? null : (options.orders || []),
            error: options.ordersError ? { message: 'order read failed' } : null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };

  return {
    supabase: supabase as never,
    calls,
    get profileReadCount() { return profileReadCount; },
    get orderReadCount() { return orderReadCount; },
  };
}

const baseArgs = {
  pageId: 'page-test',
  externalUserId: 'customer-test',
  country: 'BD' as const,
};

const validTrackingText = 'GS-BD-ABC12345 01712345678';
const sampleOrder = {
  id: 'internal-order-id',
  order_number: 'GS-BD-ABC12345',
  order_status: 'shipped',
  payment_status: 'paid',
  final_amount: 500,
  created_at: '2026-10-11T12:00:00.000Z',
  customer_phone: '01712345678',
  order_source: 'website',
};

test('does not run profile or order lookups when order number is missing', async () => {
  const mock = makeSupabase({ profilePhone: '01712345678', orders: [sampleOrder] });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: '01712345678',
  });

  assert.equal(result.handled, true);
  assert.match(result.reply, /Order Number/i);
  assert.equal(mock.profileReadCount, 0);
  assert.equal(mock.orderReadCount, 0);
  assert.deepEqual(mock.calls.map((call) => call.kind), ['rpc:consume_messenger_tracking_verification']);
});

test('does not run profile or order lookups when registered phone is missing', async () => {
  const mock = makeSupabase({ profilePhone: '01712345678', orders: [sampleOrder] });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: 'GS-BD-ABC12345',
  });

  assert.equal(result.handled, true);
  assert.match(result.reply, /registered mobile number/i);
  assert.equal(mock.profileReadCount, 0);
  assert.equal(mock.orderReadCount, 0);
});

test('an existing Messenger profile cannot bypass the required order number', async () => {
  const mock = makeSupabase({ profilePhone: '01712345678', orders: [sampleOrder] });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: 'my order status please',
  });

  assert.equal(result.handled, true);
  assert.equal(mock.orderReadCount, 0);
  assert.equal(result.reply.includes('GS-BD-ABC12345'), false);
  assert.equal(result.reply.includes('shipped'), false);
});

test('uses a generic reply and counts a wrong registered phone without revealing whether the order exists', async () => {
  const mock = makeSupabase({
    profilePhone: '01812345678',
    gateRows: [
      { allowed: true, failed_attempts: 0, retry_after_seconds: 0 },
      { allowed: true, failed_attempts: 1, retry_after_seconds: 0 },
    ],
    orders: [{ ...sampleOrder, customer_phone: '01812345678' }],
  });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: validTrackingText,
  });

  assert.equal(result.handled, true);
  assert.match(result.reply, /যাচাই করা যায়নি/);
  assert.equal(result.reply.includes('shipped'), false);
  assert.equal(result.reply.includes('paid'), false);
  assert.equal(result.orderIds, undefined);
  assert.equal(mock.orderReadCount, 1);
  assert.equal(mock.profileReadCount, 0);
  assert.equal(mock.calls.filter((call) => call.kind === 'rpc:consume_messenger_tracking_verification').length, 2);
});

test('a failed exact order/phone match returns a generic response', async () => {
  const mock = makeSupabase({
    profilePhone: null,
    gateRows: [
      { allowed: true, failed_attempts: 0, retry_after_seconds: 0 },
      { allowed: true, failed_attempts: 1, retry_after_seconds: 0 },
    ],
    orders: [],
  });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: validTrackingText,
  });

  assert.equal(result.handled, true);
  assert.match(result.reply, /যাচাই করা যায়নি/);
  assert.equal(result.reply.includes('No matching order'), false);
  assert.equal(mock.orderReadCount, 1);
  const query = mock.calls.find((call) => call.kind === 'orders:orders');
  assert.ok(query);
  assert.ok(query?.filters?.some(([field, value]) => field === 'order_number' && value === 'GS-BD-ABC12345'));
});

test('three failed verifications activate the 15-minute cooldown', async () => {
  const mock = makeSupabase({
    gateRows: [{ allowed: false, failed_attempts: 3, retry_after_seconds: 900 }],
  });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: validTrackingText,
  });

  assert.equal(result.handled, true);
  assert.match(result.reply, /15 মিনিট পরে/);
  assert.equal(mock.profileReadCount, 0);
  assert.equal(mock.orderReadCount, 0);
});

test('fails closed if the cooldown RPC is unavailable', async () => {
  const mock = makeSupabase({ gateError: true, profilePhone: '01712345678', orders: [sampleOrder] });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: validTrackingText,
  });

  assert.equal(result.handled, true);
  assert.match(result.reply, /পরে আবার চেষ্টা করুন/);
  assert.equal(mock.profileReadCount, 0);
  assert.equal(mock.orderReadCount, 0);
});

test('returns order status only when order number and supplied registered phone match', async () => {
  const mock = makeSupabase({
    profilePhone: '01712345678',
    gateRows: [
      { allowed: true, failed_attempts: 2, retry_after_seconds: 0 },
      { allowed: true, failed_attempts: 0, retry_after_seconds: 0 },
    ],
    orders: [sampleOrder],
  });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: validTrackingText,
  });

  assert.equal(result.handled, true);
  assert.match(result.reply, /GS-BD-ABC12345/);
  assert.match(result.reply, /shipped/i);
  assert.equal(result.orderIds?.[0], 'internal-order-id');
  const query = mock.calls.find((call) => call.kind === 'orders:orders');
  assert.ok(query?.filters?.some(([field, value]) => field === 'order_number' && value === 'GS-BD-ABC12345'));
  assert.equal(query?.filters?.some(([field]) => field === 'order_source'), false, 'web/ads orders with the exact verified pair should also be trackable');
  assert.deepEqual(
    mock.calls.filter((call) => call.kind === 'rpc:consume_messenger_tracking_verification')
      .map((call) => call.args?.p_action),
    ['check', 'success'],
  );
});


test('accepts India phone with or without the +91 country prefix', async () => {
  const mock = makeSupabase({
    orders: [{ ...sampleOrder, customer_phone: '+91 98765 43210' }],
    gateRows: [
      { allowed: true, failed_attempts: 0, retry_after_seconds: 0 },
      { allowed: true, failed_attempts: 0, retry_after_seconds: 0 },
    ],
  });
  const result = await getMessengerOrderTrackingReply({
    pageId: 'page-india',
    externalUserId: 'customer-india',
    country: 'IN',
    supabase: mock.supabase,
    text: 'GS-IN-ABC12345 9876543210',
  });
  assert.equal(result.handled, true);
  assert.match(result.reply, /GS-BD-ABC12345/);
});

test('accepts Bangladesh phone with +880 or local 0 prefix', async () => {
  const mock = makeSupabase({
    orders: [{ ...sampleOrder, order_number: 'GS-BD-ABC12345', customer_phone: '+880 1712-345678' }],
    gateRows: [
      { allowed: true, failed_attempts: 0, retry_after_seconds: 0 },
      { allowed: true, failed_attempts: 0, retry_after_seconds: 0 },
    ],
  });
  const result = await getMessengerOrderTrackingReply({
    ...baseArgs, supabase: mock.supabase, text: validTrackingText,
  });
  assert.equal(result.handled, true);
  assert.match(result.reply, /GS-BD-ABC12345/);
});
