-- DESIGN-ONLY migration, intentionally outside supabase/migrations.
-- For isolated staging review. DO NOT apply to production.
-- Recheck against live cashfree_payment_intents constraints before promoting.
CREATE TABLE IF NOT EXISTS public.cashfree_checkout_claims_stage (
  checkout_key uuid PRIMARY KEY,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  payment_intent_id uuid NOT NULL UNIQUE,
  provider_order_id text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  country_code text NOT NULL DEFAULT 'IN' CHECK (country_code = 'IN'),
  status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','ready','reconcile_required')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ready' OR (response ? 'payment_session_id' AND response ? 'order_id'))
);
ALTER TABLE public.cashfree_checkout_claims_stage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cashfree_checkout_claims_stage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cashfree_checkout_claims_stage TO service_role;

-- State transition is serialised using the checkout_key unique constraint.
-- A duplicate intent_id/order_id with another checkout key returns reconcile_first.
CREATE OR REPLACE FUNCTION public.cf_stage_claim_checkout(
  p_key uuid, p_fingerprint text, p_intent uuid, p_order text, p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.cashfree_checkout_claims_stage%ROWTYPE; inserted uuid;
BEGIN
 IF p_key IS NULL OR p_intent IS NULL OR p_order IS NULL OR length(p_order)<5
    OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_amount IS NULL OR p_amount<=0 THEN
  RAISE EXCEPTION 'Invalid claim input';
 END IF;
 INSERT INTO public.cashfree_checkout_claims_stage(checkout_key,fingerprint,payment_intent_id,provider_order_id,amount)
 VALUES(p_key,p_fingerprint,p_intent,p_order,p_amount)
 ON CONFLICT DO NOTHING RETURNING checkout_key INTO inserted;
 IF inserted IS NOT NULL THEN RETURN jsonb_build_object('state','claimed'); END IF;
 SELECT * INTO v FROM public.cashfree_checkout_claims_stage WHERE checkout_key=p_key;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','reconcile_first'); END IF;
 IF v.fingerprint IS DISTINCT FROM p_fingerprint
    OR v.payment_intent_id IS DISTINCT FROM p_intent
    OR v.provider_order_id IS DISTINCT FROM p_order
    OR v.amount IS DISTINCT FROM p_amount
 THEN RETURN jsonb_build_object('state','conflict'); END IF;
 IF v.status='ready' AND v.response IS NOT NULL
 THEN RETURN jsonb_build_object('state','reused','response',v.response); END IF;
 IF v.status='creating' THEN RETURN jsonb_build_object('state','creating'); END IF;
 RETURN jsonb_build_object('state','reconcile_first');
END $$;
REVOKE ALL ON FUNCTION public.cf_stage_claim_checkout(uuid,text,uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cf_stage_claim_checkout(uuid,text,uuid,text,numeric) TO service_role;

-- Keep failed or timed-out provider outcomes in reconcile_required.
-- Do not create new intent/order without explicit server-side reconciliation.
