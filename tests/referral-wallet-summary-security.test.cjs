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

test('checkout calls the self-scoped RPC with the selected country, never a caller-supplied user id', () => {
  assert.match(
    checkout,
    /supabase\.rpc\(['"]get_my_referral_wallet_summary['"]\s*,\s*\{\s*p_country_code:\s*visitorCountry\s*\}\s*\)/,
  );
  assert.doesNotMatch(checkout, /get_referral_wallet_summary['"]\s*,\s*\{\s*p_user_id\s*:/);
});

test('privileged calculation lives in the non-public private schema and derives its owner from auth.uid()', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.get_my_referral_wallet_summary\(p_country_code text\)/i);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /IF v_user_id IS NULL THEN\s+RAISE EXCEPTION 'Authentication required'/i);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(migration, /public\.referral_wallet_settings AS s[\s\S]*?s\.country_code = v_country_code/i);
  assert.match(migration, /v_country_code NOT IN \('BD', 'IN'\)/i);
});

test('the public RPC is a SECURITY INVOKER wrapper, not a SECURITY DEFINER function', () => {
  const publicWrapper = migration.match(
    /CREATE OR REPLACE FUNCTION public\.get_my_referral_wallet_summary\(p_country_code text\)([\s\S]*?)\$function\$;/i,
  );
  assert.ok(publicWrapper, 'expected a public RPC wrapper');
  assert.match(publicWrapper[1], /SECURITY INVOKER/i);
  assert.match(publicWrapper[1], /FROM private\.get_my_referral_wallet_summary\(p_country_code\)/i);
  assert.doesNotMatch(publicWrapper[1], /SECURITY DEFINER/i);
});

test('private helper and public wrapper are executable only by authenticated callers', () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION private\.get_my_referral_wallet_summary\(text\)\s+FROM PUBLIC, anon, authenticated/i,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION private\.get_my_referral_wallet_summary\(text\)\s+TO authenticated/i,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.get_my_referral_wallet_summary\(text\)\s+FROM PUBLIC, anon, authenticated/i,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.get_my_referral_wallet_summary\(text\)\s+TO authenticated/i,
  );
  assert.match(migration, /GRANT USAGE ON SCHEMA private TO authenticated/i);
});

test('wallet summary keeps the expected response columns and usage formula', () => {
  assert.match(migration, /RETURNS TABLE\s*\(\s*balance numeric,\s*unlocked boolean,\s*max_usable numeric,\s*min_purchase_amount numeric,\s*usage_percent numeric,\s*enabled boolean/i);
  assert.match(migration, /public\.get_referral_wallet_balance\(v_user_id\)/i);
  assert.match(migration, /public\.is_referral_wallet_unlocked\(v_user_id\)/i);
  assert.match(migration, /s\.usage_basis = 'order_total'/i);
});
