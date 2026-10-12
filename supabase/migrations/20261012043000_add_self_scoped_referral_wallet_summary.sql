-- Authenticated customers can read only their own referral wallet summary.
-- Keep the legacy parameterized summary RPC restricted to service_role.
CREATE OR REPLACE FUNCTION public.get_my_referral_wallet_summary()
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
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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
  WHERE s.id = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_referral_wallet_summary()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_wallet_summary()
  TO authenticated;
