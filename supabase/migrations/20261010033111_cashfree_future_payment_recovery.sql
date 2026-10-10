-- Recovery is opt-in at rollout time: existing test intents are outside the boundary.
CREATE TABLE IF NOT EXISTS public.cashfree_recovery_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  enabled_since timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.cashfree_recovery_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cashfree_recovery_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.cashfree_recovery_settings TO service_role;
INSERT INTO public.cashfree_recovery_settings(singleton) VALUES(true) ON CONFLICT DO NOTHING;

ALTER TABLE public.cashfree_payment_intents
  ADD COLUMN IF NOT EXISTS recovery_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_last_error text;

CREATE OR REPLACE FUNCTION public.verify_cashfree_recovery_key(p_key text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT length(coalesce(p_key,'')) >= 32 AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name='cashfree_recovery_worker_key' AND decrypted_secret=p_key
  );
$$;
REVOKE ALL ON FUNCTION public.verify_cashfree_recovery_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cashfree_recovery_key(text) TO service_role;

CREATE OR REPLACE FUNCTION public.recover_cashfree_order_atomic(
 p_payment_intent_id uuid, p_gateway_order_id text, p_gateway_amount numeric, p_gateway_currency text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 i public.cashfree_payment_intents%ROWTYPE;
 settings public.cashfree_recovery_settings%ROWTYPE;
 q jsonb; result jsonb; expected numeric; quote_total numeric;
BEGIN
 IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    AND coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
   RAISE EXCEPTION 'Service role required';
 END IF;
 SELECT * INTO settings FROM public.cashfree_recovery_settings WHERE singleton;
 IF NOT FOUND OR NOT settings.enabled THEN
   RETURN jsonb_build_object('success',false,'error','Recovery disabled');
 END IF;
 SELECT * INTO i FROM public.cashfree_payment_intents WHERE id=p_payment_intent_id FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Intent not found'); END IF;
 IF i.country_code <> 'IN' OR i.created_at < settings.enabled_since THEN
   RETURN jsonb_build_object('success',false,'error','Intent outside recovery scope');
 END IF;
 IF i.completed_order_id IS NOT NULL THEN
   RETURN jsonb_build_object('success',true,'already_completed',true,'order_id',i.completed_order_id);
 END IF;
 IF i.status NOT IN ('created','pending','failed','processing') THEN
   RETURN jsonb_build_object('success',false,'error','Intent status not recoverable');
 END IF;
 IF i.status='processing' AND i.updated_at > now()-interval '10 minutes' THEN
   RETURN jsonb_build_object('success',false,'processing',true,'error','Active completion lease');
 END IF;
 IF p_gateway_order_id IS DISTINCT FROM i.cashfree_order_id OR p_gateway_currency IS DISTINCT FROM 'INR'
    OR i.currency IS DISTINCT FROM 'INR' OR p_gateway_amount IS NULL OR i.amount IS NULL
    OR p_gateway_amount::text IN ('NaN','Infinity','-Infinity') OR i.amount::text IN ('NaN','Infinity','-Infinity')
    OR p_gateway_amount <= 0 OR abs(p_gateway_amount-i.amount)>0.01 THEN
   RETURN jsonb_build_object('success',false,'error','Gateway payment identity or amount mismatch');
 END IF;
 -- Everything below runs in one subtransaction. A failed completion restores the original intent status.
 BEGIN
   IF i.metadata->>'payment_flow'='india_campaign' THEN
     UPDATE public.cashfree_payment_intents SET status='processing',updated_at=now() WHERE id=i.id;
     result:=public.complete_cashfree_campaign_order_atomic(i.id);
   ELSE
     q:=public.calculate_cashfree_checkout_quote(i.items,i.coupon_code,i.user_id,i.use_referral_wallet,'IN');
     IF NOT coalesce((q->>'success')::boolean,false) THEN
       RAISE EXCEPTION '%',coalesce(q->>'error','Recovery quote validation failed');
     END IF;
     quote_total:=(q->>'final_amount')::numeric;
     IF i.metadata->>'payment_method'='cod' THEN
       expected:=CASE WHEN coalesce((q->>'delivery_charge')::numeric,0)>0
         THEN (q->>'delivery_charge')::numeric ELSE 120 END;
       IF quote_total IS NULL OR quote_total < i.amount OR abs(expected-i.amount)>0.01
          OR i.metadata->>'quote_final' IS NULL
          OR abs(quote_total-(i.metadata->>'quote_final')::numeric)>0.01 THEN
         RAISE EXCEPTION 'Recovery COD quote changed';
       END IF;
     ELSIF quote_total IS NULL OR abs(quote_total-i.amount)>0.01 THEN
       RAISE EXCEPTION 'Recovery prepaid quote changed';
     END IF;
     UPDATE public.cashfree_payment_intents SET status='processing',updated_at=now() WHERE id=i.id;
     IF i.metadata->>'payment_method'='cod' THEN
       result:=public.complete_cashfree_cod_order_atomic(i.id,coalesce(i.customer_details->>'customer_name',''),
         coalesce(i.customer_details->>'customer_phone',''),i.delivery_address,i.items,i.coupon_code,
         i.special_instructions,i.user_id,i.use_referral_wallet,i.amount);
     ELSE
       result:=public.complete_cashfree_paid_order_atomic(i.id,coalesce(i.customer_details->>'customer_name',''),
         coalesce(i.customer_details->>'customer_phone',''),i.delivery_address,i.items,i.coupon_code,
         i.special_instructions,i.user_id,i.use_referral_wallet);
     END IF;
   END IF;
   IF NOT coalesce((result->>'success')::boolean,false) OR result->>'order_id' IS NULL THEN
     RAISE EXCEPTION '%',coalesce(result->>'error','Recovery order completion failed');
   END IF;
   UPDATE public.cashfree_payment_intents SET recovery_last_error=null,recovery_next_attempt_at=null WHERE id=i.id;
   RETURN result;
 EXCEPTION WHEN OTHERS THEN
   UPDATE public.cashfree_payment_intents SET recovery_last_error=left(SQLERRM,500),
     recovery_next_attempt_at=now()+interval '1 hour' WHERE id=i.id;
   RETURN jsonb_build_object('success',false,'error',SQLERRM);
 END;
EXCEPTION WHEN lock_not_available THEN
 RETURN jsonb_build_object('success',false,'processing',true,'error','Completion lock busy');
END;
$$;
REVOKE ALL ON FUNCTION public.recover_cashfree_order_atomic(uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_cashfree_order_atomic(uuid,text,numeric,text) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='cashfree_recovery_worker_key') THEN
   PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'cashfree_recovery_worker_key');
 END IF;
END $$;
SELECT cron.schedule('cashfree-future-payment-recovery','*/5 * * * *',$job$
 SELECT net.http_post(
   url:='https://ufxsthshyebahkwbmioe.supabase.co/functions/v1/cashfree-recover-payments',
   headers:=jsonb_build_object('Content-Type','application/json','x-gazi-recovery-key',
     (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cashfree_recovery_worker_key')),
   body:='{"action":"scan"}'::jsonb,timeout_milliseconds:=60000
 ) WHERE EXISTS(SELECT 1 FROM public.cashfree_recovery_settings WHERE singleton AND enabled);
$job$);
