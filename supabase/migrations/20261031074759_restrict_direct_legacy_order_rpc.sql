-- Browser checkout uses create_order_with_referral_wallet, whose SECURITY
-- DEFINER body validates p_user_id against auth.uid(). Offer checkout uses
-- the separate 13-argument create_order overload and remains public.
-- The 9-argument overload accepts p_user_id directly and has no equivalent
-- ownership check, so keep it callable only by trusted server-side callers.
REVOKE EXECUTE ON FUNCTION public.create_order(
  text,
  text,
  text,
  jsonb,
  text,
  uuid,
  text,
  text,
  uuid
) FROM PUBLIC, anon, authenticated;
