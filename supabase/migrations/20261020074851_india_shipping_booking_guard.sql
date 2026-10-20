-- Draft foundation only. No provider call, credential or live booking enablement.
ALTER TABLE public.india_shipping_shipments
 ADD COLUMN booking_actor_id uuid,
 ADD COLUMN booking_snapshot jsonb,
 ADD COLUMN reconcile_reason text;

CREATE FUNCTION public.assert_india_shipping_actor(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.admin_users%ROWTYPE; branch text;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.admin_users WHERE user_id=p_actor AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active India admin required' USING ERRCODE='42501'; END IF;
 branch:=upper(coalesce(a.country_code,''));
 IF a.role='master_admin' THEN SELECT upper(country_code) INTO branch FROM public.admin_branch_context WHERE user_id=p_actor FOR SHARE; END IF;
 IF branch IS DISTINCT FROM 'IN' THEN RAISE EXCEPTION 'India admin required' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_india_shipping_actor(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.india_shipping_booking_snapshot(p_order uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('order_id',o.id,'status',o.status,'country',o.country_code,'method',o.payment_method,'payment_status',o.payment_status,
 'total',o.final_amount,'advance',o.payment_advance_amount,'due',o.payment_due_amount,'address',o.delivery_address,'parcel',to_jsonb(p))
 FROM public.orders o JOIN public.india_shipping_preparations p ON p.order_id=o.id
 WHERE o.id=p_order AND o.country_code='IN' AND o.status='packed' AND o.payment_method IN ('cashfree','online')
 AND o.payment_status='paid' AND o.final_amount>0 AND o.payment_due_amount=0
 AND p.delivery_pin ~ '^[1-9][0-9]{5}$' AND p.weight_kg BETWEEN 0.01 AND 100
 AND p.length_cm BETWEEN 1 AND 200 AND p.breadth_cm BETWEEN 1 AND 200 AND p.height_cm BETWEEN 1 AND 200;
$$;
REVOKE ALL ON FUNCTION public.india_shipping_booking_snapshot(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.reserve_india_shipping_booking(p_order uuid,p_actor uuid,p_key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snap jsonb; result uuid;
BEGIN
 PERFORM public.assert_india_shipping_actor(p_actor);
 IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{16,20}$' THEN RAISE EXCEPTION 'Invalid immutable request key' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order FOR UPDATE;
 snap:=public.india_shipping_booking_snapshot(p_order);
 IF snap IS NULL THEN RAISE EXCEPTION 'Ineligible booking snapshot' USING ERRCODE='42501'; END IF;
 INSERT INTO public.india_shipping_shipments(order_id,country_code,create_request_key,booking_actor_id,booking_snapshot)
 VALUES(p_order,'IN',p_key,p_actor,snap) ON CONFLICT(order_id) DO NOTHING RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.claim_india_shipping_booking(p_id uuid,p_actor uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid; count_changed integer;
BEGIN
 PERFORM public.assert_india_shipping_actor(p_actor);
 SELECT order_id INTO oid FROM public.india_shipping_shipments WHERE id=p_id;
 PERFORM 1 FROM public.orders WHERE id=oid FOR UPDATE;
 UPDATE public.india_shipping_shipments SET creation_state='submitting',creation_attempted_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=p_id AND booking_actor_id=p_actor AND creation_state='reserved' AND external_order_id IS NULL AND external_shipment_id IS NULL
 AND booking_snapshot=public.india_shipping_booking_snapshot(oid);
 GET DIAGNOSTICS count_changed=ROW_COUNT;
 RETURN count_changed=1;
END $$;
CREATE FUNCTION public.reconcile_india_shipping_booking(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 UPDATE public.india_shipping_shipments SET creation_state='reconcile_required',reconcile_reason='external_outcome_uncertain',updated_at=clock_timestamp()
 WHERE id=p_id AND creation_state IN ('submitting','external_created');
END $$;
-- Disable superseded actor-free reservation/claim RPCs. Never reset an uncertain claim.
REVOKE ALL ON FUNCTION public.reserve_india_shipping_order(uuid,text),public.claim_india_shipping_creation(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.reserve_india_shipping_booking(uuid,uuid,text),public.claim_india_shipping_booking(uuid,uuid),public.reconcile_india_shipping_booking(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_india_shipping_booking(uuid,uuid,text),public.claim_india_shipping_booking(uuid,uuid),public.reconcile_india_shipping_booking(uuid) TO service_role;

CREATE FUNCTION public.guard_india_reserved_preparation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Serialize draft edits with reservation via the order lock; reservation does not lock parcel tuples.
 PERFORM 1 FROM public.orders WHERE id=NEW.order_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.india_shipping_shipments WHERE order_id=NEW.order_id) THEN
  RAISE EXCEPTION 'Reserved parcel is immutable; reconcile before editing' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_india_reserved_preparation() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_india_reserved_preparation BEFORE INSERT OR UPDATE ON public.india_shipping_preparations
 FOR EACH ROW EXECUTE FUNCTION public.guard_india_reserved_preparation();

CREATE FUNCTION public.guard_india_pending_booking_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF ROW(NEW.status,NEW.country_code,NEW.payment_method,NEW.payment_status,NEW.final_amount,NEW.payment_advance_amount,NEW.payment_due_amount,NEW.delivery_address)
 IS DISTINCT FROM ROW(OLD.status,OLD.country_code,OLD.payment_method,OLD.payment_status,OLD.final_amount,OLD.payment_advance_amount,OLD.payment_due_amount,OLD.delivery_address)
 AND EXISTS(SELECT 1 FROM public.india_shipping_shipments WHERE order_id=OLD.id AND creation_state IN ('reserved','submitting','external_created','reconcile_required')) THEN
  RAISE EXCEPTION 'Booking snapshot locked; reconcile shipment before changing order' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_india_pending_booking_order() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_india_pending_booking_order BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_india_pending_booking_order();

CREATE FUNCTION public.approve_india_shipping_pickup(p_order uuid,p_actor uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 PERFORM public.assert_india_shipping_actor(p_actor);
 PERFORM 1 FROM public.orders WHERE id=p_order AND country_code='IN' AND status='packed' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.india_shipping_shipments SET pickup_approved_at=clock_timestamp(),pickup_approved_by=p_actor,updated_at=clock_timestamp()
 WHERE order_id=p_order AND country_code='IN' AND awb IS NOT NULL AND external_shipment_id IS NOT NULL
 AND creation_state='awb_assigned' AND pickup_approved_at IS NULL AND pickup_request_state='not_requested';
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $$;
CREATE OR REPLACE FUNCTION public.claim_india_shipping_pickup(p_shipment_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid; actor uuid; changed integer;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT order_id,pickup_approved_by INTO oid,actor FROM public.india_shipping_shipments WHERE id=p_shipment_id;
 IF actor IS NULL THEN RETURN false; END IF;
 PERFORM public.assert_india_shipping_actor(actor);
 PERFORM 1 FROM public.orders WHERE id=oid AND country_code='IN' AND status='packed' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.india_shipping_shipments SET pickup_request_state='requesting',pickup_request_attempted_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=p_shipment_id AND country_code='IN' AND creation_state='awb_assigned' AND awb IS NOT NULL AND external_shipment_id IS NOT NULL
 AND pickup_approved_at IS NOT NULL AND pickup_approved_by=actor AND pickup_request_state='not_requested';
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $$;
REVOKE ALL ON FUNCTION public.approve_india_shipping_pickup(uuid,uuid),public.claim_india_shipping_pickup(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_india_shipping_pickup(uuid,uuid),public.claim_india_shipping_pickup(uuid) TO service_role;
