-- TEST PROJECT ONLY. Never deploy to production.
-- This atomic writer must be called ONLY by a trusted server-side function AFTER
-- independently fetching and verifying Cashfree provider order + payment attempts.
-- It does not perform provider verification itself.
CREATE OR REPLACE FUNCTION public.cf_stage_finish_verified_checkout(
 p_key uuid, p_intent uuid, p_provider_order text,
 p_fingerprint text, p_amount numeric, p_response jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.cashfree_checkout_claims_stage%ROWTYPE;
BEGIN
 IF p_key IS NULL OR p_intent IS NULL OR p_provider_order IS NULL
 OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$'
 OR p_amount IS NULL OR p_amount <= 0
 OR jsonb_typeof(p_response) IS DISTINCT FROM 'object'
 OR nullif(p_response->>'payment_session_id','') IS NULL
 OR p_response->>'order_id' IS DISTINCT FROM p_provider_order
 THEN RETURN jsonb_build_object('state','reconcile_first'); END IF;
 SELECT * INTO v FROM public.cashfree_checkout_claims_stage
 WHERE checkout_key=p_key FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','not_found'); END IF;
 IF v.payment_intent_id IS DISTINCT FROM p_intent
 OR v.provider_order_id IS DISTINCT FROM p_provider_order
 OR v.fingerprint IS DISTINCT FROM p_fingerprint
 OR v.amount IS DISTINCT FROM p_amount
 OR v.currency <> 'INR' OR v.country_code <> 'IN'
 THEN RETURN jsonb_build_object('state','conflict'); END IF;
 IF v.status='ready' THEN
  IF v.response IS NOT DISTINCT FROM p_response
  THEN RETURN jsonb_build_object('state','already_ready'); END IF;
  RETURN jsonb_build_object('state','conflict');
 END IF;
 IF v.status<>'creating' THEN RETURN jsonb_build_object('state','reconcile_first'); END IF;
 UPDATE public.cashfree_checkout_claims_stage
 SET status='ready',response=p_response,updated_at=now()
 WHERE checkout_key=p_key AND status='creating';
 RETURN jsonb_build_object('state','ready');
END $$;
REVOKE ALL ON FUNCTION public.cf_stage_finish_verified_checkout(uuid,uuid,text,text,numeric,jsonb)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cf_stage_finish_verified_checkout(uuid,uuid,text,text,numeric,jsonb) TO service_role;
