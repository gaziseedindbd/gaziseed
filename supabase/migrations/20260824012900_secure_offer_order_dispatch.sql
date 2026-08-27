CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_special_instructions text,
  p_order_source text,
  p_items jsonb,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_fbclid text DEFAULT NULL,
  p_gclid text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_landing_id uuid;
  v_product_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_bundle_id uuid;
BEGIN
  SELECT
    NULLIF(item->>'landing_id','')::uuid,
    NULLIF(item->>'product_id','')::uuid,
    COALESCE((item->>'quantity')::integer, 1),
    NULLIF(item->>'unit_price','')::numeric,
    NULLIF(item->>'bundle_id','')::uuid
  INTO v_landing_id, v_product_id, v_quantity, v_unit_price, v_bundle_id
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) AS item
  LIMIT 1;

  IF v_landing_id IS NULL OR v_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer order is missing landing/product information');
  END IF;

  IF v_bundle_id IS NULL AND v_unit_price IS NOT NULL THEN
    SELECT bo.id
      INTO v_bundle_id
    FROM public.bundle_offers bo
    WHERE bo.product_id = v_product_id
      AND bo.quantity = v_quantity
      AND bo.bundle_price = v_unit_price
      AND bo.is_active = true
    ORDER BY bo.display_order ASC, bo.created_at ASC
    LIMIT 1;
  END IF;

  RETURN public.create_offer_order(
    p_landing_page_id => v_landing_id,
    p_product_id => v_product_id,
    p_quantity => v_quantity,
    p_bundle_id => v_bundle_id,
    p_customer_name => p_customer_name,
    p_customer_phone => p_customer_phone,
    p_delivery_address => p_delivery_address,
    p_delivery_zone_id => NULL,
    p_special_instructions => p_special_instructions,
    p_order_source => COALESCE(p_order_source, 'ads'),
    p_user_id => NULL,
    p_utm_source => p_utm_source,
    p_utm_medium => p_utm_medium,
    p_utm_campaign => p_utm_campaign,
    p_utm_content => p_utm_content,
    p_utm_term => p_utm_term,
    p_fbclid => p_fbclid,
    p_gclid => p_gclid
  );
END;
$$;
