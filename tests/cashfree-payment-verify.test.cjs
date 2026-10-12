const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const ID = '11111111-1111-1111-1111-111111111111';

async function run(c = {}) {
  let handler;
  let fetchCount = 0;
  const writes = [];
  const intent = {
    id: ID,
    user_id: null,
    country_code: 'IN',
    currency: 'INR',
    amount: 199,
    status: 'created',
    completed_order_id: null,
    cashfree_order_id: 'GS-CF-test',
    ...c.intent,
  };
  const admin = {
    from(table) {
      let projection = '*';
      let updatePatch = null;
      let statusFilter = null;
      let completedNullRequired = false;
      const query = {
        select(value) { projection = value; return query; },
        eq() { return query; },
        is(field, value) {
          if (field === 'completed_order_id' && value === null) completedNullRequired = true;
          return query;
        },
        in(field, values) {
          if (field === 'status') statusFilter = values;
          return query;
        },
        update(value) {
          updatePatch = value;
          writes.push(value);
          return query;
        },
        maybeSingle: async () => {
          if (c.noIntent && !updatePatch) return { data: null, error: null };
          if (c.updateError && updatePatch) return { data: null, error: { message: 'write failed' } };
          if (updatePatch) {
            const eligible = (!statusFilter || statusFilter.includes(intent.status)) &&
              (!completedNullRequired || !intent.completed_order_id);
            if (!eligible) return { data: null, error: null };
            Object.assign(intent, updatePatch);
            return { data: projection === 'status' ? { status: intent.status } : { id: intent.id, status: intent.status }, error: null };
          }
          return { data: intent, error: null };
        },
      };
      return query;
    },
  };

  const source = stripTypeScriptTypes(
    fs.readFileSync('supabase/functions/cashfree-payment-verify/index.ts', 'utf8')
      .replace(/^import .*;\n/gm, ''),
  );
  vm.runInNewContext(source, {
    Request, Response, JSON, Date, Number, Math, Error, Promise, encodeURIComponent, crypto: require('node:crypto').webcrypto,
    Deno: {
      env: {
        get: (key) => ({
          SUPABASE_URL: 'https://project.example.supabase.co',
          SUPABASE_SECRET_KEYS: '{"default":"service-test-key"}',
          SUPABASE_PUBLISHABLE_KEYS: '',
          CASHFREE_APP_ID: 'cashfree-app-id',
          CASHFREE_SECRET_KEY: 'cashfree-secret-test',
        })[key] ?? null,
      },
      serve: (fn) => { handler = fn; },
    },
    createClient: () => admin,
    fetch: async () => {
      fetchCount += 1;
      if (c.gatewayNetworkError) throw new Error('gateway unavailable');
      return new Response(
        JSON.stringify({
          order_id: 'GS-CF-test',
          order_status: 'PAID',
          order_amount: 199,
          order_currency: 'INR',
          ...c.gateway,
        }),
        { status: c.gatewayHttpStatus || 200 },
      );
    },
  });

  const response = await handler(new Request('https://local.test', {
    method: 'POST',
    body: JSON.stringify({ payment_intent_id: c.badId ? 'not-an-id' : ID }),
  }));
  return {
    status: response.status,
    body: await response.json(),
    fetchCount,
    writes,
    intent,
  };
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    const cases = [
      ['rejects malformed intent IDs without gateway calls', { badId: true }, 400, 0],
      ['returns 404 for a missing intent', { noIntent: true }, 404, 0],
      ['refuses non-India intents', { intent: { country_code: 'BD', currency: 'BDT' } }, 409, 0],
      ['refuses wrong Cashfree order identity', { gateway: { order_id: 'OTHER' } }, 409, 0],
      ['refuses amount mismatch', { gateway: { order_amount: 100 } }, 409, 0],
      ['refuses currency mismatch', { gateway: { order_currency: 'USD' } }, 409, 0],
      ['records paid only after gateway identity and amount pass', {}, 200, 1],
      ['does not overwrite an active completion claim', { intent: { status: 'processing' } }, 200, 1],
      ['does not change an already-completed intent', { intent: { status: 'completed', completed_order_id: 'order-1' } }, 200, 0],
      ['returns 502 when gateway lookup fails', { gatewayHttpStatus: 502 }, 502, 0],
      ['returns 502 when gateway network fails', { gatewayNetworkError: true }, 502, 0],
      ['returns 502 when persisting verified state fails', { updateError: true }, 502, 1],
    ];

    for (const [name, options, expectedStatus, expectedWrites] of cases) {
      const result = await run(options);
      assert.equal(result.status, expectedStatus, name);
      if (name.includes('without gateway')) assert.equal(result.fetchCount, 0, name);
      if (options.gateway && result.status === 409) assert.equal(result.writes.length, 0, name);
      assert.equal(result.writes.length, expectedWrites, name);
      if (name.includes('records paid')) {
        assert.equal(result.body.paid, true);
        assert.equal(result.body.status, 'paid');
        assert.equal(result.intent.status, 'paid');
      }
      if (name.includes('active completion')) {
        assert.equal(result.body.status, 'processing');
        assert.equal(result.intent.status, 'processing');
      }
      if (name.includes('already-completed')) {
        assert.equal(result.body.already_completed, true);
        assert.equal(result.intent.status, 'completed');
      }
      console.log('PASS', name);
    }

    console.log(`All ${cases.length} Cashfree payment verification regression scenarios passed.`);
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
