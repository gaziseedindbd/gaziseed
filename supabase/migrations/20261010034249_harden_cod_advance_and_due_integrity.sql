CREATE OR REPLACE FUNCTION public.complete_cashfree_cod_order_atomic(p_payment_intent_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text, p_items jsonb, p_coupon_code text DEFAULT NULL::text, p_special_instructions text DEFAULT ''::text, p_user_id uuid DEFAULT NULL::uuid, p_use_referral_wallet boolean DEFAULT false, p_advance_amount numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_intent public.cashfree_payment_intents%ROWTYPE;
  v_result jsonb;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric:=0;
  v_discount numeric:=0;
  v_delivery numeric:=0;
  v_wallet numeric:=0;
  v_total numeric:=0;
  v_due numeric:=0;
  v_order_source text := 'website';
BEGIN
  SELECT * INTO v_intent
  FROM public.cashfree_payment_intents
  WHERE id=p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent not found');
  END IF;

  IF v_intent.completed_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'already_completed',true,'payment_intent_id',v_intent.id,'order_id',v_intent.completed_order_id);
  END IF;

  IF v_intent.status<>'processing' THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent is not ready for atomic completion','status',v_intent.status);
  END IF;

  IF upper(coalesce(v_intent.country_code,''))<>'IN' THEN
    RETURN jsonb_build_object('success',false,'error','COD completion is only available for India');
  END IF;

  IF coalesce(v_intent.metadata->>'payment_method','')<>'cod' THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent is not a COD intent');
  END IF;

  IF p_user_id IS DISTINCT FROM v_intent.user_id AND (p_user_id IS NOT NULL OR v_intent.user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent user mismatch');
  END IF;

  v_order_source := CASE
    WHEN v_intent.metadata->>'order_source' = 'facebook_messenger_ai' THEN 'facebook_messenger_ai'
    ELSE 'website'
  END CASE;

  v_subtotal:=coalesce((v_intent.metadata->>'quote_subtotal')::numeric,0);
  v_discount:=coalesce((v_intent.metadata->>'quote_discount')::numeric,0);
  v_delivery:=coalesce((v_intent.metadata->>'quote_delivery')::numeric,0);
  v_wallet:=coalesce(v_intent.wallet_credit_used,0);
  v_total:=coalesce((v_intent.metadata->>'quote_final')::numeric,v_intent.amount,0);
  v_due:=greatest(0,v_total-p_advance_amount);

  IF v_total IS NULL OR p_advance_amount IS NULL OR v_intent.metadata->>'quote_final' IS NULL
     OR v_intent.currency IS DISTINCT FROM 'INR'
     OR v_total::text IN ('NaN','Infinity','-Infinity')
     OR p_advance_amount::text IN ('NaN','Infinity','-Infinity')
     OR p_advance_amount IS DISTINCT FROM v_intent.amount
     OR v_total<=0 OR p_advance_amount<=0 OR p_advance_amount>v_total THEN
    RETURN jsonb_build_object('success',false,'error','Invalid COD advance amount');
  END IF;

  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub',p_user_id::text,true);
  END IF;

  PERFORM set_config('request.headers',jsonb_build_object('x-gazi-country','IN')::text,true);

  v_result:=public.create_order_with_referral_wallet(
    p_customer_name,
    p_customer_phone,
    p_delivery_address,
    p_items,
    p_coupon_code,
    NULL,
    v_order_source,
    p_special_instructions,
    p_user_id,
    p_use_referral_wallet
  );

  IF NOT coalesce((v_result->>'success')::boolean,false) THEN
    RAISE EXCEPTION '%',coalesce(v_result->>'error','Order creation failed');
  END IF;

  v_order_id:=(v_result->>'order_id')::uuid;
  v_order_number:=v_result->>'order_number';

  UPDATE public.orders
  SET delivery_charge=v_delivery,
      shipping_fee=v_delivery,
      subtotal=v_subtotal,
      total_amount=v_subtotal,
      discount=v_discount+v_wallet,
      discount_amount=v_discount+v_wallet,
      grand_total=v_total,
      final_amount=v_total,
      payment_status=CASE WHEN v_due=0 THEN 'paid' ELSE 'partially_paid' END,
      payment_method='cod',
      payment_advance_amount=p_advance_amount,
      payment_due_amount=v_due
  WHERE id=v_order_id AND country_code='IN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Created order could not be aligned to the verified COD quote';
  END IF;

  IF p_use_referral_wallet AND p_user_id IS NOT NULL THEN
    UPDATE public.referral_wallet_transactions
    SET amount=v_wallet,
        description='Referral wallet used on order '||v_order_number
    WHERE order_id=v_order_id AND user_id=p_user_id AND type='wallet_usage';

    IF v_wallet=0 THEN
      DELETE FROM public.referral_wallet_transactions
      WHERE order_id=v_order_id AND user_id=p_user_id AND type='wallet_usage';
    END IF;
  END IF;

  UPDATE public.cashfree_payment_intents
  SET status='completed',
      completed_order_id=v_order_id,
      paid_at=now(),
      updated_at=now()
  WHERE id=v_intent.id
    AND status='processing'
    AND completed_order_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent could not be completed';
  END IF;

  RETURN jsonb_build_object(
    'success',true,
    'already_completed',false,
    'payment_intent_id',v_intent.id,
    'order_id',v_order_id,
    'order_number',v_order_number,
    'amount',v_total,
    'advance_amount',p_advance_amount,
    'due_amount',v_due,
    'currency','INR'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM);
END;
$function$;

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
  IF NOT public.is_admin() THEN
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

CREATE OR REPLACE FUNCTION public.complete_cashfree_campaign_order_atomic(p_payment_intent_id uuid)
 RETURNS jsonb
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
  v_stock integer;
  v_tiers jsonb;
  v_tier jsonb;
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
    IF v_advance IS NULL OR v_total IS NULL OR v_intent.currency IS DISTINCT FROM 'INR'
      OR v_advance::text IN ('NaN','Infinity','-Infinity') OR v_total::text IN ('NaN','Infinity','-Infinity')
      OR v_advance<=0 OR v_advance IS DISTINCT FROM v_intent.amount OR v_advance>v_total THEN
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
    payment_status=CASE WHEN v_method='cashfree' OR v_due=0 THEN 'paid' ELSE 'partially_paid' END,
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
    CASE WHEN v_method='cashfree' OR v_due=0 THEN 'paid' ELSE 'partially_paid' END);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM);
END;
$function$;


CREATE OR REPLACE FUNCTION public.guard_cod_advance_financial_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $guard$
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin')
    AND upper(coalesce(OLD.country_code,''))='IN'
    AND lower(coalesce(OLD.payment_method,''))='cod'
    AND (coalesce(OLD.payment_advance_amount,0)>0 OR coalesce(NEW.payment_advance_amount,0)>0)
    AND (NEW.payment_advance_amount IS DISTINCT FROM OLD.payment_advance_amount
      OR NEW.payment_due_amount IS DISTINCT FROM OLD.payment_due_amount
      OR NEW.final_amount IS DISTINCT FROM OLD.final_amount
      OR NEW.grand_total IS DISTINCT FROM OLD.grand_total
      OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
      OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
      OR NEW.payment_method IS DISTINCT FROM OLD.payment_method) THEN
    RAISE EXCEPTION 'COD advance balances require a trusted atomic payment operation';
  END IF;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.guard_cod_advance_financial_fields() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_cod_advance_financial_fields
BEFORE UPDATE OF payment_advance_amount,payment_due_amount,final_amount,grand_total,total_amount,payment_status,payment_method
ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_cod_advance_financial_fields();
