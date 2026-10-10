-- Append-only records from rollout onward. No historical intents are reconciled or backfilled.
CREATE TABLE public.payment_security_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 country_code text NOT NULL CHECK (country_code IN ('IN','BD')),
 order_id uuid,
 payment_intent_id uuid,
 actor_type text NOT NULL CHECK (actor_type IN ('admin','system')),
 actor_id uuid,
 event_type text NOT NULL CHECK (event_type IN ('verification','dispatch','payment_completed','recovery_attempt','recovery_failed','recovery_completed','cod_due_collected')),
 outcome text NOT NULL CHECK (outcome IN ('success','blocked','started')),
 details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object' AND octet_length(details::text)<=4096),
 event_key text UNIQUE,
 CHECK ((actor_type='admin' AND actor_id IS NOT NULL) OR (actor_type='system' AND actor_id IS NULL))
);
-- IDs deliberately have no cascading FKs: deleting an order/user must not delete its history.
CREATE INDEX payment_audit_order_time ON public.payment_security_audit_log(order_id,created_at DESC,id DESC);
CREATE INDEX payment_audit_intent_time ON public.payment_security_audit_log(payment_intent_id,created_at DESC,id DESC);
ALTER TABLE public.payment_security_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_security_audit_log FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.payment_security_audit_log TO authenticated;
GRANT SELECT,INSERT ON public.payment_security_audit_log TO service_role;
CREATE POLICY payment_audit_admin_read ON public.payment_security_audit_log FOR SELECT TO authenticated
 USING ((SELECT public.is_admin()) AND public.can_access_country(country_code));

CREATE FUNCTION public.reject_payment_audit_mutation() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Payment audit records are append-only'; END;
$$;
REVOKE ALL ON FUNCTION public.reject_payment_audit_mutation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER payment_audit_immutable BEFORE UPDATE OR DELETE ON public.payment_security_audit_log
 FOR EACH ROW EXECUTE FUNCTION public.reject_payment_audit_mutation();
CREATE TRIGGER payment_audit_no_truncate BEFORE TRUNCATE ON public.payment_security_audit_log
 FOR EACH STATEMENT EXECUTE FUNCTION public.reject_payment_audit_mutation();

-- Server-only RPC: the Edge handler authenticates the admin and validates gateway/refunds first.
CREATE FUNCTION public.dispatch_verified_cashfree_order(
 p_order_id uuid,p_actor_id uuid,p_intent_id uuid,p_gateway_order_id text,p_total numeric,p_advance numeric,p_due numeric,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; i public.cashfree_payment_intents%ROWTYPE;
BEGIN
 IF coalesce(auth.jwt()->>'role','') <> 'service_role'
    AND coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' THEN
   RAISE EXCEPTION 'Service role required';
 END IF;
 IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Verified admin identity required'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.country_code<>'IN' OR o.status<>'packed'
   OR o.final_amount IS DISTINCT FROM p_total
   OR o.payment_advance_amount IS DISTINCT FROM p_advance
   OR o.payment_due_amount IS DISTINCT FROM p_due THEN
   RETURN jsonb_build_object('success',false,'error','Verified order changed. Hold dispatch.');
 END IF;
 SELECT * INTO i FROM public.cashfree_payment_intents WHERE id=p_intent_id FOR SHARE;
 IF NOT FOUND OR i.completed_order_id IS DISTINCT FROM o.id OR i.status<>'completed' OR i.currency<>'INR' OR i.country_code<>'IN' OR i.cashfree_order_id IS DISTINCT FROM p_gateway_order_id
    OR (SELECT count(*) FROM public.cashfree_payment_intents WHERE completed_order_id=o.id AND status='completed')<>1
    OR i.amount IS NULL OR i.amount::text IN ('NaN','Infinity','-Infinity') OR i.amount<=0
    OR o.final_amount IS NULL OR o.final_amount::text IN ('NaN','Infinity','-Infinity') OR o.final_amount<=0
    OR (i.metadata->>'payment_method'='cod' AND (p_advance IS NULL OR p_due IS NULL OR p_advance::text IN ('NaN','Infinity','-Infinity') OR p_due::text IN ('NaN','Infinity','-Infinity') OR o.payment_method<>'cod' OR p_due<0 OR abs(p_advance+p_due-p_total)>0.01 OR abs(i.amount-p_advance)>0.01))
    OR (coalesce(i.metadata->>'payment_method','')<>'cod' AND (p_due<>0 OR abs(i.amount-p_total)>0.01)) THEN
   RETURN jsonb_build_object('success',false,'error','Verified payment changed. Hold dispatch.');
 END IF;
 -- The existing dispatch guard checks the fresh timestamp and trusted request role too.
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 UPDATE public.orders SET status='shipped',internal_notes=left(coalesce(p_note,''),2000),cashfree_dispatch_verified_at=clock_timestamp() WHERE id=o.id;
 INSERT INTO public.payment_security_audit_log(country_code,order_id,payment_intent_id,actor_type,actor_id,event_type,outcome,details)
 VALUES('IN',o.id,i.id,'admin',p_actor_id,'dispatch','success',jsonb_build_object('from_status',o.status,'to_status','shipped','total_amount',p_total,'advance_amount',p_advance,'due_amount',p_due,'currency','INR'));
 RETURN jsonb_build_object('success',true,'id',o.id,'status','shipped');
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_verified_cashfree_order(uuid,uuid,uuid,text,numeric,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_verified_cashfree_order(uuid,uuid,uuid,text,numeric,numeric,numeric,text) TO service_role;

-- Capture actual persisted intent transitions in their original transaction.
CREATE FUNCTION public.audit_cashfree_intent_transition() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.country_code IS DISTINCT FROM 'IN' THEN RETURN NEW; END IF;
 IF NEW.recovery_attempts>OLD.recovery_attempts THEN
   INSERT INTO public.payment_security_audit_log(country_code,order_id,payment_intent_id,actor_type,event_type,outcome,details,event_key)
   VALUES('IN',NEW.completed_order_id,NEW.id,'system','recovery_attempt','started',jsonb_build_object('attempt',NEW.recovery_attempts,'intent_status',NEW.status), 'recovery_attempt:'||NEW.id||':'||NEW.recovery_attempts) ON CONFLICT(event_key) DO NOTHING;
 END IF;
 IF NEW.recovery_last_error IS NOT NULL AND NEW.recovery_attempts>0 THEN
   INSERT INTO public.payment_security_audit_log(country_code,order_id,payment_intent_id,actor_type,event_type,outcome,details,event_key)
   VALUES('IN',NEW.completed_order_id,NEW.id,'system','recovery_failed','blocked',jsonb_build_object('attempt',NEW.recovery_attempts,'reason',CASE WHEN NEW.recovery_last_error IN ('Cashfree has not confirmed PAID','Gateway payment identity or amount mismatch','Refund or refund processing found','Gateway verification unavailable','Refund verification unavailable','Recovery COD quote changed','Recovery prepaid quote changed','Active completion lease','Completion lock busy') THEN NEW.recovery_last_error ELSE 'Recovery could not complete; manual review required' END), 'recovery_failed:'||NEW.id||':'||NEW.recovery_attempts) ON CONFLICT(event_key) DO NOTHING;
 END IF;
 IF NEW.completed_order_id IS NOT NULL AND OLD.completed_order_id IS NULL AND NEW.status='completed' THEN
   INSERT INTO public.payment_security_audit_log(country_code,order_id,payment_intent_id,actor_type,event_type,outcome,details,event_key)
   VALUES('IN',NEW.completed_order_id,NEW.id,'system','payment_completed','success',jsonb_build_object('amount',NEW.amount,'currency',NEW.currency,'payment_method',NEW.metadata->>'payment_method'), 'payment_completed:'||NEW.id) ON CONFLICT(event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_cashfree_intent_transition() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cashfree_intent_payment_audit AFTER UPDATE OF recovery_attempts,recovery_last_error,completed_order_id,status
 ON public.cashfree_payment_intents FOR EACH ROW EXECUTE FUNCTION public.audit_cashfree_intent_transition();

-- Authorize against the order before joining server-only intents, including recovery history before order creation.
CREATE FUNCTION public.get_order_payment_audit(p_order_id uuid,p_before_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
 RETURNS SETOF public.payment_security_audit_log LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE country text;
BEGIN
 IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT country_code INTO country FROM public.orders WHERE id=p_order_id;
 IF NOT FOUND OR public.can_access_country(country) IS NOT TRUE THEN RAISE EXCEPTION 'Order outside current admin branch'; END IF;
 IF (p_before_at IS NULL) <> (p_before_id IS NULL) THEN RAISE EXCEPTION 'Incomplete audit cursor'; END IF;
 RETURN QUERY SELECT a.* FROM public.payment_security_audit_log a
 WHERE a.country_code=country AND (a.order_id=p_order_id OR a.payment_intent_id IN
   (SELECT id FROM public.cashfree_payment_intents WHERE completed_order_id=p_order_id AND country_code=country))
 AND (p_before_at IS NULL OR (a.created_at,a.id)<(p_before_at,p_before_id))
 ORDER BY a.created_at DESC,a.id DESC LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION public.get_order_payment_audit(uuid,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_order_payment_audit(uuid,timestamptz,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.collect_cod_due_atomic(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_collected numeric := 0;
  v_total numeric := 0;
  v_country text;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_country := upper(coalesce(v_order.country_code, 'BD'));
  IF v_country <> 'IN' OR NOT public.can_access_country(v_country) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is outside the current admin branch');
  END IF;

  IF lower(coalesce(v_order.payment_method, '')) <> 'cod' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only India COD orders can be settled here');
  END IF;

  IF lower(coalesce(v_order.status, '')) <> 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'COD due can only be collected after delivery');
  END IF;

  IF v_order.payment_due_amount IS NULL OR v_order.payment_advance_amount IS NULL
     OR v_order.final_amount IS NULL OR v_order.final_amount<=0
     OR v_order.payment_due_amount<0 OR v_order.payment_advance_amount<0
     OR v_order.payment_due_amount::text IN ('NaN','Infinity','-Infinity')
     OR v_order.payment_advance_amount::text IN ('NaN','Infinity','-Infinity')
     OR v_order.final_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RETURN jsonb_build_object('success',false,'error','Invalid COD balance. Hold settlement.');
  END IF;
  v_collected := v_order.payment_due_amount;
  IF v_collected <= 0 THEN
    IF lower(coalesce(v_order.payment_status, '')) = 'paid' THEN
      RETURN jsonb_build_object('success', true, 'already_settled', true, 'order_id', v_order.id, 'due_amount', 0);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'No outstanding COD due amount');
  END IF;

  v_total := v_order.final_amount;
  IF abs(v_order.payment_advance_amount+v_collected-v_total)>0.01 THEN
    RETURN jsonb_build_object('success',false,'error','COD advance and due do not match total. Hold settlement.');
  END IF;

  UPDATE public.orders
  SET payment_status = 'paid',
      payment_due_amount = 0
  WHERE id = v_order.id;

  INSERT INTO public.admin_audit_log(admin_user_id, admin_email, action, details, country_code)
  VALUES (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', 'unknown'),
    'collect_cod_due',
    jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'amount_collected', v_collected,
      'total_amount', v_total,
      'payment_advance_amount', coalesce(v_order.payment_advance_amount, 0)
    ),
    v_country
  );

  INSERT INTO public.payment_security_audit_log(country_code,order_id,actor_type,actor_id,event_type,outcome,details)
  VALUES(v_country,v_order.id,'admin',auth.uid(),'cod_due_collected','success',jsonb_build_object('amount_collected',v_collected,'total_amount',v_total,'advance_amount',v_order.payment_advance_amount,'due_amount',0,'currency','INR'));

  RETURN jsonb_build_object(
    'success', true,
    'already_settled', false,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'amount_collected', v_collected,
    'total_amount', v_total,
    'paid_amount', greatest(v_total - 0, 0),
    'due_amount', 0,
    'currency', 'INR'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


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
$$;
REVOKE ALL ON FUNCTION public.recover_cashfree_order_atomic(uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_cashfree_order_atomic(uuid,text,numeric,text) TO service_role;

