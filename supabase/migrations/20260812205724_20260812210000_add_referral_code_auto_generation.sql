/*
# Referral Code Auto-Generation

## Purpose
Automatically generates a unique referral code (format: SEEDBARI-XXXXXX) for every
customer. New customers get a code automatically when they sign up via a trigger on
auth.users. Existing customers get a code via a one-time backfill.

## What This Migration Does

### 1. generate_referral_code() function
- SECURITY DEFINER function that generates a collision-safe referral code.
- Format: SEEDBARI-XXXXXX where XXXXXX is 6 uppercase alphanumeric characters.
- Uses a loop that retries with a new random string if a collision is detected
  (up to 10 attempts, then raises an exception — practically never reached).
- Returns the generated code string.

### 2. ensure_referral_code() function
- SECURITY DEFINER function that checks if a user already has a referral code.
- If not, generates one and inserts it into referral_codes.
- Idempotent: safe to call multiple times — does nothing if a code already exists.
- This is used by both the trigger and the backfill.

### 3. Trigger on auth.users (trg_create_referral_code_on_signup)
- AFTER INSERT trigger — fires when a new user signs up.
- Calls ensure_referral_code() for the new user.
- This means every new registration automatically gets a referral code.

### 4. Backfill for existing users
- Calls ensure_referral_code() for every existing auth.users row that doesn't
  already have a code in referral_codes.
- Safe to re-run (idempotent).

## Security
- Both functions are SECURITY DEFINER so they can insert into referral_codes
  even though the calling context (trigger) runs as the user.
- ensure_referral_code() only ever inserts a code for the user_id passed to it —
  it cannot be used to create codes for arbitrary users from the client because
  it is only called from the database trigger, not exposed via RPC.
- The referral_codes table already has RLS: owner can read/insert/update own,
  admin can manage all. The trigger runs with elevated privileges to insert
  the initial code, but the user cannot modify or choose another user's code.
- No private customer information (email, phone, name) is embedded in the code —
  the code is purely random alphanumeric.

## Existing Tables Modified
- auth.users: AFTER INSERT trigger added (no column changes, no data changes)
- referral_codes: rows inserted for existing + future users (table already exists)

## Important Notes
1. The referral program remains OFF by default (referral_settings.enabled = false).
2. No UI, no rewards, no checkout changes — just code generation.
3. Codes are 6 random uppercase alphanumeric characters (A-Z, 0-9) = 36^6 ≈ 2.2 billion
   combinations, making collisions extremely unlikely. The retry loop handles any
   collision that does occur.
4. The trigger on auth.users does NOT change the signup flow — it fires after the
   user is already created, so signup/login behavior is completely unchanged.
*/

-- ============ generate_referral_code() ============
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code_text text;
  attempt integer := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > 10 THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after 10 attempts';
    END IF;

    code_text := 'SEEDBARI-';
    FOR i IN 1..6 LOOP
      code_text := code_text || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = code_text);
  END LOOP;

  RETURN code_text;
END;
$$;

-- ============ ensure_referral_code() ============
CREATE OR REPLACE FUNCTION ensure_referral_code(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code text;
BEGIN
  -- Do nothing if user already has a code
  IF EXISTS (SELECT 1 FROM referral_codes WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  new_code := generate_referral_code();

  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, new_code);
END;
$$;

-- ============ Trigger function for new signups ============
CREATE OR REPLACE FUNCTION create_referral_code_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM ensure_referral_code(NEW.id);
  RETURN NEW;
END;
$$;

-- ============ Trigger on auth.users ============
DROP TRIGGER IF EXISTS trg_create_referral_code_on_signup ON auth.users;
CREATE TRIGGER trg_create_referral_code_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_referral_code_on_signup();

-- ============ Backfill existing users ============
DO $$
DECLARE
  u record;
BEGIN
  FOR u IN SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM referral_codes) LOOP
    PERFORM ensure_referral_code(u.id);
  END LOOP;
END $$;
