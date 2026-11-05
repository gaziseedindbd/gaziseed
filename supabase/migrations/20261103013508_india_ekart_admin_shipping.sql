-- Parcel profiles are shared by India shipping providers. Keep direct browser access
-- closed; the authenticated Edge Function uses service_role after admin checks.
CREATE TABLE IF NOT EXISTS public.india_shipping_package_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'IN' CHECK (country_code = 'IN'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  weight_kg numeric NOT NULL CHECK (weight_kg BETWEEN 0.01 AND 50),
  length_cm numeric NOT NULL CHECK (length_cm BETWEEN 1 AND 200),
  breadth_cm numeric NOT NULL CHECK (breadth_cm BETWEEN 1 AND 200),
  height_cm numeric NOT NULL CHECK (height_cm BETWEEN 1 AND 200),
  product_keywords text[] NOT NULL DEFAULT '{}',
  min_item_count integer NOT NULL DEFAULT 1 CHECK (min_item_count >= 1),
  max_item_count integer NOT NULL DEFAULT 999 CHECK (max_item_count >= min_item_count),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, name)
);
ALTER TABLE public.india_shipping_package_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.india_shipping_package_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.india_shipping_package_profiles TO service_role;

ALTER TABLE public.india_shipping_preparations
  ADD COLUMN IF NOT EXISTS package_profile_id uuid REFERENCES public.india_shipping_package_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fragile_shipment boolean NOT NULL DEFAULT false;

-- Ekart Elite integration adds provider-scoped tracking/manifest metadata to the
-- existing India shipment ledger. The order_id unique key is the cross-courier
-- duplicate guard: one order cannot be booked with Delhivery and Ekart together.
ALTER TABLE public.india_shipping_shipments
  ADD COLUMN IF NOT EXISTS ekart_manifest_number text,
  ADD COLUMN IF NOT EXISTS ekart_manifest_url text,
  ADD COLUMN IF NOT EXISTS ekart_tracking_payload jsonb,
  ADD COLUMN IF NOT EXISTS ekart_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS ekart_picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS ekart_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS ekart_pickup_alias text;

CREATE INDEX IF NOT EXISTS india_shipping_ekart_status_idx
  ON public.india_shipping_shipments (provider, tracking_status, updated_at DESC)
  WHERE provider = 'ekart';

CREATE OR REPLACE FUNCTION public.reserve_india_ekart_booking(p_order uuid,p_actor uuid,p_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.admin_users%ROWTYPE; branch text; result uuid; o public.orders%ROWTYPE;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.admin_users WHERE user_id=p_actor AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active India admin required' USING ERRCODE='42501'; END IF;
  branch:=upper(coalesce(a.country_code,''));
  IF a.role='master_admin' THEN SELECT upper(country_code) INTO branch FROM public.admin_branch_context WHERE user_id=p_actor FOR SHARE; END IF;
  IF branch IS DISTINCT FROM 'IN' THEN RAISE EXCEPTION 'India admin required' USING ERRCODE='42501'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{16,40}$' THEN RAISE EXCEPTION 'Invalid request key' USING ERRCODE='23514'; END IF;
  SELECT * INTO o FROM public.orders WHERE id=p_order AND country_code='IN' FOR UPDATE;
  IF NOT FOUND OR lower(coalesce(o.status,''))<>'packed' THEN RAISE EXCEPTION 'Packed India order required' USING ERRCODE='42501'; END IF;
  IF o.payment_method='cashfree' THEN
    IF o.payment_status<>'paid' OR coalesce(o.payment_due_amount,0)<>0 OR coalesce(o.payment_advance_amount,0)<>0 THEN RAISE EXCEPTION 'Verified prepaid order required' USING ERRCODE='42501'; END IF;
  ELSIF o.payment_method='cod' THEN
    IF o.payment_status NOT IN ('unpaid','partially_paid') OR coalesce(o.payment_due_amount,0)<=0 OR coalesce(o.payment_due_amount,0)>49999
      OR abs(coalesce(o.payment_advance_amount,0)+o.payment_due_amount-coalesce(o.final_amount,o.grand_total))>=0.01 THEN RAISE EXCEPTION 'Valid COD balance required' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported payment method' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.india_shipping_preparations WHERE order_id=p_order AND country_code='IN') THEN RAISE EXCEPTION 'Parcel preparation required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.india_shipping_shipments(order_id,country_code,provider,creation_state,create_request_key,booking_actor_id)
  VALUES(p_order,'IN','ekart','reserved',p_key,p_actor)
  ON CONFLICT(order_id) DO NOTHING RETURNING id INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.claim_india_ekart_booking(p_id uuid,p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.admin_users%ROWTYPE; branch text; changed integer;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.admin_users WHERE user_id=p_actor AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active India admin required' USING ERRCODE='42501'; END IF;
  branch:=upper(coalesce(a.country_code,''));
  IF a.role='master_admin' THEN SELECT upper(country_code) INTO branch FROM public.admin_branch_context WHERE user_id=p_actor FOR SHARE; END IF;
  IF branch IS DISTINCT FROM 'IN' THEN RAISE EXCEPTION 'India admin required' USING ERRCODE='42501'; END IF;
  UPDATE public.india_shipping_shipments SET creation_state='submitting',creation_attempted_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE id=p_id AND provider='ekart' AND country_code='IN' AND booking_actor_id=p_actor
     AND creation_state='reserved' AND awb IS NULL AND external_shipment_id IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $$;

CREATE OR REPLACE FUNCTION public.record_india_ekart_booking(p_id uuid,p_actor uuid,p_tracking_id text,p_wbn text,p_order_ref text,p_pickup_alias text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.admin_users%ROWTYPE; branch text; changed integer;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.admin_users WHERE user_id=p_actor AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active India admin required' USING ERRCODE='42501'; END IF;
  branch:=upper(coalesce(a.country_code,''));
  IF a.role='master_admin' THEN SELECT upper(country_code) INTO branch FROM public.admin_branch_context WHERE user_id=p_actor FOR SHARE; END IF;
  IF branch IS DISTINCT FROM 'IN' THEN RAISE EXCEPTION 'India admin required' USING ERRCODE='42501'; END IF;
  IF p_tracking_id IS NULL OR p_tracking_id !~ '^[A-Za-z0-9_-]{4,80}$' OR p_wbn IS NULL OR p_wbn !~ '^[A-Za-z0-9_-]{4,80}$' THEN RAISE EXCEPTION 'Invalid Ekart tracking identifiers' USING ERRCODE='23514'; END IF;
  UPDATE public.india_shipping_shipments SET external_order_id=left(coalesce(p_order_ref,''),100),external_shipment_id=p_tracking_id,ekart_pickup_alias=left(nullif(p_pickup_alias,''),80),
    awb=p_wbn,tracking_status='Order Placed',creation_state='awb_assigned',pickup_request_state='not_requested',
    updated_at=clock_timestamp()
   WHERE id=p_id AND provider='ekart' AND country_code='IN' AND booking_actor_id=p_actor AND creation_state='submitting'
     AND external_shipment_id IS NULL AND awb IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_india_ekart_booking(p_id uuid,p_reason text DEFAULT 'external_outcome_uncertain')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  UPDATE public.india_shipping_shipments SET creation_state='reconcile_required',reconcile_reason=left(coalesce(p_reason,'external_outcome_uncertain'),80),updated_at=clock_timestamp()
   WHERE id=p_id AND provider='ekart' AND creation_state IN ('submitting','awb_assigned');
END $$;

REVOKE ALL ON FUNCTION public.reserve_india_ekart_booking(uuid,uuid,text),public.claim_india_ekart_booking(uuid,uuid),
  public.record_india_ekart_booking(uuid,uuid,text,text,text,text),public.reconcile_india_ekart_booking(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_india_ekart_booking(uuid,uuid,text),public.claim_india_ekart_booking(uuid,uuid),
  public.record_india_ekart_booking(uuid,uuid,text,text,text,text),public.reconcile_india_ekart_booking(uuid,text) TO service_role;
