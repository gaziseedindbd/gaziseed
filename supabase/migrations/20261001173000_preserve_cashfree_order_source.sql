-- Preserve the originating channel when Cashfree completes an India order.
-- Messenger payment intents explicitly carry facebook_messenger_ai;
-- all other Cashfree intents retain the existing website source.

CREATE OR REPLACE FUNCTION public.complete_cashfree_cod_order_atomic(
  p_payment_intent_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_items jsonb,
  p_coupon_code text DEFAULT NULL::text,
  p_special_instructions text DEFAULT ''::text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_use_referral_wallet boolean DEFAULT false,
  p_advance_amount numeric DEFAULT 0
)
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
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_wallet numeric := 0;
  v_total numeric := 0;
  v_due numeric := 0;
  v_order_source text := 'website';
BEGIN
  SELECT * INTO v_intent
  FROM public.cashfree_payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment intent not found');
  END IF;

  IF v_intent.completed_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'payment_intent_id', v_intent.id, 'order_id', v_intent.completed_order_id);
  END IF;

  IF v_intent.status <> 'processing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment intent is not ready for atomic completion', 'status', v_intent.status);
  END IF;

  IF upper(coalesce(v_intent.country_code, '')) <> 'IN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'COD completion is only available for India');
  END IF;

  IF coalesce(v_intent.metadata->>'payment_method', '') <> 'cod' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment intent is not a COD intent');
  END IF;

  IF p_user_id IS DISTINCT FROM v_intent.user_id
     AND (p_user_id IS NOT NULL OR v_intent.user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment intent user mismatch');
  END IF;

  v_order_source := CASE
    WHEN v_intent.metadata->>'order_source' = 'facebook_messenger_ai'
      THEN 'facebook_messenger_ai'
    ELSE 'website'
  END CASE;

  v_subtotal := coalesce((v_intent.metadata->>'quote_subtotal')::numeric, 0);
  v_discount := coalesce((v_intent.metadata->>'quote_discount')::numeric, 0);
  v_delivery := coalesce((v_intent.metadata->>'quote_delivery')::numeric, 0);
  v_wallet := coalesce(v_intent.wallet_credit_used, 0);
  v_total := coalesce((v_intent.metadata->>'quote_final')::numeric, v_intent.amount, 0);
  v_due := greatest(0, v_total - p_advance_amount);

  IF v_total <= 0 OR p_advance_amount <= 0 OR p_advance_amount > v_total + 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid COD advance amount');
  END IF;

  PERFORM set_config('request.headers', jsonb_build_object('x-gazi-country', 'IN')::text, true);

  v_result := public.create_order_with_referral_wallet(
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

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION '%', coalesce(v_result->>'error', 'Order creation failed');
  END IF;

  v_order_id := (v_result->>'order_id')::uuid;
  v_order_number := v_result->>'order_number';

  UPDATE public.orders
  SET delivery_charge = v_delivery,
      shipping_fee = v_delivery,
      subtotal = v_subtotal,
      total_amount = v_subtotal,
      discount = v_discount + v_wallet,
      discount_amount = v_discount + v_wallet,
      grand_total = v_total,
      final_amount = v_total,
      payment_status = 'partially_paid',
      payment_method = 'cod',
      payment_advance_amount = p_advance_amount,
      payment_due_amount = v_due
  WHERE id = v_order_id
    AND country_code = 'IN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Created order could not be aligned to the verified COD quote';
  END IF;

  IF p_use_referral_wallet AND p_user_id IS NOT NULL THEN
    UPDATE public.referral_wallet_transactions
    SET amount = v_wallet,
        description = 'Referral wallet used on order ' || v_order_number
    WHERE order_id = v_order_id
      AND user_id = p_user_id
      AND type = 'wallet_usage';

    IF v_wallet = 0 THEN
      DELETE FROM public.referral_wallet_transactions
      WHERE order_id = v_order_id
        AND user_id = p_user_id
        AND type = 'wallet_usage';
    END IF;
  END IF;

  UPDATE public.cashfree_payment_intents
  SET status = 'completed',
      completed_order_id = v_order_id,
      paid_at = now(),
      updated_at = now()
  WHERE id = v_intent.id
    AND status = 'processing'
    AND completed_order_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent could not be completed';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'payment_intent_id', v_intent.id,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'amount', v_total,
    'advance_amount', p_advance_amount,
    'due_amount', v_due,
    'currency', 'INR'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_cashfree_paid_order_atomic(
  p_payment_intent_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_items jsonb,
  p_coupon_code text DEFAULT NULL::text,
  p_special_instructions text DEFAULT ''::text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_use_referral_wallet boolean DEFAULT false
)
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
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_wallet numeric := 0;
  v_final numeric := 0;
  v_order_source text := 'website';
BEGIN
  SELECT * INTO v_intent
  FROM public.cashfree_payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment intent not found');
  END IF;

  IF v_intent.completed_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'payment_intent_id', v_intent.id, 'order_id', v_intent.completed_order_id);
  END IF;

  IF v_intent.status <> 'processing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment intent is not ready for atomic completion', 'status', v_intent.status);
  END IF;

  IF upper(coalesce(v_intent.country_code, '')) <> 'IN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cashfree completion is only available for India');
  END IF;

  IF p_user_id IS DISTINCT FROM v_intent.user_id THEN
    IF p_user_id IS NOT NULL OR v_intent.user_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Payment intent user mismatch');
    END IF;
  END IF;

  v_order_source := CASE
    WHEN v_intent.metadata->>'order_source' = 'facebook_messenger_ai'
      THEN 'facebook_messenger_ai'
    ELSE 'website'
  END CASE;

  v_subtotal := COALESCE((v_intent.metadata->>'quote_subtotal')::numeric, 0);
  v_discount := COALESCE((v_intent.metadata->>'quote_discount')::numeric, 0);
  v_delivery := COALESCE((v_intent.metadata->>'quote_delivery')::numeric, 0);
  v_wallet := COALESCE(v_intent.wallet_credit_used, 0);
  v_final := COALESCE(v_intent.amount, 0);

  IF v_final < 0 OR v_subtotal < 0 OR v_discount < 0 OR v_delivery < 0 OR v_wallet < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment quote values');
  END IF;

  PERFORM set_config('request.headers', jsonb_build_object('x-gazi-country', 'IN')::text, true);

  v_result := public.create_order_with_referral_wallet(
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

  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_result->>'error', 'Order creation failed');
  END IF;

  v_order_id := (v_result->>'order_id')::uuid;
  v_order_number := v_result->>'order_number';

  UPDATE public.orders
  SET delivery_charge = v_delivery,
      shipping_fee = v_delivery,
      subtotal = v_subtotal,
      total_amount = v_subtotal,
      discount = v_discount + v_wallet,
      discount_amount = v_discount + v_wallet,
      grand_total = v_final,
      final_amount = v_final,
      payment_status = 'paid',
      payment_method = 'cashfree'
  WHERE id = v_order_id
    AND country_code = 'IN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Created order could not be aligned to the verified Cashfree quote';
  END IF;

  IF p_use_referral_wallet AND p_user_id IS NOT NULL THEN
    UPDATE public.referral_wallet_transactions
    SET amount = v_wallet,
        description = 'Referral wallet used on order ' || v_order_number
    WHERE order_id = v_order_id
      AND user_id = p_user_id
      AND type = 'wallet_usage';

    IF v_wallet = 0 THEN
      DELETE FROM public.referral_wallet_transactions
      WHERE order_id = v_order_id
        AND user_id = p_user_id
        AND type = 'wallet_usage';
    END IF;
  END IF;

  UPDATE public.cashfree_payment_intents
  SET status = 'completed',
      completed_order_id = v_order_id,
      paid_at = now(),
      updated_at = now()
  WHERE id = v_intent.id
    AND status = 'processing'
    AND completed_order_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent could not be completed';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'payment_intent_id', v_intent.id,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'amount', v_final,
    'final_amount', v_final,
    'currency', 'INR'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
