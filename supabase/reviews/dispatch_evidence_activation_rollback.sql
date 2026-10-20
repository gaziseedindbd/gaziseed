-- Controlled rollback only, after holding dispatch and reverting the paired API. Keeps private evidence for investigation.
CREATE OR REPLACE FUNCTION public.dispatch_verified_cashfree_order(p_order_id uuid, p_actor_id uuid, p_intent_id uuid, p_gateway_order_id text, p_total numeric, p_advance numeric, p_due numeric, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.guard_cashfree_verified_dispatch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Prevent changing an India Cashfree order into another branch to bypass shipment controls.
  IF upper(coalesce(OLD.country_code, '')) = 'IN'
    AND NEW.country_code IS DISTINCT FROM OLD.country_code
    AND (
      lower(coalesce(OLD.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(OLD.payment_status, '')) IN ('paid', 'partially_paid')
      OR coalesce(OLD.payment_advance_amount, 0) > 0
      OR EXISTS (SELECT 1 FROM public.cashfree_payment_intents i WHERE i.completed_order_id = OLD.id)
    )
    AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
  THEN
    RAISE EXCEPTION 'Cannot change branch of India Cashfree-paid order';
  END IF;

  IF (upper(coalesce(NEW.country_code, '')) = 'IN'
      OR upper(coalesce(OLD.country_code, '')) = 'IN')
    AND lower(coalesce(OLD.status, '')) NOT IN ('shipped', 'delivered')
    AND lower(coalesce(NEW.status, '')) IN ('shipped', 'delivered')
    AND (
      lower(coalesce(NEW.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(OLD.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(NEW.payment_status, '')) IN ('paid', 'partially_paid')
      OR lower(coalesce(OLD.payment_status, '')) IN ('paid', 'partially_paid')
      OR coalesce(NEW.payment_advance_amount, 0) > 0
      OR coalesce(OLD.payment_advance_amount, 0) > 0
      OR EXISTS (
        SELECT 1 FROM public.cashfree_payment_intents i
        WHERE i.completed_order_id = NEW.id
      )
    )
  THEN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
       OR NEW.cashfree_dispatch_verified_at IS NULL
       OR NEW.cashfree_dispatch_verified_at < now() - interval '5 minutes'
       OR NOT EXISTS (
          SELECT 1 FROM public.cashfree_payment_intents i
          WHERE i.completed_order_id = NEW.id
            AND i.status = 'completed'
            AND upper(i.currency) = 'INR'
       )
    THEN
      RAISE EXCEPTION 'India paid orders require fresh verified Cashfree payment before dispatch'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
DROP TRIGGER IF EXISTS guard_verified_dispatch_history_duplicates ON public.order_status_history;
DROP TRIGGER IF EXISTS zzz_guard_cashfree_verified_dispatch ON public.orders;
CREATE TRIGGER zzz_guard_cashfree_verified_dispatch BEFORE UPDATE OF status,order_status,country_code ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_cashfree_verified_dispatch();


DROP TRIGGER IF EXISTS register_cashfree_dispatch_subject ON public.orders;
