-- Authoritative shipping context. Apply/test in Sandbox first; no provider I/O.
CREATE TABLE public.india_shipping_destinations (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),country_code text NOT NULL DEFAULT 'IN' CHECK(country_code='IN'),
 source_address text NOT NULL,source_name text NOT NULL,source_phone text NOT NULL,
 city text NOT NULL CHECK(length(city) BETWEEN 2 AND 30),state text NOT NULL CHECK(length(state) BETWEEN 2 AND 80),
 postcode text NOT NULL CHECK(postcode ~ '^[1-9][0-9]{5}$'),confirmed_by uuid NOT NULL,confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.india_shipping_destinations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.india_shipping_destinations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.india_shipping_destinations TO service_role;

CREATE FUNCTION public.confirm_india_shipping_destination(p_order uuid,p_actor uuid,p_city text,p_state text,p_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
 PERFORM public.assert_india_shipping_actor(p_actor);
 SELECT * INTO o FROM public.orders WHERE id=p_order AND country_code='IN' AND status IN ('confirmed','processing','packed') FOR UPDATE;
 IF NOT FOUND OR length(trim(o.delivery_address))<5 OR length(trim(o.customer_name))<2 OR o.customer_phone !~ '^[6-9][0-9]{9}$'
 OR p_city IS NULL OR length(trim(p_city)) NOT BETWEEN 2 AND 30 OR p_state IS NULL OR p_state !~ '^[A-Za-z][A-Za-z -]{1,79}$'
 OR p_pin IS NULL OR p_pin !~ '^[1-9][0-9]{5}$' OR NOT EXISTS(SELECT 1 FROM public.india_shipping_preparations WHERE order_id=o.id AND delivery_pin=p_pin)
 OR EXISTS(SELECT 1 FROM public.india_shipping_shipments WHERE order_id=o.id) THEN RAISE EXCEPTION 'Destination requires review' USING ERRCODE='42501'; END IF;
 INSERT INTO public.india_shipping_destinations(order_id,source_address,source_name,source_phone,city,state,postcode,confirmed_by)
 VALUES(o.id,o.delivery_address,o.customer_name,o.customer_phone,trim(p_city),trim(p_state),p_pin,p_actor)
 ON CONFLICT(order_id) DO UPDATE SET source_address=excluded.source_address,source_name=excluded.source_name,source_phone=excluded.source_phone,
 city=excluded.city,state=excluded.state,postcode=excluded.postcode,confirmed_by=excluded.confirmed_by,confirmed_at=clock_timestamp();
END $$;

CREATE FUNCTION public.india_shipping_context_internal(p_order uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE;p public.india_shipping_preparations%ROWTYPE;d public.india_shipping_destinations%ROWTYPE;
 i public.cashfree_payment_intents%ROWTYPE; lines jsonb; items_sum numeric;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order AND country_code='IN' AND status='packed';
 IF NOT FOUND OR o.payment_method NOT IN ('cashfree','online') OR o.payment_status<>'paid' OR o.payment_due_amount<>0 OR o.final_amount<=0 THEN RETURN NULL; END IF;
 SELECT * INTO p FROM public.india_shipping_preparations WHERE order_id=o.id;
 IF NOT FOUND OR p.weight_kg NOT BETWEEN 0.01 AND 100 OR p.length_cm NOT BETWEEN 1 AND 200 OR p.breadth_cm NOT BETWEEN 1 AND 200 OR p.height_cm NOT BETWEEN 1 AND 200 THEN RETURN NULL; END IF;
 SELECT * INTO d FROM public.india_shipping_destinations WHERE order_id=o.id;
 IF NOT FOUND OR ROW(d.source_address,d.source_name,d.source_phone,d.postcode) IS DISTINCT FROM ROW(o.delivery_address,o.customer_name,o.customer_phone,p.delivery_pin) THEN RETURN NULL; END IF;
 IF (SELECT count(*) FROM public.cashfree_payment_intents WHERE completed_order_id=o.id AND status='completed')<>1 THEN RETURN NULL; END IF;
 SELECT * INTO i FROM public.cashfree_payment_intents WHERE completed_order_id=o.id AND status='completed';
 IF i.country_code<>'IN' OR i.currency<>'INR' OR i.metadata->>'payment_method'='cod' OR abs(i.amount-o.final_amount)>0.01 THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.order_items WHERE order_id=o.id) OR EXISTS(SELECT 1 FROM public.order_items WHERE order_id=o.id AND
 (country_code IS DISTINCT FROM 'IN' OR quantity<=0 OR unit_price<=0 OR unit_price::text IN ('NaN','Infinity','-Infinity') OR total_price IS NULL OR abs(total_price-quantity*unit_price)>0.01 OR length(trim(product_name))=0)) THEN RETURN NULL; END IF;
 SELECT sum(quantity*unit_price),jsonb_agg(jsonb_build_object('name',product_name,'sku',coalesce(product_id::text,id::text),'quantity',quantity,'price',unit_price) ORDER BY id)
 INTO items_sum,lines FROM public.order_items WHERE order_id=o.id;
 IF o.subtotal IS NULL OR o.delivery_charge IS NULL OR o.discount IS NULL OR o.discount<0 OR o.delivery_charge<0
 OR o.final_amount::text IN ('NaN','Infinity','-Infinity') OR abs(items_sum-o.subtotal)>0.01 OR abs(items_sum+o.delivery_charge-o.discount-o.final_amount)>0.01
 OR o.wallet_credit_used<>0 THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('orderId',o.id,'status',o.status,'orderNumber',o.order_number,
 'requestKey','GS'||substr(md5(o.id::text),1,18),
 'order',jsonb_build_object('country_code',o.country_code,'payment_method',o.payment_method,'payment_status',o.payment_status,'final_amount',o.final_amount,'payment_advance_amount',o.payment_advance_amount,'payment_due_amount',o.payment_due_amount),
 'destination',jsonb_build_object('name',o.customer_name,'phone',o.customer_phone,'email',coalesce(o.customer_email,''),'address',o.delivery_address,'city',d.city,'state',d.state,'postcode',d.postcode),
 'parcel',jsonb_build_object('deliveryPostcode',p.delivery_pin,'weightKg',p.weight_kg,'lengthCm',p.length_cm,'breadthCm',p.breadth_cm,'heightCm',p.height_cm,'codAmount',0,'declaredValue',o.final_amount),
 'invoice',jsonb_build_object('itemsSubtotal',items_sum,'shipping',o.delivery_charge,'discount',o.discount),
 'items',lines,'intent',jsonb_build_object('id',i.id,'providerOrderId',i.cashfree_order_id,'amount',i.amount));
END $$;
CREATE FUNCTION public.get_india_shipping_booking_context(p_order uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM public.assert_india_shipping_actor(p_actor); RETURN public.india_shipping_context_internal(p_order); END $$;
CREATE OR REPLACE FUNCTION public.india_shipping_booking_snapshot(p_order uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.india_shipping_context_internal(p_order); $$;

CREATE FUNCTION public.guard_india_reserved_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN RAISE EXCEPTION 'Item order cannot be reassigned' USING ERRCODE='42501'; END IF;
 oid:=CASE WHEN TG_OP='DELETE' THEN OLD.order_id ELSE NEW.order_id END;
 PERFORM 1 FROM public.orders WHERE id=oid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.india_shipping_shipments WHERE order_id=oid) THEN RAISE EXCEPTION 'Reserved items immutable' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_india_reserved_item BEFORE INSERT OR UPDATE OR DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.guard_india_reserved_item();
CREATE TRIGGER guard_india_reserved_destination BEFORE INSERT OR UPDATE ON public.india_shipping_destinations FOR EACH ROW EXECUTE FUNCTION public.guard_india_reserved_preparation();

REVOKE ALL ON FUNCTION public.india_shipping_context_internal(uuid),public.guard_india_reserved_item() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.confirm_india_shipping_destination(uuid,uuid,text,text,text),public.get_india_shipping_booking_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_india_shipping_destination(uuid,uuid,text,text,text),public.get_india_shipping_booking_context(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_india_pending_booking_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['updated_at','internal_notes','cashfree_dispatch_verified_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','internal_notes','cashfree_dispatch_verified_at'])
 AND EXISTS(SELECT 1 FROM public.india_shipping_shipments WHERE order_id=OLD.id AND creation_state IN ('reserved','submitting','external_created','reconcile_required')) THEN
  RAISE EXCEPTION 'Booking snapshot locked; reconcile before changing order' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_india_shipping_booking(p_order uuid,p_actor uuid,p_key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snap jsonb; result uuid;
BEGIN
 PERFORM public.assert_india_shipping_actor(p_actor);
 IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{16,20}$' THEN RAISE EXCEPTION 'Invalid immutable request key' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order FOR UPDATE;
 snap:=public.india_shipping_booking_snapshot(p_order);
 IF snap IS NULL OR snap->>'requestKey' IS DISTINCT FROM p_key THEN RAISE EXCEPTION 'Ineligible booking snapshot' USING ERRCODE='42501'; END IF;
 INSERT INTO public.india_shipping_shipments(order_id,country_code,create_request_key,booking_actor_id,booking_snapshot)
 VALUES(p_order,'IN',p_key,p_actor,snap) ON CONFLICT(order_id) DO NOTHING RETURNING id INTO result;
 RETURN result;
END $$;
