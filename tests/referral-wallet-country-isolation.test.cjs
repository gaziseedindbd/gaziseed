const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const migration = read('supabase/migrations/20261012060000_separate_referral_wallets_by_country.sql');
const checkout = read('app/checkout/page.tsx');
const referralSection = read('components/site/referral-section.tsx');
const referralLib = read('lib/referral.ts');
const adminSettings = read('app/admin/settings/page.tsx');

test('wallet settings can store separate BD and IN rows and are seeded from documented defaults', () => {
  assert.match(migration, /PRIMARY KEY \(id, country_code\)/i);
  assert.match(migration, /\(1, 'BD', true, 2000, true, 'wallet_balance', 15\)/i);
  assert.match(migration, /\(1, 'IN', true, 2000, true, 'wallet_balance', 15\)/i);
  assert.match(migration, /ON CONFLICT \(id, country_code\) DO NOTHING/i);
  assert.match(migration, /ALTER TABLE public\.referral_wallet_settings ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /CREATE POLICY referral_wallet_settings_branch_select[\s\S]*?FOR SELECT TO authenticated[\s\S]*?country_code = public\.current_visitor_country\(\)/i);
});

test('every balance and spend calculation includes the explicit wallet country', () => {
  assert.match(migration, /get_referral_wallet_balance\(\s*p_user_id uuid,\s*p_country_code text\s*\)/i);
  assert.match(migration, /w\.user_id = p_user_id\s+AND w\.country_code = upper\(trim\(COALESCE\(p_country_code, ''\)\)\)/i);
  assert.match(migration, /get_referral_wallet_max_usage\(\s*p_user_id uuid,\s*p_order_total numeric,\s*p_country_code text\s*\)/i);
  assert.match(migration, /s\.country_code = upper\(trim\(COALESCE\(p_country_code, ''\)\)\)/i);
  assert.match(migration, /upper\(o\.country_code\) = upper\(trim\(COALESCE\(p_country_code, ''\)\)\)/i);
});

test('wallet ledger country is derived from its referral or order parent and mismatches are rejected', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.enforce_referral_wallet_transaction_country\(\)/i);
  assert.match(migration, /SELECT upper\(r\.country_code\)[\s\S]*?WHERE r\.id = NEW\.referral_id/i);
  assert.match(migration, /SELECT upper\(o\.country_code\)[\s\S]*?WHERE o\.id = NEW\.order_id/i);
  assert.match(migration, /cannot cross country scopes/i);
  assert.match(migration, /NEW\.country_code := v_country/i);
});

test('qualification, reward issuance, and cancellation reversals preserve the referral country', () => {
  assert.match(migration, /WHERE country_code = order_country/i);
  assert.match(migration, /WHERE country_code = v_country/i);
  assert.match(migration, /referral_rewards\(referral_id, user_id, amount, status, country_code\)/i);
  assert.match(migration, /user_id, referral_id, amount, type, status, description, country_code/i);
  assert.match(migration, /t\.country_code/i);
  assert.match(migration, /upper\(NEW\.country_code\)/i);
});

test('self-scoped checkout summary derives the owner from auth.uid() and validates the requested country', () => {
  const selfScoped = migration.match(
    /CREATE OR REPLACE FUNCTION private\.get_my_referral_wallet_summary\(p_country_code text\)([\s\S]*?)\$function\$;/i,
  );
  assert.ok(selfScoped, 'expected self-scoped private summary helper');
  assert.match(selfScoped[1], /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(selfScoped[1], /v_country_code NOT IN \('BD', 'IN'\)/i);
  assert.match(selfScoped[1], /get_referral_wallet_balance\(v_user_id, v_country_code\)/i);
  const publicWrapper = migration.match(
    /CREATE OR REPLACE FUNCTION public\.get_my_referral_wallet_summary\(p_country_code text\)([\s\S]*?)\$function\$;/i,
  );
  assert.ok(publicWrapper, 'expected the public RPC wrapper');
  assert.match(publicWrapper[1], /SECURITY INVOKER/i);
  assert.doesNotMatch(publicWrapper[1], /SECURITY DEFINER/i);
  assert.match(checkout, /supabase\.rpc\(['"]get_my_referral_wallet_summary['"]\s*,\s*\{\s*p_country_code:\s*visitorCountry\s*\}\s*\)/);
  assert.doesNotMatch(checkout, /get_referral_wallet_summary['"]\s*,\s*\{\s*p_user_id\s*:/);
});

test('referral codes and customer-visible referral history are branch-specific', () => {
  assert.match(migration, /referral_codes_user_country_unique[\s\S]*?ON public\.referral_codes\(user_id, country_code\)/i);
  assert.match(migration, /get_or_create_my_referral_code\(p_country_code text\)/i);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(referralSection, /get_or_create_my_referral_code/);
  assert.match(referralSection, /\.eq\('country_code', country\)/);
  assert.match(referralLib, /\.eq\('country_code', country\)/);
});

test('admin referral settings are loaded and saved by branch, not hard-coded id=1', () => {
  assert.match(adminSettings, /from\('referral_settings'\)\.select\('\*'\)\.eq\('country_code', branch\)\.maybeSingle\(\)/);
  assert.match(adminSettings, /update\(\{ \.\.\.payload, country_code: adminCountry \}\)\.eq\('country_code', adminCountry\)/);
  assert.doesNotMatch(adminSettings, /from\('referral_settings'\)[\s\S]{0,180}\.eq\('id', 1\)\.eq\('country_code', branch\)/);
});
