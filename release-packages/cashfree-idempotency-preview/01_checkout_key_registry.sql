-- Preview-only migration. DO NOT apply to production without review.
-- A caller with service_role must own these RPCs. No customer access.
CREATE TABLE IF NOT EXISTS public.cashfree_checkout_dedup (
  checkout_key uuid PRIMARY KEY,
  fingerprint text NOT NULL CHECK (length(fingerprint)=64),
  intent_id uuid NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating','ready','failed')),
  session_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cashfree_checkout_dedup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cashfree_checkout_dedup FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.claim_cashfree_checkout_key(
  p_key uuid, p_fingerprint text, p_intent_id uuid, p_amount numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.cashfree_checkout_dedup%ROWTYPE;
BEGIN
  IF p_key IS NULL OR p_intent_id IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid checkout claim';
  END IF;
  INSERT INTO public.cashfree_checkout_dedup(checkout_key,fingerprint,intent_id,amount)
  VALUES(p_key,p_fingerprint,p_intent_id,p_amount)
  ON CONFLICT (checkout_key) DO NOTHING;
  SELECT * INTO v FROM public.cashfree_checkout_dedup WHERE checkout_key=p_key;
  IF v.fingerprint IS DISTINCT FROM p_fingerprint OR v.amount IS DISTINCT FROM p_amount THEN
    RETURN jsonb_build_object('state','conflict');
  END IF;
  IF v.intent_id=p_intent_id THEN RETURN jsonb_build_object('state','claimed'); END IF;
  IF v.status='ready' AND v.session_response IS NOT NULL THEN
    RETURN jsonb_build_object('state','reused','response',v.session_response);
  END IF;
  RETURN jsonb_build_object('state',v.status);
END $$;
CREATE OR REPLACE FUNCTION public.finish_cashfree_checkout_key(
  p_key uuid,p_intent_id uuid,p_response jsonb,p_success boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  IF p_success AND (p_response->>'payment_session_id' IS NULL OR p_response->>'order_id' IS NULL)
     THEN RETURN false; END IF;
  UPDATE public.cashfree_checkout_dedup
  SET status=CASE WHEN p_success THEN 'ready' ELSE 'failed' END,
      session_response=CASE WHEN p_success THEN p_response ELSE NULL END,
      updated_at=now()
  WHERE checkout_key=p_key AND intent_id=p_intent_id AND status='creating';
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n=1;
END $$;
REVOKE ALL ON FUNCTION public.claim_cashfree_checkout_key(uuid,text,uuid,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_cashfree_checkout_key(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cashfree_checkout_key(uuid,text,uuid,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_cashfree_checkout_key(uuid,uuid,jsonb,boolean) TO service_role;
