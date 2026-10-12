const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const checkout = fs.readFileSync(path.join(root, 'app/checkout/page.tsx'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261012043000_add_self_scoped_referral_wallet_summary.sql'),
  'utf8',
);

test('checkout uses the self-scoped RPC with no caller-supplied user id', () => {
  assert.match(checkout, /supabase\.rpc\(['"]get_my_referral_wallet_summary['"]\s*\)/);
  assert.doesNotMatch(checkout, /get_referral_wallet_summary['"]\s*,\s*\{\s*p_user_id\s*:/);
});

test('the RPC derives its owner from the authenticated session', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_my_referral_wallet_summary\(\)/i);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /IF v_user_id IS NULL THEN\s+RAISE EXCEPTION 'Authentication required'/i);
  assert.doesNotMatch(migration, /get_my_referral_wallet_summary\(\s*p_user_id/i);
});

test('only authenticated users receive EXECUTE; public and anon stay revoked', () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.get_my_referral_wallet_summary\(\)\s+FROM PUBLIC, anon, authenticated/i,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.get_my_referral_wallet_summary\(\)\s+TO authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.get_my_referral_wallet_summary\(\)[\s\S]*?TO [^;]*\banon\b/i,
  );
});

test('wallet summary keeps the expected checkout response columns and formula', () => {
  assert.match(migration, /RETURNS TABLE\s*\(\s*balance numeric,\s*unlocked boolean,\s*max_usable numeric,\s*min_purchase_amount numeric,\s*usage_percent numeric,\s*enabled boolean/i);
  assert.match(migration, /public\.get_referral_wallet_balance\(v_user_id\)/i);
  assert.match(migration, /public\.is_referral_wallet_unlocked\(v_user_id\)/i);
  assert.match(migration, /s\.usage_basis = 'order_total'/i);
});
