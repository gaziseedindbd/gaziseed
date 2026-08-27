-- Keep referral wallet balance calculations consistent with the wallet ledger.
-- Wallet usage is a debit and must reduce the available referral balance.
-- This migration intentionally changes only the referral wallet balance RPC.

CREATE OR REPLACE FUNCTION public.get_referral_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('referral_reward','credit','refund')
        AND status IN ('available','completed','issued')
        THEN amount
      WHEN type IN ('wallet_usage','wallet_debit','debit','purchase')
        AND status IN ('available','completed','issued')
        THEN -ABS(amount)
      ELSE 0
    END
  ), 0)::numeric(12,2)
  FROM public.referral_wallet_transactions
  WHERE user_id = p_user_id;
$function$;
