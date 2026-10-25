-- Keep Bangladesh and India referral-wallet balances, configuration, rewards, and reversals separate.
-- This migration is a repository change only; reconcile Production migration history before applying it.

CREATE SCHEMA IF NOT EXISTS private;

-- Ensure branch columns exist even where the historical country-scope migration is missing from Git.
ALTER TABLE public.referral_settings
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'BD';
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'BD';
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'BD';
ALTER TABLE public.referral_rewards
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'BD';
ALTER TABLE public.referral_wallet_transactions
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'BD',
  ADD COLUMN IF NOT EXISTS order_id uuid;

CREATE TABLE IF NOT EXISTS public.referral_wallet_settings (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  country_code text NOT NULL DEFAULT 'BD' CHECK (country_code IN ('BD', 'IN')),
  enabled boolean NOT NULL DEFAULT true,
  min_purchase_amount numeric NOT NULL DEFAULT 2000 CHECK (min_purchase_amount >= 0),
  require_delivered boolean NOT NULL DEFAULT true,
  usage_basis text NOT NULL DEFAULT 'wallet_balance' CHECK (usage_basis IN ('wallet_balance', 'order_total')),
  max_usage_percent numeric NOT NULL DEFAULT 15 CHECK (max_usage_percent >= 0 AND max_usage_percent <= 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- id remains the logical singleton id; country_code differentiates branch settings.
ALTER TABLE public.referral_wallet_settings
  DROP CONSTRAINT IF EXISTS referral_wallet_settings_pkey;
ALTER TABLE public.referral_wallet_settings
  ADD CONSTRAINT referral_wallet_settings_pkey PRIMARY KEY (id, country_code);

ALTER TABLE public.referral_wallet_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referral_wallet_settings_branch_select
  ON public.referral_wallet_settings;
CREATE POLICY referral_wallet_settings_branch_select
  ON public.referral_wallet_settings
  FOR SELECT TO authenticated
  USING (
    public.can_access_country(country_code)
    OR country_code = public.current_visitor_country()
  );

-- Rebuild the ledger's check constraints to include the wallet-debit transaction type.
ALTER TABLE public.referral_wallet_transactions
  DROP CONSTRAINT IF EXISTS referral_wallet_transactions_type_check;
ALTER TABLE public.referral_wallet_transactions
  ADD CONSTRAINT referral_wallet_transactions_type_check
  CHECK (type IN ('referral_reward', 'wallet_usage', 'reversal'));

ALTER TABLE public.referral_wallet_transactions
  DROP CONSTRAINT IF EXISTS referral_wallet_transactions_status_check;
ALTER TABLE public.referral_wallet_transactions
  ADD CONSTRAINT referral_wallet_transactions_status_check
  CHECK (status IN ('available', 'reversed'));

ALTER TABLE public.referral_wallet_transactions
  DROP CONSTRAINT IF EXISTS referral_wallet_transactions_country_code_check;
ALTER TABLE public.referral_wallet_transactions
  ADD CONSTRAINT referral_wallet_transactions_country_code_check
  CHECK (country_code IN ('BD', 'IN'));

ALTER TABLE public.referral_codes
  DROP CONSTRAINT IF EXISTS referral_codes_country_code_check;
ALTER TABLE public.referral_codes
  ADD CONSTRAINT referral_codes_country_code_check CHECK (country_code IN ('BD', 'IN'));

ALTER TABLE public.referrals
  DROP CONSTRAINT IF EXISTS referrals_country_code_check;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_country_code_check CHECK (country_code IN ('BD', 'IN'));

ALTER TABLE public.referral_rewards
  DROP CONSTRAINT IF EXISTS referral_rewards_country_code_check;
ALTER TABLE public.referral_rewards
  ADD CONSTRAINT referral_rewards_country_code_check CHECK (country_code IN ('BD', 'IN'));

ALTER TABLE public.referral_settings
  DROP CONSTRAINT IF EXISTS referral_settings_country_code_check;
ALTER TABLE public.referral_settings
  ADD CONSTRAINT referral_settings_country_code_check CHECK (country_code IN ('BD', 'IN'));

-- This also supports one referral code per person per branch without breaking the existing code uniqueness.
DROP INDEX IF EXISTS public.referral_codes_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_country_unique
  ON public.referral_codes(user_id, country_code);
CREATE UNIQUE INDEX IF NOT EXISTS referral_settings_country_code_unique
  ON public.referral_settings(country_code);
CREATE INDEX IF NOT EXISTS referral_wallet_transactions_user_country_idx
  ON public.referral_wallet_transactions(user_id, country_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_wallet_transactions_order_id
  ON public.referral_wallet_transactions(order_id);

-- Correct legacy ledger branch labels from the authoritative parent record.
UPDATE public.referral_rewards rw
SET country_code = upper(r.country_code)
FROM public.referrals r
WHERE rw.referral_id = r.id
  AND rw.country_code IS DISTINCT FROM upper(r.country_code);

UPDATE public.referral_wallet_transactions tx
SET country_code = upper(r.country_code)
FROM public.referrals r
WHERE tx.referral_id = r.id
  AND tx.country_code IS DISTINCT FROM upper(r.country_code);

UPDATE public.referral_wallet_transactions tx
SET country_code = upper(o.country_code)
FROM public.orders o
WHERE tx.order_id = o.id
  AND tx.referral_id IS NULL
  AND tx.country_code IS DISTINCT FROM upper(o.country_code);

-- Seed each branch with the table's documented defaults; preserve any existing branch-specific settings.
INSERT INTO public.referral_wallet_settings
  (id, country_code, enabled, min_purchase_amount, require_delivered, usage_basis, max_usage_percent)
VALUES
  (1, 'BD', true, 2000, true, 'wallet_balance', 15),
  (1, 'IN', true, 2000, true, 'wallet_balance', 15)
ON CONFLICT (id, country_code) DO NOTHING;

-- Enforce the transaction country from its parent record, never from the default BD value.
CREATE OR REPLACE FUNCTION public.enforce_referral_wallet_transaction_country()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_referral_country text;
  v_order_country text;
  v_country text;
BEGIN
  IF NEW.referral_id IS NOT NULL THEN
    SELECT upper(r.country_code)
      INTO v_referral_country
    FROM public.referrals AS r
    WHERE r.id = NEW.referral_id;

    IF v_referral_country IS NULL THEN
      RAISE EXCEPTION 'Referral wallet transaction references an unknown referral'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    SELECT upper(o.country_code)
      INTO v_order_country
    FROM public.orders AS o
    WHERE o.id = NEW.order_id;

    IF v_order_country IS NULL THEN
      RAISE EXCEPTION 'Referral wallet transaction references an unknown order'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  IF v_referral_country IS NOT NULL
     AND v_order_country IS NOT NULL
     AND v_referral_country <> v_order_country THEN
    RAISE EXCEPTION 'Referral wallet transaction cannot cross country scopes'
      USING ERRCODE = '22023';
  END IF;

  v_country := COALESCE(v_referral_country, v_order_country, upper(trim(COALESCE(NEW.country_code, ''))));
  IF v_country NOT IN ('BD', 'IN') THEN
    RAISE EXCEPTION 'Unsupported referral wallet country code'
      USING ERRCODE = '22023';
  END IF;

  NEW.country_code := v_country;
  RETURN NEW;
END;
$function$;

-- This is a trigger-only helper, not a public RPC endpoint.
REVOKE ALL ON FUNCTION public.enforce_referral_wallet_transaction_country()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_referral_wallet_transaction_country
  ON public.referral_wallet_transactions;
CREATE TRIGGER trg_enforce_referral_wallet_transaction_country
BEFORE INSERT OR UPDATE OF referral_id, order_id, country_code
ON public.referral_wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_referral_wallet_transaction_country();

-- All balance calculations are explicitly country-scoped.
CREATE OR REPLACE FUNCTION public.get_referral_wallet_balance(
  p_user_id uuid,
  p_country_code text
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT GREATEST(
    0::numeric,
    COALESCE(SUM(
      CASE
        WHEN w.type = 'referral_reward' AND w.status = 'available' THEN w.amount
        WHEN w.type = 'wallet_usage' AND w.status = 'available' THEN -w.amount
        -- Reversal rows are audit records; the original row's status determines the balance.
        ELSE 0::numeric
      END
    ), 0)
  )::numeric(12,2)
  FROM public.referral_wallet_transactions AS w
  WHERE w.user_id = p_user_id
    AND w.country_code = upper(trim(COALESCE(p_country_code, '')));
$function$;

REVOKE ALL ON FUNCTION public.get_referral_wallet_balance(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_wallet_balance(uuid, text)
  TO service_role;

-- Preserve legacy signatures but make them operate only in the current branch.
CREATE OR REPLACE FUNCTION public.get_referral_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.get_referral_wallet_balance(p_user_id, public.current_visitor_country());
$function$;

REVOKE ALL ON FUNCTION public.get_referral_wallet_balance(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_wallet_balance(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_referral_wallet_balance()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 0::numeric
    ELSE public.get_referral_wallet_balance(auth.uid(), public.current_visitor_country())
  END;
$function$;

REVOKE ALL ON FUNCTION public.get_referral_wallet_balance()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_wallet_balance()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.is_referral_wallet_unlocked(
  p_user_id uuid,
  p_country_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders AS o
    JOIN public.referral_wallet_settings AS s
      ON s.country_code = upper(trim(COALESCE(p_country_code, '')))
     AND s.id = 1
    WHERE o.user_id = p_user_id
      AND upper(o.country_code) = upper(trim(COALESCE(p_country_code, '')))
      AND s.enabled IS TRUE
      AND (
        (
          s.require_delivered IS TRUE
          AND (
            COALESCE(o.status, '') IN ('delivered', 'completed')
            OR COALESCE(o.order_status, '') IN ('delivered', 'completed')
          )
        )
        OR (
          s.require_delivered IS NOT TRUE
          AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded')
          AND COALESCE(o.order_status, '') NOT IN ('cancelled', 'refunded')
        )
      )
      AND COALESCE(o.subtotal, o.total_amount, o.final_amount, o.grand_total, 0)
          >= s.min_purchase_amount
  );
$function$;

REVOKE ALL ON FUNCTION public.is_referral_wallet_unlocked(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_referral_wallet_unlocked(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.is_referral_wallet_unlocked(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.is_referral_wallet_unlocked(p_user_id, public.current_visitor_country());
$function$;

REVOKE ALL ON FUNCTION public.is_referral_wallet_unlocked(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_referral_wallet_unlocked(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_referral_wallet_max_usage(
  p_user_id uuid,
  p_order_total numeric,
  p_country_code text
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN s.enabled IS NOT TRUE
      OR public.is_referral_wallet_unlocked(p_user_id, s.country_code) IS NOT TRUE
      THEN 0::numeric
    WHEN public.get_referral_wallet_balance(p_user_id, s.country_code) <= 0
      THEN 0::numeric
    WHEN s.usage_basis = 'order_total' THEN LEAST(
      public.get_referral_wallet_balance(p_user_id, s.country_code),
      ROUND(GREATEST(COALESCE(p_order_total, 0), 0) * s.max_usage_percent / 100, 2)
    )
    ELSE ROUND(
      public.get_referral_wallet_balance(p_user_id, s.country_code) * s.max_usage_percent / 100,
      2
    )
  END
  FROM public.referral_wallet_settings AS s
  WHERE s.id = 1
    AND s.country_code = upper(trim(COALESCE(p_country_code, '')))
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_referral_wallet_max_usage(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_wallet_max_usage(uuid, numeric, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_referral_wallet_max_usage(
  p_user_id uuid,
  p_order_total numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.get_referral_wallet_max_usage(
    p_user_id, p_order_total, public.current_visitor_country()
  );
$function$;

REVOKE ALL ON FUNCTION public.get_referral_wallet_max_usage(uuid, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_wallet_max_usage(uuid, numeric)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_referral_wallet_summary(p_user_id uuid)
RETURNS TABLE (
  balance numeric,
  unlocked boolean,
  max_usable numeric,
  min_purchase_amount numeric,
  usage_percent numeric,
  enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    public.get_referral_wallet_balance(p_user_id, s.country_code) AS balance,
    public.is_referral_wallet_unlocked(p_user_id, s.country_code) AS unlocked,
    CASE
      WHEN NOT s.enabled OR NOT public.is_referral_wallet_unlocked(p_user_id, s.country_code)
        THEN 0::numeric
      WHEN s.usage_basis = 'order_total' THEN 0::numeric
      ELSE ROUND(
        GREATEST(public.get_referral_wallet_balance(p_user_id, s.country_code), 0)
          * s.max_usage_percent / 100,
        2
      )
    END AS max_usable,
    s.min_purchase_amount,
    s.max_usage_percent AS usage_percent,
    s.enabled
  FROM public.referral_wallet_settings AS s
  WHERE s.id = 1
    AND s.country_code = upper(public.current_visitor_country())
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_referral_wallet_summary(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_wallet_summary(uuid)
  TO service_role;

-- Keep the authenticated summary self-scoped and pass the chosen branch through every calculation.
CREATE OR REPLACE FUNCTION private.get_my_referral_wallet_summary(p_country_code text)
RETURNS TABLE (
  balance numeric,
  unlocked boolean,
  max_usable numeric,
  min_purchase_amount numeric,
  usage_percent numeric,
  enabled boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_country_code text := upper(trim(COALESCE(p_country_code, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF v_country_code NOT IN ('BD', 'IN') THEN
    RAISE EXCEPTION 'Unsupported country code' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    public.get_referral_wallet_balance(v_user_id, v_country_code),
    public.is_referral_wallet_unlocked(v_user_id, v_country_code),
    CASE
      WHEN s.enabled IS NOT TRUE
        OR public.is_referral_wallet_unlocked(v_user_id, v_country_code) IS NOT TRUE
        THEN 0::numeric
      WHEN s.usage_basis = 'order_total' THEN 0::numeric
      ELSE ROUND(
        GREATEST(public.get_referral_wallet_balance(v_user_id, v_country_code), 0)
          * s.max_usage_percent / 100,
        2
      )
    END,
    s.min_purchase_amount,
    s.max_usage_percent,
    s.enabled
  FROM public.referral_wallet_settings AS s
  WHERE s.id = 1
    AND s.country_code = v_country_code;
END;
$function$;

REVOKE ALL ON FUNCTION private.get_my_referral_wallet_summary(text)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_my_referral_wallet_summary(text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_referral_wallet_summary(p_country_code text)
RETURNS TABLE (
  balance numeric,
  unlocked boolean,
  max_usable numeric,
  min_purchase_amount numeric,
  usage_percent numeric,
  enabled boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT *
  FROM private.get_my_referral_wallet_summary(p_country_code);
$function$;

REVOKE ALL ON FUNCTION public.get_my_referral_wallet_summary(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_wallet_summary(text)
  TO authenticated;

-- Country-aware referral qualification means a delivery in one branch cannot unlock another branch's wallet.
CREATE OR REPLACE FUNCTION public.qualify_referral_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  r public.referrals%ROWTYPE;
  s public.referral_settings%ROWTYPE;
  prior_count integer;
  order_country text := upper(COALESCE(NEW.country_code, ''));
  order_subtotal numeric;
BEGIN
  IF NOT (
    COALESCE(NEW.status, '') IN ('delivered', 'completed')
    OR COALESCE(NEW.order_status, '') IN ('delivered', 'completed')
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL OR order_country NOT IN ('BD', 'IN') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s
  FROM public.referral_settings
  WHERE country_code = order_country
  ORDER BY id
  LIMIT 1;

  IF s.id IS NULL OR s.enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO r
  FROM public.referrals
  WHERE referred_id = NEW.user_id
    AND country_code = order_country
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO prior_count
  FROM public.orders AS o
  WHERE o.user_id = NEW.user_id
    AND o.id <> NEW.id
    AND upper(o.country_code) = order_country
    AND (
      COALESCE(o.status, '') IN ('delivered', 'completed')
      OR COALESCE(o.order_status, '') IN ('delivered', 'completed')
    );

  IF prior_count > 0 THEN
    RETURN NEW;
  END IF;

  order_subtotal := COALESCE(NEW.subtotal, NEW.total_amount, NEW.final_amount, 0);
  IF order_subtotal < COALESCE(s.min_order_amount, 0) THEN
    RETURN NEW;
  END IF;

  UPDATE public.referrals
  SET status = 'qualified',
      qualifying_order_id = NEW.id,
      updated_at = now()
  WHERE id = r.id
    AND status = 'pending';

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_and_issue_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  s public.referral_settings%ROWTYPE;
  o public.orders%ROWTYPE;
  reward numeric(12,2);
  rtype text;
  v_country text := upper(COALESCE(NEW.country_code, ''));
BEGIN
  IF NEW.status <> 'qualified' OR OLD.status = 'qualified' THEN
    RETURN NEW;
  END IF;

  IF v_country NOT IN ('BD', 'IN') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s
  FROM public.referral_settings
  WHERE country_code = v_country
  ORDER BY id
  LIMIT 1;

  IF s.id IS NULL OR s.enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id = NEW.qualifying_order_id
    AND upper(country_code) = v_country;

  IF NOT FOUND THEN
    -- Refuse to issue a reward if the qualifying order belongs to another branch.
    RETURN NEW;
  END IF;

  rtype := COALESCE(s.reward_type, 'fixed');
  IF rtype = 'percentage' THEN
    reward := COALESCE(o.subtotal, 0) * COALESCE(s.reward_value, s.reward_amount, 0) / 100.0;
  ELSE
    reward := COALESCE(s.reward_value, s.reward_amount, 0);
  END IF;

  reward := GREATEST(0, round(reward, 2));
  IF s.max_reward_per_referral IS NOT NULL THEN
    reward := LEAST(reward, s.max_reward_per_referral);
  END IF;

  UPDATE public.referrals
  SET reward_amount = reward,
      reward_type = rtype,
      reward_status = CASE WHEN reward > 0 THEN 'issued' ELSE 'none' END,
      rewarded_at = CASE WHEN reward > 0 THEN now() ELSE NULL END,
      status = CASE WHEN reward > 0 THEN 'rewarded' ELSE 'qualified' END,
      updated_at = now()
  WHERE id = NEW.id;

  IF reward > 0 THEN
    INSERT INTO public.referral_rewards(referral_id, user_id, amount, status, country_code)
    VALUES (NEW.id, NEW.referrer_id, reward, 'issued', v_country)
    ON CONFLICT (referral_id) DO NOTHING;

    INSERT INTO public.referral_wallet_transactions(
      user_id, referral_id, amount, type, status, description, country_code
    )
    VALUES (
      NEW.referrer_id, NEW.id, reward, 'referral_reward', 'available',
      'Referral reward for a qualifying order', v_country
    )
    ON CONFLICT (referral_id, type) WHERE type = 'referral_reward' DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_referral_reward_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  t public.referral_wallet_transactions%ROWTYPE;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IN ('qualified', 'rewarded') THEN
    FOR t IN
      SELECT *
      FROM public.referral_wallet_transactions
      WHERE referral_id = NEW.id
        AND type = 'referral_reward'
        AND status = 'available'
      FOR UPDATE
    LOOP
      INSERT INTO public.referral_wallet_transactions(
        user_id, referral_id, amount, type, status, description, country_code
      )
      VALUES (
        t.user_id, NEW.id, t.amount, 'reversal', 'reversed',
        'Referral reward reversed after referral cancellation', t.country_code
      );
      UPDATE public.referral_wallet_transactions
      SET status = 'reversed'
      WHERE id = t.id;
    END LOOP;

    UPDATE public.referral_rewards
    SET status = 'reversed', updated_at = now()
    WHERE referral_id = NEW.id
      AND status = 'issued';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_referral_wallet_usage_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tx public.referral_wallet_transactions%ROWTYPE;
BEGIN
  IF (
    COALESCE(NEW.status, '') IN ('cancelled', 'refunded')
    OR COALESCE(NEW.order_status, '') IN ('cancelled', 'refunded')
  )
  AND NOT (
    COALESCE(OLD.status, '') IN ('cancelled', 'refunded')
    OR COALESCE(OLD.order_status, '') IN ('cancelled', 'refunded')
  ) THEN
    FOR v_tx IN
      SELECT *
      FROM public.referral_wallet_transactions
      WHERE order_id = NEW.id
        AND type = 'wallet_usage'
        AND status = 'available'
      FOR UPDATE
    LOOP
      INSERT INTO public.referral_wallet_transactions(
        user_id, order_id, amount, type, status, description, country_code
      )
      VALUES (
        v_tx.user_id, NEW.id, v_tx.amount, 'reversal', 'reversed',
        'Referral wallet usage reversed after order cancellation/refund',
        upper(NEW.country_code)
      );

      UPDATE public.referral_wallet_transactions
      SET status = 'reversed'
      WHERE id = v_tx.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.issue_referral_reward_once(p_referral_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  r public.referrals%ROWTYPE;
  o public.orders%ROWTYPE;
  reward numeric(12,2);
  v_country text;
BEGIN
  SELECT * INTO r
  FROM public.referrals
  WHERE id = p_referral_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(r.reward_amount, 0) <= 0 THEN
    RETURN 0;
  END IF;

  v_country := upper(COALESCE(r.country_code, ''));
  IF v_country NOT IN ('BD', 'IN') THEN
    RETURN 0;
  END IF;

  IF r.qualifying_order_id IS NOT NULL THEN
    SELECT * INTO o
    FROM public.orders
    WHERE id = r.qualifying_order_id
      AND upper(country_code) = v_country;
    IF NOT FOUND THEN
      RETURN 0;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.referral_wallet_transactions
    WHERE referral_id = p_referral_id
      AND type = 'referral_reward'
  ) THEN
    RETURN 0;
  END IF;

  reward := round(r.reward_amount::numeric, 2);
  INSERT INTO public.referral_wallet_transactions(
    user_id, referral_id, amount, type, status, description, country_code
  )
  VALUES (
    r.referrer_id, p_referral_id, reward, 'referral_reward', 'available',
    'Referral reward for a qualifying order', v_country
  )
  ON CONFLICT (referral_id, type) WHERE type = 'referral_reward' DO NOTHING;

  RETURN reward;
END;
$function$;

-- Country-aware referral codes let the same account refer customers in either branch.
CREATE OR REPLACE FUNCTION public.ensure_referral_code(
  p_user_id uuid,
  p_country_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_country text := upper(trim(COALESCE(p_country_code, '')));
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required' USING ERRCODE = '22023';
  END IF;
  IF v_country NOT IN ('BD', 'IN') THEN
    RAISE EXCEPTION 'Unsupported country code' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.referral_codes
    WHERE user_id = p_user_id AND country_code = v_country
  ) THEN
    INSERT INTO public.referral_codes(user_id, code, country_code)
    VALUES (p_user_id, public.generate_referral_code(), v_country)
    ON CONFLICT (user_id, country_code) DO NOTHING;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_metadata_country text;
  v_country text;
BEGIN
  SELECT upper(u.raw_user_meta_data->>'country_code')
    INTO v_metadata_country
  FROM auth.users AS u
  WHERE u.id = p_user_id;

  v_country := CASE
    WHEN v_metadata_country IN ('BD', 'IN') THEN v_metadata_country
    ELSE upper(public.current_visitor_country())
  END;

  IF v_country NOT IN ('BD', 'IN') THEN
    v_country := 'BD';
  END IF;

  PERFORM public.ensure_referral_code(p_user_id, v_country);
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_referral_code(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code(uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.ensure_referral_code(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_my_referral_code(p_country_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_country text := upper(trim(COALESCE(p_country_code, '')));
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF v_country NOT IN ('BD', 'IN') THEN
    RAISE EXCEPTION 'Unsupported country code' USING ERRCODE = '22023';
  END IF;

  SELECT code INTO v_code
  FROM public.referral_codes
  WHERE user_id = v_user_id
    AND country_code = v_country
    AND is_active IS TRUE
  LIMIT 1;

  IF v_code IS NULL THEN
    PERFORM public.ensure_referral_code(v_user_id, v_country);
    SELECT code INTO v_code
    FROM public.referral_codes
    WHERE user_id = v_user_id
      AND country_code = v_country
      AND is_active IS TRUE
    LIMIT 1;
  END IF;

  RETURN v_code;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_or_create_my_referral_code(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_referral_code(text)
  TO authenticated;

-- Align the legacy auth trigger with the user's selected branch.
CREATE OR REPLACE FUNCTION public.create_referral_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_referral_code text;
  v_referrer public.referral_codes%ROWTYPE;
  v_enabled boolean;
  v_metadata_country text;
  v_country text;
BEGIN
  v_referral_code := NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), '');
  IF v_referral_code IS NULL THEN
    RETURN NEW;
  END IF;

  v_metadata_country := upper(NEW.raw_user_meta_data->>'country_code');
  v_country := CASE
    WHEN v_metadata_country IN ('BD', 'IN') THEN v_metadata_country
    ELSE upper(public.current_visitor_country())
  END;
  IF v_country NOT IN ('BD', 'IN') THEN
    v_country := 'BD';
  END IF;

  SELECT enabled INTO v_enabled
  FROM public.referral_settings
  WHERE country_code = v_country
  ORDER BY id
  LIMIT 1;

  IF COALESCE(v_enabled, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_referrer
  FROM public.referral_codes
  WHERE code = v_referral_code
    AND country_code = v_country
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_referrer.user_id = NEW.id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.referrals(referrer_id, referred_id, referral_code_id, status, country_code)
  VALUES (v_referrer.user_id, NEW.id, v_referrer.id, 'pending', v_country)
  ON CONFLICT (referred_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Referral attribution must not block account creation.
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_referral_on_signup()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
