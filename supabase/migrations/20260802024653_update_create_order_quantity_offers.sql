/*
# Update create_order: support quantity_offer_id

When p_items contains a quantity_offer_id:
- Backend looks up the quantity_offers table for the REAL price and quantity
- Stock deduction uses the offer's quantity field
- Delivery charge uses the offer's free_delivery / custom_delivery_charge
- Frontend-submitted prices are NEVER trusted

This is the server-side price security requirement.
*/

CREATE OR REPLACE FUNCTION create_order(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_zone_id uuid,
  p_special_instructions text DEFAULT '',
  p_order_source text DEFAULT 'website',
  p_user_id uuid DEFAULT NULL,
  p_customer_email text DEFAULT '',
  p_coupon_code text DEFAULT '',
  p_utm_source text DEFAULT '',
  p_utm_medium text DEFAULT '',
  p_utm_campaign text DEFAULT '',
  p_utm_content text DEFAULT '',
  p_utm_term text DEFAULT '',
  p_fbclid text DEFAULT '',
  p_gclid text DEFAULT '',
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_delivery_charge numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_grand_total numeric(10,2) := 0;
  v_zone record;
  v_item jsonb;
  v_product record;
  v_bundle record;
  v_qo record;
  v_unit_price numeric(10,2);
  v_total_price numeric(10,2);
  v_qty int;
  v_deduct_qty int;
  v_coupon record;
  v_item_name text;
  v_item_image text;
  v_bundle_name text;
  v_delivery_zone_name text := '';
  v_offer_qty int;
BEGIN
  IF p_customer_name = '' OR p_customer_phone = '' OR p_delivery_address = '' THEN
    RETURN jsonb_build_object('error', 'Missing required fields');
  END IF;

  IF NOT p_customer_phone ~ '^01[0-9]{9}$' THEN
    RETURN jsonb_build_object('error', 'Invalid phone number');
  END IF;

  IF p_delivery_zone_id IS NOT NULL THEN
    SELECT * INTO v_zone FROM delivery_zones WHERE id = p_delivery_zone_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Invalid delivery zone');
    END IF;
    v_delivery_charge := v_zone.charge;
    v_delivery_zone_name := v_zone.zone_name;
  END IF;

  v_order_number := generate_order_number();

  INSERT INTO orders (
    order_number, user_id, customer_name, customer_phone, customer_email,
    delivery_address, delivery_zone_id, delivery_zone_name, delivery_charge,
    special_instructions, subtotal, discount, grand_total,
    payment_method, order_source, coupon_code,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid,
    status
  ) VALUES (
    v_order_number, p_user_id, p_customer_name, p_customer_phone, p_customer_email,
    p_delivery_address, p_delivery_zone_id, v_delivery_zone_name, 0,
    p_special_instructions, 0, 0, 0,
    'cod', p_order_source, p_coupon_code,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_fbclid, p_gclid,
    'pending'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_qty < 1 THEN v_qty := 1; END IF;

    -- QUANTITY OFFER path (Ads Landing Page)
    IF (v_item->>'quantity_offer_id') IS NOT NULL THEN
      SELECT * INTO v_qo FROM quantity_offers WHERE id = (v_item->>'quantity_offer_id')::uuid AND is_active = true;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Invalid quantity offer: ' || (v_item->>'quantity_offer_id'));
      END IF;

      SELECT name_bn, image INTO v_item_name, v_item_image FROM products WHERE id = v_qo.product_id;

      -- ALWAYS use the admin-configured price, never frontend
      v_unit_price := v_qo.offer_price;
      v_total_price := v_qo.offer_price;
      v_bundle_name := v_qo.quantity::text || 'টি পণ্য';
      v_offer_qty := v_qo.quantity;

      -- Delivery rules from quantity offer
      IF v_qo.free_delivery THEN
        v_delivery_charge := 0;
      ELSIF v_qo.custom_delivery_charge IS NOT NULL THEN
        v_delivery_charge := v_qo.custom_delivery_charge;
      END IF;

      v_subtotal := v_subtotal + v_total_price;

      INSERT INTO order_items (
        order_id, product_id, product_name, quantity, unit_price, total_price,
        bundle_id, bundle_name, image
      ) VALUES (
        v_order_id, v_qo.product_id, v_item_name, v_offer_qty, v_unit_price, v_total_price,
        v_qo.id, v_bundle_name, v_item_image
      );

      -- Deduct the OFFER's quantity from stock (e.g. 3-packet offer = 3 units)
      v_deduct_qty := v_qo.quantity;
      UPDATE products SET stock = GREATEST(0, stock - v_deduct_qty) WHERE id = v_qo.product_id;
      INSERT INTO inventory_history (product_id, quantity_change, reason)
      VALUES (v_qo.product_id, -v_deduct_qty, 'Order: ' || v_order_number);

    -- BUNDLE OFFER path (legacy bundles)
    ELSIF (v_item->>'bundle_id') IS NOT NULL THEN
      SELECT * INTO v_bundle FROM bundle_offers WHERE id = (v_item->>'bundle_id')::uuid AND is_active = true;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Invalid bundle: ' || (v_item->>'bundle_id'));
      END IF;

      SELECT name_bn, image INTO v_item_name, v_item_image FROM products WHERE id = v_bundle.product_id;

      v_unit_price := v_bundle.bundle_price;
      v_total_price := v_bundle.bundle_price;
      v_bundle_name := v_bundle.bundle_name;

      IF v_bundle.free_delivery THEN
        v_delivery_charge := 0;
      ELSIF v_bundle.custom_delivery_charge IS NOT NULL THEN
        v_delivery_charge := v_bundle.custom_delivery_charge;
      END IF;

      v_subtotal := v_subtotal + v_total_price;

      INSERT INTO order_items (
        order_id, product_id, product_name, quantity, unit_price, total_price,
        bundle_id, bundle_name, image
      ) VALUES (
        v_order_id, v_bundle.product_id, v_item_name, v_qty, v_unit_price, v_total_price,
        v_bundle.id, v_bundle_name, v_item_image
      );

      v_deduct_qty := v_bundle.quantity * v_qty;
      UPDATE products SET stock = GREATEST(0, stock - v_deduct_qty) WHERE id = v_bundle.product_id;
      INSERT INTO inventory_history (product_id, quantity_change, reason)
      VALUES (v_bundle.product_id, -v_deduct_qty, 'Order: ' || v_order_number);

    -- REGULAR PRODUCT path (normal website orders)
    ELSE
      SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid AND is_active = true;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Invalid product: ' || (v_item->>'product_id'));
      END IF;

      IF v_product.sale_price IS NOT NULL AND v_product.sale_price > 0 AND v_product.sale_price < v_product.regular_price THEN
        v_unit_price := v_product.sale_price;
      ELSE
        v_unit_price := v_product.regular_price;
      END IF;

      v_total_price := v_unit_price * v_qty;
      v_subtotal := v_subtotal + v_total_price;
      v_item_name := COALESCE(NULLIF(v_product.name_bn, ''), v_product.name_en);
      v_item_image := v_product.image;

      INSERT INTO order_items (
        order_id, product_id, product_name, quantity, unit_price, total_price, image
      ) VALUES (
        v_order_id, v_product.id, v_item_name, v_qty, v_unit_price, v_total_price, v_item_image
      );

      UPDATE products SET stock = GREATEST(0, stock - v_qty) WHERE id = v_product.id;
      INSERT INTO inventory_history (product_id, quantity_change, reason)
      VALUES (v_product.id, -v_qty, 'Order: ' || v_order_number);
    END IF;
  END LOOP;

  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT * INTO v_coupon FROM coupons WHERE code = p_coupon_code AND is_active = true
      AND (start_date IS NULL OR start_date <= now())
      AND (expiry_date IS NULL OR expiry_date >= now())
      AND (usage_limit IS NULL OR usage_count < usage_limit);

    IF FOUND THEN
      IF v_coupon.type = 'fixed' THEN
        v_discount := LEAST(v_coupon.value, v_subtotal);
      ELSIF v_coupon.type = 'percentage' THEN
        v_discount := v_subtotal * (v_coupon.value / 100.0);
        IF v_coupon.max_discount IS NOT NULL THEN
          v_discount := LEAST(v_discount, v_coupon.max_discount);
        END IF;
      END IF;

      IF v_subtotal < v_coupon.min_order THEN
        v_discount := 0;
      ELSE
        UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
      END IF;
    END IF;
  END IF;

  v_grand_total := v_subtotal - v_discount + v_delivery_charge;

  UPDATE orders
  SET subtotal = v_subtotal, discount = v_discount, delivery_charge = v_delivery_charge, grand_total = v_grand_total
  WHERE id = v_order_id;

  INSERT INTO order_status_history (order_id, status, note)
  VALUES (v_order_id, 'pending', 'Order placed');

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'delivery_charge', v_delivery_charge,
    'grand_total', v_grand_total
  );
END;
$$;
