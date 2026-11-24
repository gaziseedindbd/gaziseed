-- Fix only the product_name snapshot written by the standard create_order() RPC.
-- Re-resolve the current cart item's product title in the second item loop.
-- No order totals, pricing, delivery, stock, payment, or historical order data changes.
DO $migration$
DECLARE
  v_signature regprocedure := 'public.create_order(text,text,text,jsonb,text,uuid,text,text,uuid)'::regprocedure;
  v_definition text;
  v_updated text;
  v_marker text := '    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price, bundle_id, variant_id, country_code)';
  v_replacement text := $replacement$
    SELECT COALESCE(
      NULLIF(p.name_bn, ''),
      NULLIF(p.name_en, ''),
      NULLIF(p.title, ''),
      NULLIF(p.name, ''),
      'Product'
    )
    INTO v_prod_title
    FROM public.products p
    WHERE p.id = v_item.product_id
      AND p.is_active = true
      AND upper(p.country_code) = v_country;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product is unavailable in your country: %', v_item.product_id;
    END IF;

    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price, bundle_id, variant_id, country_code)
$replacement$;
BEGIN
  SELECT pg_get_functiondef(v_signature) INTO v_definition;

  IF v_definition IS NULL
     OR position('v_prod_title text;' IN v_definition) = 0
     OR position(v_marker IN v_definition) = 0
     OR position(v_marker IN substring(v_definition FROM position(v_marker IN v_definition) + length(v_marker))) > 0 THEN
    RAISE EXCEPTION 'create_order definition differs from the reviewed version; refusing to patch';
  END IF;

  v_updated := replace(v_definition, v_marker, v_replacement);

  IF v_updated = v_definition
     OR position('INTO v_prod_title' IN v_updated) = 0
     OR position('AND upper(p.country_code) = v_country;' IN v_updated) = 0 THEN
    RAISE EXCEPTION 'Could not safely apply per-item product-name lookup';
  END IF;

  EXECUTE v_updated;
END;
$migration$;
