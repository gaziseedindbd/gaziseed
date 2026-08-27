/*
# Referral Program Foundation

## Purpose
Creates the database structure for a customer referral program.
This migration ONLY creates tables, indexes, constraints, and RLS policies.
No reward payout, wallet/cash system, checkout changes, or UI is implemented.

## New Tables

### 1. referral_settings
Stores the referral program configuration (single row, enforced by a check constraint).
- `id` (int, PK, default 1) — singleton row
- `enabled` (boolean, default false) — whether the referral program is active
- `reward_type` (text, default 'discount') — future: 'discount', 'cash', 'points', etc.
- `reward_value` (numeric, default 0) — the reward amount/percentage
- `referrer_reward_type` (text, nullable) — reward type for the referrer (future)
- `referrer_reward_value` (numeric, nullable) — reward value for the referrer (future)
- `referred_reward_type` (text, nullable) — reward type for the referred customer (future)
- `referred_reward_value` (numeric, nullable) — reward value for the referred customer (future)
- `min_order_amount` (numeric, default 0) — minimum eligible order amount for referral qualification
- `max_reward_per_referral` (numeric, nullable) — maximum reward cap per referral if applicable
- `updated_at` (timestamptz, default now())
- `updated_by` (uuid, nullable, references auth.users) — admin who last updated settings

### 2. referral_codes
Stores a unique referral code per customer.
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, unique, references auth.users ON DELETE CASCADE) — the customer who owns this code
- `code` (text, NOT NULL, unique) — the unique referral code string
- `is_active` (boolean, default true) — whether the code is usable
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### 3. referrals
Records the relationship between a referrer and a referred customer.
- `id` (uuid, PK)
- `referrer_id` (uuid, NOT NULL, references auth.users ON DELETE CASCADE) — the customer who referred
- `referred_id` (uuid, NOT NULL, references auth.users ON DELETE CASCADE) — the customer who was referred
- `referral_code_id` (uuid, NOT NULL, references referral_codes ON DELETE RESTRICT) — the code used
- `status` (text, NOT NULL, default 'pending') — 'pending', 'qualified', 'rewarded', 'cancelled'
- `qualified_at` (timestamptz, nullable) — when the referral became qualified
- `rewarded_at` (timestamptz, nullable) — when the reward was issued
- `cancelled_at` (timestamptz, nullable) — when the referral was cancelled
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
- CHECK constraint: referrer_id != referred_id (prevents self-referral)
- UNIQUE constraint: (referred_id) — each customer can only be referred once

### 4. referral_rewards
Stores reward information for future use (no payout logic implemented).
- `id` (uuid, PK)
- `referral_id` (uuid, NOT NULL, references referrals ON DELETE CASCADE) — the referral this reward belongs to
- `order_id` (uuid, nullable, references orders ON DELETE SET NULL) — the qualifying order
- `recipient_id` (uuid, NOT NULL, references auth.users ON DELETE CASCADE) — who receives the reward
- `reward_type` (text, NOT NULL) — 'discount', 'cash', 'points', etc.
- `reward_value` (numeric, NOT NULL, default 0) — the reward amount
- `status` (text, NOT NULL, default 'pending') — 'pending', 'issued', 'redeemed', 'expired'
- `issued_at` (timestamptz, nullable) — when the reward was issued
- `redeemed_at` (timestamptz, nullable) — when the reward was redeemed
- `expires_at` (timestamptz, nullable) — when the reward expires
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
- UNIQUE constraint: (referral_id, recipient_id) — prevents duplicate reward for the same referral+recipient

## Security (RLS)
- referral_settings: admin-only write, all authenticated users can read (to check if program is enabled)
- referral_codes: owner can read/update own code; admin can manage all
- referrals: referrer can read own referrals; admin can manage all
- referral_rewards: recipient can read own rewards; admin can manage all

## Existing Tables
- No existing tables are modified.
- site_settings.enable_referral already exists and is not touched.
- orders, products, categories, checkout — completely unchanged.

## Important Notes
1. No reward payout logic is implemented — only the data structure.
2. No wallet/cash system is created.
3. No checkout or order calculation changes.
4. No customer-facing UI is added.
5. Self-referral is prevented at the database level via CHECK constraint.
6. Duplicate rewards are prevented via UNIQUE constraint on (referral_id, recipient_id).
7. Each customer can only be referred once via UNIQUE constraint on referred_id.
*/

-- ============ REFERRAL_SETTINGS (singleton) ============
CREATE TABLE IF NOT EXISTS referral_settings (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  reward_type text NOT NULL DEFAULT 'discount',
  reward_value numeric NOT NULL DEFAULT 0,
  referrer_reward_type text,
  referrer_reward_value numeric,
  referred_reward_type text,
  referred_reward_value numeric,
  min_order_amount numeric NOT NULL DEFAULT 0,
  max_reward_per_referral numeric,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT referral_settings_singleton CHECK (id = 1)
);

ALTER TABLE referral_settings ENABLE ROW LEVEL SECURITY;

-- Insert default singleton row
INSERT INTO referral_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Admin-only write, authenticated can read
DROP POLICY IF EXISTS "authenticated_read_referral_settings" ON referral_settings;
CREATE POLICY "authenticated_read_referral_settings"
ON referral_settings FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_referral_settings" ON referral_settings;
CREATE POLICY "admin_write_referral_settings"
ON referral_settings FOR ALL
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ REFERRAL_CODES ============
CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Owner can read own code
DROP POLICY IF EXISTS "owner_read_referral_codes" ON referral_codes;
CREATE POLICY "owner_read_referral_codes"
ON referral_codes FOR SELECT
TO authenticated USING (auth.uid() = user_id);

-- Owner can insert own code
DROP POLICY IF EXISTS "owner_insert_referral_codes" ON referral_codes;
CREATE POLICY "owner_insert_referral_codes"
ON referral_codes FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

-- Owner can update own code (e.g. toggle active)
DROP POLICY IF EXISTS "owner_update_referral_codes" ON referral_codes;
CREATE POLICY "owner_update_referral_codes"
ON referral_codes FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admin can manage all codes
DROP POLICY IF EXISTS "admin_all_referral_codes" ON referral_codes;
CREATE POLICY "admin_all_referral_codes"
ON referral_codes FOR ALL
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ REFERRALS ============
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code_id uuid NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded', 'cancelled')),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT referral_no_self_referral CHECK (referrer_id != referred_id),
  CONSTRAINT referral_unique_referred UNIQUE (referred_id)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Referrer can read own referrals (as referrer)
DROP POLICY IF EXISTS "referrer_read_referrals" ON referrals;
CREATE POLICY "referrer_read_referrals"
ON referrals FOR SELECT
TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Referrer can insert (create a referral record)
DROP POLICY IF EXISTS "referrer_insert_referrals" ON referrals;
CREATE POLICY "referrer_insert_referrals"
ON referrals FOR INSERT
TO authenticated WITH CHECK (auth.uid() = referrer_id);

-- Admin can manage all referrals
DROP POLICY IF EXISTS "admin_all_referrals" ON referrals;
CREATE POLICY "admin_all_referrals"
ON referrals FOR ALL
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ REFERRAL_REWARDS ============
CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  reward_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'redeemed', 'expired')),
  issued_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT referral_reward_unique UNIQUE (referral_id, recipient_id)
);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Recipient can read own rewards
DROP POLICY IF EXISTS "recipient_read_referral_rewards" ON referral_rewards;
CREATE POLICY "recipient_read_referral_rewards"
ON referral_rewards FOR SELECT
TO authenticated USING (auth.uid() = recipient_id);

-- Admin can manage all rewards
DROP POLICY IF EXISTS "admin_all_referral_rewards" ON referral_rewards;
CREATE POLICY "admin_all_referral_rewards"
ON referral_rewards FOR ALL
TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral_id ON referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_recipient_id ON referral_rewards(recipient_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(status);

-- ============ UPDATED_AT TRIGGERS ============
DO $$
DECLARE
  t text;
  tables_arr text[] := ARRAY['referral_settings','referral_codes','referrals','referral_rewards'];
BEGIN
  FOREACH t IN ARRAY tables_arr LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_%s ON %s;', t, t);
    EXECUTE format('CREATE TRIGGER trg_updated_%s BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;
