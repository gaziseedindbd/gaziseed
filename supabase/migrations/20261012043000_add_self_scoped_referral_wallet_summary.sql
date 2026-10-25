-- Keep the wallet summary self-scoped and keep SECURITY DEFINER code out of the exposed public schema.
-- The public RPC is SECURITY INVOKER and delegates to a private-schema function.
-- Apply only after reconciling the production migration history.

CREATE SCHEMA IF NOT EXISTS private;

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
    public.get_referral_wallet_balance(v_user_id) AS balance,
    public.is_referral_wallet_unlocked(v_user_id) AS unlocked,
    CASE
      WHEN NOT s.enabled OR NOT public.is_referral_wallet_unlocked(v_user_id) THEN 0::numeric
      WHEN s.usage_basis = 'order_total' THEN 0::numeric
      ELSE ROUND(
        GREATEST(public.get_referral_wallet_balance(v_user_id), 0)
        * s.max_usage_percent / 100,
        2
      )
    END AS max_usable,
    s.min_purchase_amount,
    s.max_usage_percent AS usage_percent,
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
