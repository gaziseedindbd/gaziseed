-- Ensure the standard checkout's server-authoritative order quote honors product-level free delivery.
-- This migration patches the existing function definition without changing delivery slabs,
-- order totals, payment flows, inventory logic, or any existing order data.
DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_signature regprocedure := 'public.create_order(text,text,text,jsonb,text,uuid,text,text,uuid)'::regprocedure;
BEGIN
  SELECT pg_get_functiondef(v_signature) INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Expected public.create_order checkout overload was not found';
  END IF;

  IF position('v_bundle_free_delivery boolean;' IN v_definition) = 0
     OR position('SELECT p.stock, p.min_order_qty, p.max_order_qty,' IN v_definition) = 0
     OR position('INTO v_stock, v_min_qty, v_max_qty, v_prod_title' IN v_definition) = 0
     OR position('IF NOT FOUND THEN RAISE EXCEPTION ''Product is unavailable in your country: %'', v_item.product_id; END IF;' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'create_order definition differs from the reviewed version; refusing to patch automatically';
  END IF;

  v_updated := replace(
    v_definition,
    'v_bundle_free_delivery boolean;',
    'v_bundle_free_delivery boolean;
  v_product_free_delivery boolean := false;'
  );

  v_updated := replace(
    v_updated,
    'SELECT p.stock, p.min_order_qty, p.max_order_qty,',
    'SELECT p.stock, p.min_order_qty, p.max_order_qty,
      COALESCE(p.free_delivery, false),'
  );

  v_updated := replace(
    v_updated,
    'INTO v_stock, v_min_qty, v_max_qty, v_prod_title',
    'INTO v_stock, v_min_qty, v_max_qty, v_product_free_delivery, v_prod_title'
  );

  v_updated := replace(
    v_updated,
    'IF NOT FOUND THEN RAISE EXCEPTION ''Product is unavailable in your country: %'', v_item.product_id; END IF;',
    'IF NOT FOUND THEN RAISE EXCEPTION ''Product is unavailable in your country: %'', v_item.product_id; END IF;

    -- A free-delivery product makes the complete cart eligible for free delivery.
    v_free_delivery := v_free_delivery OR v_product_free_delivery;'
  );

  IF v_updated = v_definition
     OR position('v_product_free_delivery boolean := false;' IN v_updated) = 0
     OR position('COALESCE(p.free_delivery, false)' IN v_updated) = 0
     OR position('v_free_delivery := v_free_delivery OR v_product_free_delivery;' IN v_updated) = 0 THEN
    RAISE EXCEPTION 'Could not safely apply all product free-delivery changes';
  END IF;

  EXECUTE v_updated;
END;
$migration$;
