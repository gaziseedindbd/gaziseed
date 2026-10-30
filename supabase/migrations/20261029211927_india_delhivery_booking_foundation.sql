-- India Delhivery booking: durable one-attempt manifest and warehouse pickup locks.
-- No provider request is retried automatically after a request may have reached Delhivery.

ALTER TABLE public.india_shipping_shipments
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS creation_state text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS creation_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS create_request_key text,
  ADD COLUMN IF NOT EXISTS booking_actor_id uuid,
  ADD COLUMN IF NOT EXISTS booking_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS reconcile_reason text,
  ADD COLUMN IF NOT EXISTS pickup_request_state text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS pickup_request_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_pickup_id text;

CREATE UNIQUE INDEX IF NOT EXISTS india_shipping_create_request_key_unique
  ON public.india_shipping_shipments(create_request_key) WHERE create_request_key IS NOT NULL;

ALTER TABLE public.india_shipping_shipments
  DROP CONSTRAINT IF EXISTS india_shipping_shipments_creation_state_check,
  ADD CONSTRAINT india_shipping_shipments_creation_state_check
    CHECK (creation_state IN ('not_started','reserved','submitting','external_created','awb_assigned','reconcile_required')),
  DROP CONSTRAINT IF EXISTS india_shipping_shipments_pickup_request_state_check,
  ADD CONSTRAINT india_shipping_shipments_pickup_request_state_check
    CHECK (pickup_request_state IN ('not_requested','requesting','requested','failed','reconcile_required'));

CREATE TABLE IF NOT EXISTS public.india_delhivery_pickup_batches (
  pickup_location text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('not_requested','requesting','requested','reconcile_required','completed')),
  shipment_ids uuid[] NOT NULL DEFAULT '{}',
  expected_package_count integer NOT NULL DEFAULT 0 CHECK (expected_package_count BETWEEN 0 AND 500),
  pickup_date date,
  pickup_time time,
  requested_by uuid,
  external_pickup_id text,
  attempted_at timestamptz,
  requested_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.india_delhivery_pickup_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.india_delhivery_pickup_batches FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_india_delhivery_actor(p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.admin_users%ROWTYPE; branch text;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM public.admin_users WHERE user_id=p_actor AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active India admin required' USING ERRCODE='42501'; END IF;
  branch:=upper(coalesce(a.country_code,''));
  IF a.role='master_admin' THEN
    SELECT upper(country_code) INTO branch FROM public.admin_branch_context WHERE user_id=p_actor FOR SHARE;
  END IF;
  IF branch IS DISTINCT FROM 'IN' THEN RAISE EXCEPTION 'India admin required' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_india_delhivery_actor(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.india_delhivery_booking_snapshot(p_order uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'order', to_jsonb(o),
    'parcel', to_jsonb(p),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'product_name', oi.product_name, 'quantity', oi.quantity, 'total_price', oi.total_price
    ) ORDER BY oi.id) FROM public.order_items oi WHERE oi.order_id=o.id), '[]'::jsonb)
  )
  FROM public.orders o
  JOIN public.india_shipping_preparations p ON p.order_id=o.id AND p.country_code='IN'
  WHERE o.id=p_order AND o.country_code='IN' AND o.status='packed'
    AND nullif(trim(o.customer_name),'') IS NOT NULL
    AND regexp_replace(coalesce(o.customer_phone,''),'[^0-9]','','g') ~ '^[0-9]{10,12}$'
    AND nullif(trim(o.delivery_address),'') IS NOT NULL
    AND coalesce(o.final_amount,o.grand_total,0)>0
    AND ((o.payment_method='cashfree' AND o.payment_status='paid' AND coalesce(o.payment_due_amount,0)=0)
      OR (o.payment_method='cod' AND o.payment_status='unpaid' AND coalesce(o.payment_due_amount,0)>0
        AND abs(coalesce(o.payment_advance_amount,0)+o.payment_due_amount-coalesce(o.final_amount,o.grand_total))<0.01))
    AND p.delivery_pin ~ '^[1-9][0-9]{5}$'
    AND p.weight_kg BETWEEN 0.01 AND 100
    AND p.length_cm BETWEEN 1 AND 200 AND p.breadth_cm BETWEEN 1 AND 200 AND p.height_cm BETWEEN 1 AND 200
    AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.quantity>0)
$$;
REVOKE ALL ON FUNCTION public.india_delhivery_booking_snapshot(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.reserve_india_delhivery_booking(p_order uuid,p_actor uuid,p_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE snap jsonb; result uuid;
BEGIN
  PERFORM public.assert_india_delhivery_actor(p_actor);
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{16,40}$' THEN RAISE EXCEPTION 'Invalid request key' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM public.orders WHERE id=p_order FOR UPDATE;
  snap:=public.india_delhivery_booking_snapshot(p_order);
  IF snap IS NULL THEN RAISE EXCEPTION 'Ineligible India order snapshot' USING ERRCODE='42501'; END IF;
  INSERT INTO public.india_shipping_shipments(order_id,country_code,provider,creation_state,create_request_key,booking_actor_id,booking_snapshot)
  VALUES(p_order,'IN','delhivery','reserved',p_key,p_actor,snap)
  ON CONFLICT(order_id) DO NOTHING RETURNING id INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.claim_india_delhivery_booking(p_id uuid,p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE oid uuid; changed integer;
BEGIN
  PERFORM public.assert_india_delhivery_actor(p_actor);
  SELECT order_id INTO oid FROM public.india_shipping_shipments WHERE id=p_id;
  IF oid IS NULL THEN RETURN false; END IF;
  PERFORM 1 FROM public.orders WHERE id=oid FOR UPDATE;
  UPDATE public.india_shipping_shipments SET creation_state='submitting',creation_attempted_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=p_id AND provider='delhivery' AND booking_actor_id=p_actor AND creation_state='reserved'
    AND booking_snapshot=public.india_delhivery_booking_snapshot(oid)
    AND external_shipment_id IS NULL AND awb IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $$;

CREATE OR REPLACE FUNCTION public.record_india_delhivery_manifest(p_id uuid,p_actor uuid,p_order_ref text,p_awb text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
  PERFORM public.assert_india_delhivery_actor(p_actor);
  IF nullif(trim(p_order_ref),'') IS NULL OR p_order_ref !~ '^[A-Za-z0-9_-]{1,50}$'
     OR nullif(trim(p_awb),'') IS NULL OR p_awb !~ '^[A-Za-z0-9-]{4,64}$' THEN
    RAISE EXCEPTION 'Invalid Delhivery manifest identifiers' USING ERRCODE='23514';
  END IF;
  UPDATE public.india_shipping_shipments SET external_order_id=p_order_ref,external_shipment_id=p_awb,
    awb=p_awb,provider='delhivery',creation_state='awb_assigned',updated_at=clock_timestamp()
  WHERE id=p_id AND provider='delhivery' AND booking_actor_id=p_actor AND creation_state='submitting'
    AND external_shipment_id IS NULL AND awb IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_india_delhivery_booking(p_id uuid,p_reason text DEFAULT 'external_outcome_uncertain')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  UPDATE public.india_shipping_shipments SET creation_state='reconcile_required',reconcile_reason=left(coalesce(p_reason,'external_outcome_uncertain'),80),updated_at=clock_timestamp()
  WHERE id=p_id AND provider='delhivery' AND creation_state IN ('submitting','awb_assigned');
END $$;

CREATE OR REPLACE FUNCTION public.approve_india_delhivery_pickup(p_id uuid,p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
  PERFORM public.assert_india_delhivery_actor(p_actor);
  UPDATE public.india_shipping_shipments SET pickup_approved_at=clock_timestamp(),pickup_approved_by=p_actor,updated_at=clock_timestamp()
  WHERE id=p_id AND provider='delhivery' AND country_code='IN' AND creation_state='awb_assigned'
    AND awb IS NOT NULL AND pickup_request_state='not_requested'
    AND (pickup_approved_at IS NULL OR pickup_approved_by=p_actor);
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $$;

CREATE OR REPLACE FUNCTION public.claim_india_delhivery_pickup(
  p_location text,p_actor uuid,p_ids uuid[],p_date date,p_time time,p_count integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE eligible integer; locked boolean;
BEGIN
  PERFORM public.assert_india_delhivery_actor(p_actor);
  IF p_location IS NULL OR p_location !~ '^[A-Za-z0-9 _-]{2,80}$' OR p_date < current_date OR p_date > current_date+7
     OR p_time IS NULL OR p_count NOT BETWEEN 1 AND 500 OR cardinality(p_ids)<>p_count THEN RETURN false; END IF;
  SELECT count(*) INTO eligible FROM public.india_shipping_shipments s
  WHERE s.id=ANY(p_ids) AND s.provider='delhivery' AND s.country_code='IN' AND s.creation_state='awb_assigned'
    AND s.awb IS NOT NULL AND s.pickup_approved_by=p_actor AND s.pickup_approved_at IS NOT NULL
    AND s.pickup_request_state='not_requested';
  IF eligible<>p_count THEN RETURN false; END IF;
  INSERT INTO public.india_delhivery_pickup_batches(pickup_location,state,shipment_ids,expected_package_count,pickup_date,pickup_time,requested_by,attempted_at,updated_at)
  VALUES(p_location,'requesting',p_ids,p_count,p_date,p_time,p_actor,clock_timestamp(),clock_timestamp())
  ON CONFLICT(pickup_location) DO UPDATE SET state='requesting',shipment_ids=EXCLUDED.shipment_ids,
    expected_package_count=EXCLUDED.expected_package_count,pickup_date=EXCLUDED.pickup_date,pickup_time=EXCLUDED.pickup_time,
    requested_by=EXCLUDED.requested_by,external_pickup_id=NULL,attempted_at=clock_timestamp(),requested_at=NULL,completed_at=NULL,updated_at=clock_timestamp()
  WHERE public.india_delhivery_pickup_batches.state IN ('completed','not_requested')
  RETURNING true INTO locked;
  IF NOT coalesce(locked,false) THEN RETURN false; END IF;
  UPDATE public.india_shipping_shipments SET pickup_request_state='requesting',pickup_request_attempted_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=ANY(p_ids) AND provider='delhivery' AND pickup_request_state='not_requested';
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.record_india_delhivery_pickup(p_location text,p_success boolean,p_pickup_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ids uuid[];
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  IF p_success AND (nullif(trim(p_pickup_id),'') IS NULL OR length(p_pickup_id)>100) THEN RAISE EXCEPTION 'Pickup id required' USING ERRCODE='23514'; END IF;
  UPDATE public.india_delhivery_pickup_batches SET state=CASE WHEN p_success THEN 'requested' ELSE 'reconcile_required' END,
    external_pickup_id=CASE WHEN p_success THEN trim(p_pickup_id) ELSE external_pickup_id END,
    requested_at=CASE WHEN p_success THEN clock_timestamp() ELSE requested_at END,updated_at=clock_timestamp()
  WHERE pickup_location=p_location AND state='requesting' RETURNING shipment_ids INTO ids;
  IF ids IS NOT NULL THEN
    UPDATE public.india_shipping_shipments SET pickup_request_state=CASE WHEN p_success THEN 'requested' ELSE 'reconcile_required' END,
      pickup_requested_at=CASE WHEN p_success THEN clock_timestamp() ELSE pickup_requested_at END,
      external_pickup_id=CASE WHEN p_success THEN trim(p_pickup_id) ELSE external_pickup_id END,updated_at=clock_timestamp()
    WHERE id=ANY(ids) AND pickup_request_state='requesting';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_india_delhivery_pickup(p_location text,p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
  PERFORM public.assert_india_delhivery_actor(p_actor);
  UPDATE public.india_delhivery_pickup_batches SET state='completed',completed_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE pickup_location=p_location AND state='requested';
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $$;

REVOKE ALL ON FUNCTION public.reserve_india_delhivery_booking(uuid,uuid,text),public.claim_india_delhivery_booking(uuid,uuid),
  public.record_india_delhivery_manifest(uuid,uuid,text,text),public.reconcile_india_delhivery_booking(uuid,text),
  public.approve_india_delhivery_pickup(uuid,uuid),public.claim_india_delhivery_pickup(text,uuid,uuid[],date,time,integer),
  public.record_india_delhivery_pickup(text,boolean,text),public.complete_india_delhivery_pickup(text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_india_delhivery_booking(uuid,uuid,text),public.claim_india_delhivery_booking(uuid,uuid),
  public.record_india_delhivery_manifest(uuid,uuid,text,text),public.reconcile_india_delhivery_booking(uuid,text),
  public.approve_india_delhivery_pickup(uuid,uuid),public.claim_india_delhivery_pickup(text,uuid,uuid[],date,time,integer),
  public.record_india_delhivery_pickup(text,boolean,text),public.complete_india_delhivery_pickup(text,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.guard_india_delhivery_preparation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.orders WHERE id=NEW.order_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.india_shipping_shipments WHERE order_id=NEW.order_id AND creation_state IN ('reserved','submitting','awb_assigned','reconcile_required')) THEN
    RAISE EXCEPTION 'Shipment preparation is locked; reconcile the existing shipment before editing' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_india_delhivery_preparation() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_india_delhivery_preparation_trigger ON public.india_shipping_preparations;
CREATE TRIGGER guard_india_delhivery_preparation_trigger BEFORE INSERT OR UPDATE ON public.india_shipping_preparations
FOR EACH ROW EXECUTE FUNCTION public.guard_india_delhivery_preparation();

CREATE OR REPLACE FUNCTION public.guard_india_delhivery_pending_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF ROW(NEW.status,NEW.country_code,NEW.payment_method,NEW.payment_status,NEW.grand_total,NEW.final_amount,NEW.payment_advance_amount,NEW.payment_due_amount,NEW.delivery_address,NEW.customer_name,NEW.customer_phone)
     IS DISTINCT FROM ROW(OLD.status,OLD.country_code,OLD.payment_method,OLD.payment_status,OLD.grand_total,OLD.final_amount,OLD.payment_advance_amount,OLD.payment_due_amount,OLD.delivery_address,OLD.customer_name,OLD.customer_phone)
     AND EXISTS(SELECT 1 FROM public.india_shipping_shipments WHERE order_id=OLD.id AND creation_state IN ('reserved','submitting','awb_assigned','reconcile_required')) THEN
    RAISE EXCEPTION 'Booking snapshot locked; reconcile shipment before changing order' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_india_delhivery_pending_order() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_india_delhivery_pending_order_trigger ON public.orders;
CREATE TRIGGER guard_india_delhivery_pending_order_trigger BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_india_delhivery_pending_order();
