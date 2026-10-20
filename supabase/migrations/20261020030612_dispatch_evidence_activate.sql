-- Phase D: activate atomically ONLY AFTER the paired API/writer is configured and tested.
DO $preflight$ BEGIN
 IF md5(pg_get_functiondef('public.dispatch_verified_cashfree_order(uuid,uuid,uuid,text,numeric,numeric,numeric,text)'::regprocedure))<>'c6682c38364eab2915c1cf15d38ea4c5'
 OR md5(pg_get_functiondef('public.guard_cashfree_verified_dispatch()'::regprocedure))<>'77bb14610ab91475941604e614e92a86' THEN
  RAISE EXCEPTION 'Dispatch implementation drift: re-audit before activation';
 END IF;
 IF to_regclass('cashfree_dispatch_private.evidence') IS NULL THEN RAISE EXCEPTION 'Evidence preparation missing'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.guard_cashfree_verified_dispatch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE protected boolean; authorized boolean;
BEGIN
 protected := EXISTS(SELECT 1 FROM cashfree_dispatch_private.subjects WHERE order_id=OLD.id) OR (upper(coalesce(OLD.country_code,''))='IN' OR upper(coalesce(NEW.country_code,''))='IN') AND (
 lower(coalesce(OLD.payment_method,'')) IN ('cashfree','online') OR lower(coalesce(NEW.payment_method,'')) IN ('cashfree','online')
 OR lower(coalesce(OLD.payment_status,'')) IN ('paid','partially_paid') OR lower(coalesce(NEW.payment_status,'')) IN ('paid','partially_paid')
 OR OLD.payment_advance_amount>0 OR NEW.payment_advance_amount>0
 OR EXISTS(SELECT 1 FROM public.cashfree_payment_intents WHERE completed_order_id=OLD.id));
 authorized := EXISTS(SELECT 1 FROM cashfree_dispatch_private.authorizations WHERE order_id=OLD.id AND transaction_id=txid_current());
 IF NEW.cashfree_dispatch_verified_at IS DISTINCT FROM OLD.cashfree_dispatch_verified_at AND NOT authorized THEN
  RAISE EXCEPTION 'Protected dispatch timestamp' USING ERRCODE='42501';
 END IF;
 IF protected AND NEW.country_code IS DISTINCT FROM OLD.country_code THEN
  RAISE EXCEPTION 'Protected India payment branch' USING ERRCODE='42501';
 END IF;
 IF protected AND lower(coalesce(OLD.status,'')) NOT IN ('shipped','delivered')
 AND (lower(coalesce(NEW.status,'')) IN ('shipped','delivered') OR lower(coalesce(NEW.order_status,'')) IN ('shipped','delivered'))
 AND (NOT authorized OR NEW.cashfree_dispatch_verified_at IS NULL OR NEW.cashfree_dispatch_verified_at<clock_timestamp()-interval '5 minutes'
 OR NEW.cashfree_dispatch_verified_at>clock_timestamp()+interval '1 minute') THEN
  RAISE EXCEPTION 'Fresh independently verified evidence required' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.dispatch_verified_cashfree_order(p_order_id uuid,p_actor_id uuid,p_intent_id uuid,p_gateway_order_id text,p_total numeric,p_advance numeric,p_due numeric,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; i public.cashfree_payment_intents%ROWTYPE; e cashfree_dispatch_private.evidence%ROWTYPE;
 a public.admin_users%ROWTYPE; branch text; expected numeric; cod boolean; v_history_id uuid;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Actual service role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.admin_users WHERE user_id=p_actor_id AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active India admin required' USING ERRCODE='42501'; END IF;
 branch:=upper(coalesce(a.country_code,''));
 IF a.role='master_admin' THEN
  SELECT upper(country_code) INTO branch FROM public.admin_branch_context WHERE user_id=p_actor_id FOR SHARE;
 END IF;
 IF branch IS DISTINCT FROM 'IN' THEN RAISE EXCEPTION 'Active India admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.country_code<>'IN' OR o.status<>'packed' OR o.final_amount IS DISTINCT FROM p_total
 OR o.payment_advance_amount IS DISTINCT FROM p_advance OR o.payment_due_amount IS DISTINCT FROM p_due THEN
  RETURN jsonb_build_object('success',false,'error','Verified order changed. Hold dispatch.'); END IF;
 SELECT * INTO i FROM public.cashfree_payment_intents WHERE id=p_intent_id FOR SHARE;
 IF NOT FOUND OR i.completed_order_id IS DISTINCT FROM o.id OR i.cashfree_order_id IS DISTINCT FROM p_gateway_order_id
 OR i.country_code<>'IN' OR i.currency<>'INR' OR i.status<>'completed'
 OR (SELECT count(*) FROM public.cashfree_payment_intents WHERE completed_order_id=o.id AND status='completed')<>1 THEN
  RETURN jsonb_build_object('success',false,'error','Verified payment changed. Hold dispatch.'); END IF;
 cod:=o.payment_method='cod'; expected:=CASE WHEN cod THEN p_advance ELSE p_total END;
 SELECT * INTO e FROM cashfree_dispatch_private.evidence WHERE order_id=o.id FOR UPDATE;
 IF NOT FOUND OR e.consumed_at IS NOT NULL OR e.revoked_at IS NOT NULL OR e.verified_at<clock_timestamp()-interval '5 minutes' OR e.verified_at>clock_timestamp()+interval '1 minute'
 OR e.intent_id<>i.id OR e.provider_order_id IS DISTINCT FROM i.cashfree_order_id OR e.currency<>'INR'
 OR e.total_snapshot IS DISTINCT FROM p_total OR e.advance_snapshot IS DISTINCT FROM p_advance OR e.due_snapshot IS DISTINCT FROM p_due OR e.method_snapshot IS DISTINCT FROM o.payment_method
 OR expected IS NULL OR expected::text IN ('NaN','Infinity','-Infinity') OR expected<=0
 OR p_total IS NULL OR p_total::text IN ('NaN','Infinity','-Infinity') OR p_total<=0
 OR p_advance::text IN ('NaN','Infinity','-Infinity') OR p_due::text IN ('NaN','Infinity','-Infinity') OR p_due<0
 OR i.amount::text IN ('NaN','Infinity','-Infinity') OR abs(i.amount-expected)>0.01 OR abs(e.amount-expected)>0.01
 OR (cod AND (i.metadata->>'payment_method' IS DISTINCT FROM 'cod' OR o.payment_status IS DISTINCT FROM 'partially_paid' OR abs(p_advance+p_due-p_total)>0.01))
 OR (NOT cod AND (coalesce(i.metadata->>'payment_method','')='cod' OR o.payment_status IS DISTINCT FROM 'paid' OR p_due<>0)) THEN
  RAISE EXCEPTION 'Missing, stale, invalid, revoked or consumed evidence' USING ERRCODE='42501'; END IF;
 INSERT INTO cashfree_dispatch_private.authorizations(order_id,transaction_id) VALUES(o.id,txid_current());
 v_history_id:=gen_random_uuid();
 UPDATE cashfree_dispatch_private.evidence SET consumed_at=clock_timestamp(),history_id=v_history_id WHERE order_id=o.id;
 UPDATE public.orders SET status='shipped',internal_notes=left(coalesce(p_note,''),2000),cashfree_dispatch_verified_at=clock_timestamp() WHERE id=o.id;
 INSERT INTO public.order_status_history(id,order_id,status,note,created_at) VALUES(v_history_id,o.id,'shipped',left(coalesce(p_note,''),2000),clock_timestamp());
 INSERT INTO public.payment_security_audit_log(country_code,order_id,payment_intent_id,actor_type,actor_id,event_type,outcome,details)
 VALUES('IN',o.id,i.id,'admin',p_actor_id,'dispatch','success',jsonb_build_object('from_status',o.status,'to_status','shipped','total_amount',p_total,'advance_amount',p_advance,'due_amount',p_due,'currency','INR'));
 DELETE FROM cashfree_dispatch_private.authorizations WHERE order_id=o.id;
 RETURN jsonb_build_object('success',true,'id',o.id,'status','shipped','history_recorded',true);
END $$;

CREATE OR REPLACE FUNCTION cashfree_dispatch_private.guard_history_duplicates() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Cached older Admin bundles may still insert history after the atomic RPC.
 IF NEW.status='shipped' AND EXISTS(SELECT 1 FROM cashfree_dispatch_private.evidence e JOIN public.order_status_history h ON h.id=e.history_id
 WHERE e.order_id=NEW.order_id AND e.consumed_at IS NOT NULL AND h.status='shipped' AND NEW.id IS DISTINCT FROM e.history_id) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_cashfree_verified_dispatch(),cashfree_dispatch_private.guard_history_duplicates() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.dispatch_verified_cashfree_order(uuid,uuid,uuid,text,numeric,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_verified_cashfree_order(uuid,uuid,uuid,text,numeric,numeric,numeric,text) TO service_role;
DROP TRIGGER zzz_guard_cashfree_verified_dispatch ON public.orders;
-- All updates, including timestamp-only updates, pass through the guard.
CREATE TRIGGER zzz_guard_cashfree_verified_dispatch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_cashfree_verified_dispatch();
CREATE TRIGGER guard_verified_dispatch_history_duplicates BEFORE INSERT ON public.order_status_history FOR EACH ROW EXECUTE FUNCTION cashfree_dispatch_private.guard_history_duplicates();

DROP TRIGGER IF EXISTS register_cashfree_dispatch_subject ON public.orders;
CREATE TRIGGER register_cashfree_dispatch_subject AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION cashfree_dispatch_private.register_subject();
