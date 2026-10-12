-- Allow gateway-verified paid intents through existing guarded Cashfree recovery.
-- Recovery still validates live Cashfree order ID, INR, amount, refund status and current quote.
-- This migration is on the review branch only; it has NOT been applied to Supabase production.
CREATE OR REPLACE FUNCTION public.recover_cashfree_order_atomic(p_payment_intent_id uuid, p_gateway_order_id text, p_gateway_amount numeric, p_gateway_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 IF i.status NOT IN ('created','pending','failed','processing','paid') THEN
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
   INSERT INTO public.payment_security_audit_log(country_code,order_id,payment_intent_id,actor_type,event_type,outcome,details,event_key)
   VALUES('IN',(result->>'order_id')::uuid,i.id,'system','recovery_completed','success',jsonb_build_object('attempt',i.recovery_attempts,'amount',p_gateway_amount,'currency','INR'),'recovery_completed:'||i.id) ON CONFLICT(event_key) DO NOTHING;
   RETURN result;
 EXCEPTION WHEN OTHERS THEN
   UPDATE public.cashfree_payment_intents SET recovery_last_error=left(SQLERRM,500),
     recovery_next_attempt_at=now()+interval '1 hour' WHERE id=i.id;
   RETURN jsonb_build_object('success',false,'error',SQLERRM);
 END;
EXCEPTION WHEN lock_not_available THEN
 RETURN jsonb_build_object('success',false,'processing',true,'error','Completion lock busy');
END;
$function$

