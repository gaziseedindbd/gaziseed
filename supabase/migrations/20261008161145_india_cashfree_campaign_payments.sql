-- India campaign checkouts use the same Cashfree methods as the main India
-- checkout. Prices and delivery are recalculated from trusted rows here; the
-- browser never supplies an amount to charge.

CREATE OR REPLACE FUNCTION public.quote_india_campaign_order(
  p_flow text,
  p_context jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quantity integer;
  v_offer_price numeric;
  v_delivery numeric := 0;
  v_free_delivery boolean := false;
  v_stock integer;
  v_tiers jsonb;
  v_tier jsonb;
  v_custom_delivery numeric;
  v_product_id uuid;
  v_page_id uuid;
  v_bundle_id uuid;
  v_package_id uuid;
  v_combo_id uuid;
  v_country text;
BEGIN
  PERFORM set_config('request.headers', jsonb_build_object('x-gazi-country','IN')::text, true);

  IF jsonb_typeof(p_context) <> 'object' THEN
    RETURN jsonb_build_object('success',false,'error','Invalid order details');
  END IF;

  IF p_flow = 'ads' THEN
    v_page_id := NULLIF(p_context->>'landing_page_id','')::uuid;
    v_product_id := NULLIF(p_context->>'product_id','')::uuid;
    v_bundle_id := NULLIF(p_context->>'bundle_id','')::uuid;
    v_quantity := COALESCE(NULLIF(p_context->>'quantity','')::integer,1);
    IF v_page_id IS NULL OR v_product_id IS NULL OR v_quantity <= 0 THEN
      RETURN jsonb_build_object('success',false,'error','Invalid Ads offer selection');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.landing_pages lp
      WHERE lp.id=v_page_id AND lp.product_id=v_product_id
        AND COALESCE(lp.is_active,true)
        AND lower(COALESCE(lp.status,'active'))='active'
        AND upper(COALESCE(lp.country_code,'BD'))='IN'
    ) THEN RETURN jsonb_build_object('success',false,'error','Offer is unavailable'); END IF;
    SELECT p.stock INTO v_stock FROM public.products p
    WHERE p.id=v_product_id AND p.is_active=true
      AND upper(COALESCE(p.country_code,'BD'))='IN';
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Product is unavailable'); END IF;
    IF v_bundle_id IS NOT NULL THEN
      SELECT bo.quantity,bo.bundle_price,COALESCE(bo.free_delivery,false)
      INTO v_quantity,v_offer_price,v_free_delivery
      FROM public.bundle_offers bo
      WHERE bo.id=v_bundle_id AND bo.product_id=v_product_id AND bo.is_active=true
        AND upper(COALESCE(bo.country_code,'BD'))='IN';
      IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Offer bundle is unavailable'); END IF;
    ELSE
      SELECT qo.quantity,qo.offer_price,COALESCE(qo.free_delivery,false)
      INTO v_quantity,v_offer_price,v_free_delivery
      FROM public.quantity_offers qo
      WHERE qo.landing_page_id=v_page_id AND qo.product_id=v_product_id
        AND qo.quantity=v_quantity AND qo.is_active=true
        AND upper(COALESCE(qo.country_code,'BD'))='IN'
      ORDER BY qo.display_order,qo.created_at LIMIT 1;
      IF NOT FOUND THEN
        SELECT COALESCE(lp.pricing_tiers,lp.tiers,lp.quantity_pricing,lp.tier_pricing,'[]'::jsonb)
        INTO v_tiers FROM public.landing_pages lp WHERE lp.id=v_page_id;
        SELECT t INTO v_tier FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(v_tiers)='array' THEN v_tiers ELSE '[]'::jsonb END
        ) AS t WHERE COALESCE((t->>'quantity')::integer,-1)=v_quantity LIMIT 1;
        IF v_tier IS NULL THEN RETURN jsonb_build_object('success',false,'error','Offer tier is unavailable'); END IF;
        v_offer_price:=COALESCE((v_tier->>'offer_price')::numeric,(v_tier->>'price')::numeric);
        v_free_delivery:=COALESCE((v_tier->>'free_delivery')::boolean,false)
          OR COALESCE((v_tier->>'is_free_delivery')::boolean,false);
        v_custom_delivery:=NULL;
      ELSE
        -- create_offer_order currently derives delivery from the shared India
        -- delivery rules, so the quote uses that same calculation.
        v_custom_delivery:=NULL;
      END IF;
    END IF;
    IF v_offer_price IS NULL OR v_offer_price<=0 THEN RETURN jsonb_build_object('success',false,'error','Invalid offer price'); END IF;
    IF v_stock IS NULL OR v_stock < v_quantity THEN
      RETURN jsonb_build_object('success',false,'error','Insufficient stock for selected offer');
    END IF;
    v_delivery:=CASE WHEN v_free_delivery THEN 0 ELSE COALESCE(v_custom_delivery,public.calculate_delivery_charge(v_offer_price,false)) END;

  ELSIF p_flow = 'animated' THEN
    v_page_id := NULLIF(p_context->>'landing_page_id','')::uuid;
    v_package_id := NULLIF(p_context->>'package_id','')::uuid;
    SELECT p.product_id,q.quantity,q.offer_price,COALESCE(q.free_delivery,false),q.custom_delivery_charge
    INTO v_product_id,v_quantity,v_offer_price,v_free_delivery,v_custom_delivery
    FROM public.animated_landing_pages p
    JOIN public.animated_landing_packages q ON q.landing_page_id=p.id
    WHERE p.id=v_page_id AND q.id=v_package_id AND q.product_id=p.product_id
      AND p.status='active' AND q.is_active=true
      AND upper(COALESCE(p.country_code,'BD'))='IN'
      AND upper(COALESCE(q.country_code,'BD'))='IN';
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Offer package is unavailable'); END IF;
    SELECT stock INTO v_stock FROM public.products WHERE id=v_product_id AND is_active=true
      AND upper(COALESCE(country_code,'BD'))='IN';
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Product is unavailable'); END IF;
    IF v_stock IS NULL OR v_stock<v_quantity THEN RETURN jsonb_build_object('success',false,'error','Insufficient stock for selected package'); END IF;
    IF v_offer_price IS NULL OR v_offer_price<=0 THEN RETURN jsonb_build_object('success',false,'error','Invalid package price'); END IF;
    v_delivery:=CASE WHEN v_free_delivery THEN 0 ELSE COALESCE(v_custom_delivery,public.calculate_delivery_charge(v_offer_price,false)) END;

  ELSIF p_flow = 'combo' THEN
    v_combo_id := NULLIF(p_context->>'combo_id','')::uuid;
    v_quantity := COALESCE(NULLIF(p_context->>'quantity','')::integer,1);
    IF v_combo_id IS NULL OR v_quantity<=0 THEN RETURN jsonb_build_object('success',false,'error','Invalid combo selection'); END IF;
    SELECT COALESCE(stock,0),COALESCE(free_delivery,false),
      COALESCE(combo_price,sale_price,offer_price,0),COALESCE(country_code,'BD'),tier_pricing
    INTO v_stock,v_free_delivery,v_offer_price,v_country,v_tiers
    FROM public.combo_packs WHERE id=v_combo_id AND COALESCE(is_active,true)=true;
    IF NOT FOUND OR upper(COALESCE(v_country,'BD'))<>'IN' THEN
      RETURN jsonb_build_object('success',false,'error','Combo is unavailable');
    END IF;
    IF jsonb_typeof(v_tiers)='array' THEN
      SELECT t INTO v_tier FROM jsonb_array_elements(v_tiers) AS t
      WHERE COALESCE((t->>'qty')::integer,(t->>'quantity')::integer,-1)=v_quantity LIMIT 1;
    END IF;
    IF v_tier IS NOT NULL THEN
      v_offer_price:=COALESCE((v_tier->>'offer')::numeric,v_offer_price);
      v_free_delivery:=COALESCE((v_tier->>'freeDelivery')::boolean,(v_tier->>'free_delivery')::boolean,v_free_delivery);
    END IF;
    IF v_offer_price<=0 THEN RETURN jsonb_build_object('success',false,'error','Invalid combo price'); END IF;
    IF v_stock<v_quantity THEN RETURN jsonb_build_object('success',false,'error','Insufficient combo stock'); END IF;
    v_delivery:=public.calculate_delivery_charge(v_offer_price,v_free_delivery);
  ELSE
    RETURN jsonb_build_object('success',false,'error','Unsupported order type');
  END IF;

  RETURN jsonb_build_object(
    'success',true,'subtotal',round(v_offer_price,2),'delivery_charge',round(v_delivery,2),
    'total',round(v_offer_price+v_delivery,2),'quantity',v_quantity,
    'free_delivery',v_free_delivery
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_cashfree_campaign_order_atomic(
  p_payment_intent_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_intent public.cashfree_payment_intents%ROWTYPE;
  v_flow text;
  v_context jsonb;
  v_method text;
  v_quote jsonb;
  v_result jsonb;
  v_order_id uuid;
  v_order_number text;
  v_total numeric;
  v_advance numeric;
  v_due numeric;
  v_product_id uuid;
  v_product_name text;
  v_package_name text;
  v_quantity integer;
  v_offer_price numeric;
  v_compare_price numeric;
  v_delivery numeric;
  v_free_delivery boolean;
  v_order_num text;
  v_combo_title text;
  v_order_total numeric;
BEGIN
  SELECT * INTO v_intent FROM public.cashfree_payment_intents
  WHERE id=p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Payment intent not found'); END IF;
  IF v_intent.completed_order_id IS NOT NULL THEN
    SELECT order_number INTO v_order_number FROM public.orders WHERE id=v_intent.completed_order_id;
    RETURN jsonb_build_object('success',true,'already_completed',true,'order_id',v_intent.completed_order_id,'order_number',v_order_number);
  END IF;
  IF v_intent.status<>'processing' OR upper(COALESCE(v_intent.country_code,''))<>'IN'
    OR v_intent.metadata->>'payment_flow'<>'india_campaign' THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent is not ready for campaign order completion');
  END IF;
  v_flow:=v_intent.metadata->>'order_flow';
  v_context:=v_intent.metadata->'context';
  v_method:=v_intent.metadata->>'payment_method';
  v_quote:=public.quote_india_campaign_order(v_flow,v_context);
  IF NOT COALESCE((v_quote->>'success')::boolean,false) THEN
    RAISE EXCEPTION '%',COALESCE(v_quote->>'error','Unable to revalidate selected offer');
  END IF;
  v_total:=(v_quote->>'total')::numeric;
  IF abs(v_total-COALESCE((v_intent.metadata->>'quote_total')::numeric,-1))>0.01 THEN
    RAISE EXCEPTION 'Offer price or delivery changed; payment needs manual review';
  END IF;
  IF v_method='cashfree' THEN
    IF abs(v_total-v_intent.amount)>0.01 THEN RAISE EXCEPTION 'Paid amount does not match campaign total'; END IF;
    v_advance:=0;
  ELSIF v_method='cod' THEN
    v_advance:=COALESCE((v_intent.metadata->>'cod_advance')::numeric,0);
    IF v_advance<=0 OR abs(v_advance-v_intent.amount)>0.01 OR v_advance>v_total+0.01 THEN
      RAISE EXCEPTION 'Invalid COD advance amount';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;
  v_due:=GREATEST(0,v_total-v_advance);
  PERFORM set_config('request.headers',jsonb_build_object('x-gazi-country','IN')::text,true);

  IF v_flow='ads' THEN
    v_result:=public.create_offer_order(
      NULLIF(v_context->>'landing_page_id','')::uuid,
      NULLIF(v_context->>'product_id','')::uuid,
      COALESCE((v_quote->>'quantity')::integer,1),
      NULLIF(v_context->>'bundle_id','')::uuid,
      v_intent.customer_details->>'customer_name',
      v_intent.customer_details->>'customer_phone',
      v_intent.delivery_address,NULL,
      COALESCE(v_intent.special_instructions,''),'ads',v_intent.user_id,
      v_context->>'utm_source',v_context->>'utm_medium',v_context->>'utm_campaign',
      v_context->>'utm_content',v_context->>'utm_term',v_context->>'fbclid',v_context->>'gclid'
    );
    IF NOT COALESCE((v_result->>'success')::boolean,false) THEN RAISE EXCEPTION '%',COALESCE(v_result->>'error','Ads order creation failed'); END IF;
    v_order_id:=(v_result->>'order_id')::uuid;
    v_order_number:=v_result->>'order_number';

  ELSIF v_flow='animated' THEN
    SELECT p.product_id,q.package_name,q.quantity,q.offer_price,q.compare_price,q.free_delivery,
      CASE WHEN q.free_delivery THEN 0 ELSE COALESCE(q.custom_delivery_charge,public.calculate_delivery_charge(q.offer_price,false)) END,
      COALESCE(NULLIF(pr.name_bn,''),NULLIF(pr.name_en,''),NULLIF(pr.title,''),NULLIF(pr.name,''),'Product')
    INTO v_product_id,v_package_name,v_quantity,v_offer_price,v_compare_price,v_free_delivery,v_delivery,v_product_name
    FROM public.animated_landing_pages p
    JOIN public.animated_landing_packages q ON q.landing_page_id=p.id AND q.product_id=p.product_id
    JOIN public.products pr ON pr.id=p.product_id
    WHERE p.id=NULLIF(v_context->>'landing_page_id','')::uuid
      AND q.id=NULLIF(v_context->>'package_id','')::uuid
      AND p.status='active' AND q.is_active=true AND pr.is_active=true
      AND upper(COALESCE(p.country_code,'BD'))='IN'
      AND upper(COALESCE(q.country_code,'BD'))='IN'
      AND upper(COALESCE(pr.country_code,'BD'))='IN'
    FOR UPDATE OF q,pr;
    IF NOT FOUND THEN RAISE EXCEPTION 'Offer package is unavailable'; END IF;
    UPDATE public.products SET stock=stock-v_quantity,updated_at=now()
    WHERE id=v_product_id AND is_active=true AND stock>=v_quantity
      AND upper(COALESCE(country_code,'BD'))='IN';
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for selected package'; END IF;
    v_order_num:='GS-IN-'||upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
    INSERT INTO public.orders(
      order_number,country_code,customer_name,customer_phone,delivery_address,customer_address,
      delivery_zone_id,delivery_zone_name,delivery_charge,shipping_fee,subtotal,discount,discount_amount,
      total_amount,grand_total,final_amount,payment_method,payment_status,order_source,order_status,status,
      special_instructions,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,gclid,items,cart_items
    ) VALUES(
      v_order_num,'IN',v_intent.customer_details->>'customer_name',v_intent.customer_details->>'customer_phone',
      v_intent.delivery_address,v_intent.delivery_address,NULL,NULL,v_delivery,v_delivery,v_offer_price,0,0,
      v_total,v_total,v_total,'cod','unpaid','animated_landing','pending','pending',
      COALESCE(v_intent.special_instructions,''),v_context->>'utm_source',v_context->>'utm_medium',
      v_context->>'utm_campaign',v_context->>'utm_content',v_context->>'utm_term',v_context->>'fbclid',v_context->>'gclid',
      jsonb_build_array(jsonb_build_object('product_id',v_product_id,'package_id',v_context->>'package_id',
        'package_name',v_package_name,'quantity',v_quantity,'unit_price',round(v_offer_price/v_quantity,2),
        'package_price',v_offer_price,'compare_price',v_compare_price,'free_delivery',v_free_delivery)),
      jsonb_build_array(jsonb_build_object('product_id',v_product_id,'package_id',v_context->>'package_id',
        'quantity',v_quantity,'package_price',v_offer_price))
    ) RETURNING id INTO v_order_id;
    INSERT INTO public.order_items(order_id,product_id,product_name,quantity,unit_price,total_price)
    VALUES(v_order_id,v_product_id,v_product_name||CASE WHEN COALESCE(v_package_name,'')<>'' THEN ' — '||v_package_name ELSE '' END,
      v_quantity,round(v_offer_price/v_quantity,2),v_offer_price);
    INSERT INTO public.inventory_history(product_id,quantity_change,reason)
    VALUES(v_product_id,-v_quantity,'Animated landing order '||v_order_num);
    UPDATE public.animated_landing_pages SET conversions=COALESCE(conversions,0)+1,updated_at=now()
    WHERE id=NULLIF(v_context->>'landing_page_id','')::uuid AND upper(COALESCE(country_code,'BD'))='IN';
    v_order_number:=v_order_num;

  ELSIF v_flow='combo' THEN
    -- The legacy combo RPC omits country_code when inserting orders. Create
    -- this paid India order here so the branch is explicit and verified.
    SELECT title_bn,COALESCE(stock,0),COALESCE(free_delivery,false),
      COALESCE(combo_price,sale_price,offer_price,0),
      COALESCE(regular_total,regular_price,0),tier_pricing
    INTO v_combo_title,v_stock,v_free_delivery,v_offer_price,v_compare_price,v_tiers
    FROM public.combo_packs
    WHERE id=NULLIF(v_context->>'combo_id','')::uuid
      AND COALESCE(is_active,true)=true AND upper(COALESCE(country_code,'BD'))='IN'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Combo is unavailable'; END IF;
    v_quantity:=(v_quote->>'quantity')::integer;
    v_tier:=NULL;
    IF jsonb_typeof(v_tiers)='array' THEN
      SELECT t INTO v_tier FROM jsonb_array_elements(v_tiers) AS t
      WHERE COALESCE((t->>'qty')::integer,(t->>'quantity')::integer,-1)=v_quantity LIMIT 1;
    END IF;
    IF v_tier IS NOT NULL THEN
      v_offer_price:=COALESCE((v_tier->>'offer')::numeric,v_offer_price);
      v_compare_price:=COALESCE((v_tier->>'regular')::numeric,v_compare_price);
      v_free_delivery:=COALESCE((v_tier->>'freeDelivery')::boolean,v_free_delivery);
    END IF;
    IF v_offer_price<=0 OR v_stock<v_quantity THEN RAISE EXCEPTION 'Combo price or stock changed'; END IF;
    v_delivery:=public.calculate_delivery_charge(v_offer_price,v_free_delivery);
    IF abs(v_offer_price+v_delivery-v_total)>0.01 THEN RAISE EXCEPTION 'Combo price changed after payment'; END IF;
    UPDATE public.combo_packs SET stock=stock-v_quantity
    WHERE id=NULLIF(v_context->>'combo_id','')::uuid AND COALESCE(is_active,true)=true
      AND upper(COALESCE(country_code,'BD'))='IN' AND COALESCE(stock,0)>=v_quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient combo stock'; END IF;
    v_order_num:='GS-IN-'||upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
    INSERT INTO public.orders(
      order_number,country_code,customer_name,customer_phone,delivery_address,customer_address,
      delivery_zone_id,delivery_zone_name,delivery_charge,shipping_fee,subtotal,discount,discount_amount,
      total_amount,grand_total,final_amount,payment_method,payment_status,order_source,order_status,status,
      special_instructions,items,cart_items
    ) VALUES(
      v_order_num,'IN',v_intent.customer_details->>'customer_name',v_intent.customer_details->>'customer_phone',
      v_intent.delivery_address,v_intent.delivery_address,NULL,NULL,v_delivery,v_delivery,v_offer_price,0,0,
      v_total,v_total,v_total,'cod','unpaid','combo','pending','pending',COALESCE(v_intent.special_instructions,''),
      jsonb_build_array(jsonb_build_object('combo_id',NULLIF(v_context->>'combo_id','')::uuid,'quantity',v_quantity,'unit_price',v_offer_price)),
      jsonb_build_array(jsonb_build_object('combo_id',NULLIF(v_context->>'combo_id','')::uuid,'quantity',v_quantity,'unit_price',v_offer_price))
    ) RETURNING id INTO v_order_id;
    INSERT INTO public.order_items(order_id,product_name,quantity,unit_price,total_price)
    VALUES(v_order_id,COALESCE(v_combo_title,'Combo pack'),v_quantity,v_offer_price,v_offer_price*v_quantity);
    v_order_number:=v_order_num;
  ELSE
    RAISE EXCEPTION 'Unsupported order flow';
  END IF;

  UPDATE public.orders SET
    payment_method=CASE WHEN v_method='cashfree' THEN 'cashfree' ELSE 'cod' END,
    payment_status=CASE WHEN v_method='cashfree' THEN 'paid' ELSE 'partially_paid' END,
    payment_advance_amount=v_advance,
    payment_due_amount=v_due
  WHERE id=v_order_id AND country_code='IN';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order branch could not be verified'; END IF;
  SELECT final_amount INTO v_order_total FROM public.orders WHERE id=v_order_id AND country_code='IN';
  IF v_order_total IS NULL OR abs(v_order_total-v_total)>0.01 THEN
    RAISE EXCEPTION 'Created order amount does not match the verified payment quote';
  END IF;
  UPDATE public.cashfree_payment_intents SET status='completed',completed_order_id=v_order_id,
    paid_at=now(),updated_at=now()
  WHERE id=v_intent.id AND status='processing' AND completed_order_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment intent could not be completed'; END IF;

  RETURN jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,
    'amount',v_total,'advance_amount',v_advance,'due_amount',v_due,'payment_status',
    CASE WHEN v_method='cashfree' THEN 'paid' ELSE 'partially_paid' END);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM);
END;
$function$;

REVOKE ALL ON FUNCTION public.quote_india_campaign_order(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quote_india_campaign_order(text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.complete_cashfree_campaign_order_atomic(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_cashfree_campaign_order_atomic(uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.cashfree_campaign_payment_rate_limits (
  subject_hash text PRIMARY KEY,
  minute_window timestamptz NOT NULL DEFAULT date_trunc('minute',now()),
  minute_count integer NOT NULL DEFAULT 0,
  hour_window timestamptz NOT NULL DEFAULT date_trunc('hour',now()),
  hour_count integer NOT NULL DEFAULT 0,
  day_window date NOT NULL DEFAULT current_date,
  day_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cashfree_campaign_payment_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashfree_campaign_payment_rate_limits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cashfree_campaign_payment_rate_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.cashfree_campaign_payment_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_cashfree_campaign_payment_rate_limit(p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_phone text := regexp_replace(COALESCE(p_phone,''),'[^0-9]','','g');
  v_hash text;
  v_row public.cashfree_campaign_payment_rate_limits%ROWTYPE;
BEGIN
  IF length(v_phone)<>10 THEN RAISE EXCEPTION 'Invalid payment rate-limit subject'; END IF;
  v_hash:=md5(v_phone);
  PERFORM pg_advisory_xact_lock(hashtextextended('cashfree_campaign_payment:'||v_hash,0));
  SELECT * INTO v_row FROM public.cashfree_campaign_payment_rate_limits WHERE subject_hash=v_hash FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.cashfree_campaign_payment_rate_limits(subject_hash,minute_window,minute_count,hour_window,hour_count,day_window,day_count,last_seen_at)
    VALUES(v_hash,date_trunc('minute',v_now),1,date_trunc('hour',v_now),1,v_now::date,1,v_now);
    RETURN;
  END IF;
  IF v_row.minute_window=date_trunc('minute',v_now) AND v_row.minute_count>=5
    OR v_row.hour_window=date_trunc('hour',v_now) AND v_row.hour_count>=10
    OR v_row.day_window=v_now::date AND v_row.day_count>=20 THEN
    RAISE EXCEPTION 'Too many payment attempts. Please try again later.';
  END IF;
  UPDATE public.cashfree_campaign_payment_rate_limits SET
    minute_window=date_trunc('minute',v_now),
    minute_count=CASE WHEN v_row.minute_window=date_trunc('minute',v_now) THEN v_row.minute_count+1 ELSE 1 END,
    hour_window=date_trunc('hour',v_now),
    hour_count=CASE WHEN v_row.hour_window=date_trunc('hour',v_now) THEN v_row.hour_count+1 ELSE 1 END,
    day_window=v_now::date,
    day_count=CASE WHEN v_row.day_window=v_now::date THEN v_row.day_count+1 ELSE 1 END,
    last_seen_at=v_now
  WHERE subject_hash=v_hash;
END;
$function$;
REVOKE ALL ON FUNCTION public.consume_cashfree_campaign_payment_rate_limit(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_cashfree_campaign_payment_rate_limit(text) TO service_role;
