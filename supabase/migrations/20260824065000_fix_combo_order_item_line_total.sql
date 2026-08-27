-- SAFE-ZONE: fix only the persisted combo order_items line total.
-- No pricing, stock, checkout-entrypoint, or authorization changes.

CREATE OR REPLACE FUNCTION public.create_combo_order(
  p_combo_id uuid,
  p_quantity integer DEFAULT 1,
  p_customer_name text DEFAULT NULL::text,
  p_customer_phone text DEFAULT NULL::text,
  p_delivery_address text DEFAULT NULL::text,
  p_special_instructions text DEFAULT ''::text,
  p_order_source text DEFAULT 'combo'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_num text;
  v_qty integer := COALESCE(p_quantity,1);
  v_combo_price numeric;
  v_regular_price numeric := 0;
  v_delivery_charge numeric;
  v_free_delivery boolean := false;
  v_final_total numeric;
  v_stock integer;
  v_title text;
  v_tier jsonb;
BEGIN
  IF p_combo_id IS NULL THEN RAISE EXCEPTION 'Combo is required'; END IF;
  IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF p_customer_phone IS NULL OR btrim(p_customer_phone) = '' THEN RAISE EXCEPTION 'Customer phone is required'; END IF;
  IF p_delivery_address IS NULL OR btrim(p_delivery_address) = '' THEN RAISE EXCEPTION 'Delivery address is required'; END IF;
  IF v_qty <= 0 THEN RAISE EXCEPTION 'Invalid combo quantity'; END IF;

  SELECT title_bn, COALESCE(stock,0), COALESCE(free_delivery,false), COALESCE(combo_price, sale_price, offer_price, 0), COALESCE(regular_total, regular_price, 0)
    INTO v_title, v_stock, v_free_delivery, v_combo_price, v_regular_price
  FROM public.combo_packs
  WHERE id = p_combo_id AND COALESCE(is_active,true) = true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Combo is unavailable'; END IF;

  IF jsonb_typeof((SELECT tier_pricing FROM public.combo_packs WHERE id = p_combo_id)) = 'array' THEN
    SELECT tier INTO v_tier
    FROM jsonb_array_elements((SELECT tier_pricing FROM public.combo_packs WHERE id = p_combo_id)) AS tier
    WHERE COALESCE((tier->>'qty')::integer, -1) = v_qty
    LIMIT 1;
  END IF;

  IF v_tier IS NOT NULL THEN
    v_combo_price := COALESCE((v_tier->>'offer')::numeric, v_combo_price);
    v_regular_price := COALESCE((v_tier->>'regular')::numeric, v_regular_price);
    v_free_delivery := COALESCE((v_tier->>'freeDelivery')::boolean, v_free_delivery);
  END IF;

  IF v_combo_price <= 0 THEN RAISE EXCEPTION 'Invalid combo pricing'; END IF;
  IF v_stock < v_qty THEN RAISE EXCEPTION 'Insufficient combo stock'; END IF;

  v_delivery_charge := public.calculate_delivery_charge(v_combo_price, v_free_delivery);
  v_final_total := v_combo_price + v_delivery_charge;
  v_order_num := 'SB-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

  INSERT INTO public.orders (
    order_number, customer_name, customer_phone, delivery_address, customer_address,
    delivery_zone_id, delivery_zone_name, delivery_charge, shipping_fee, subtotal,
    discount, discount_amount, total_amount, grand_total, final_amount,
    payment_method, payment_status, order_source, order_status, status,
    special_instructions, items, cart_items
  ) VALUES (
    v_order_num, p_customer_name, p_customer_phone, p_delivery_address, p_delivery_address,
    NULL, NULL, v_delivery_charge, v_delivery_charge, v_combo_price,
    0, 0, v_final_total, v_final_total, v_final_total,
    'cod', 'unpaid', COALESCE(p_order_source,'combo'), 'pending', 'pending',
    COALESCE(p_special_instructions,''),
    jsonb_build_array(jsonb_build_object('combo_id', p_combo_id, 'quantity', v_qty, 'unit_price', v_combo_price)),
    jsonb_build_array(jsonb_build_object('combo_id', p_combo_id, 'quantity', v_qty, 'unit_price', v_combo_price))
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_name, quantity, unit_price, total_price)
  VALUES (v_order_id, v_title, v_qty, v_combo_price, v_combo_price * v_qty);

  UPDATE public.combo_packs SET stock = stock - v_qty WHERE id = p_combo_id AND COALESCE(is_active,true) = true AND COALESCE(stock,0) >= v_qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient combo stock'; END IF;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'order_number', v_order_num, 'subtotal', v_combo_price, 'delivery_charge', v_delivery_charge, 'grand_total', v_final_total, 'free_delivery', v_free_delivery);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
