-- Make India's free-delivery threshold inclusive at the configured amount.
-- ₹500 and above is free; amounts below ₹500 keep the standard ₹80 fee.
DO $migration$
DECLARE
  v_standard_rows integer;
  v_free_rows integer;
BEGIN
  UPDATE public.delivery_charge_rules
  SET max_order = 499.99, updated_at = now()
  WHERE upper(country_code) = 'IN'
    AND is_active = true
    AND coalesce(is_free, false) = false
    AND min_order = 0
    AND max_order = 500
    AND charge = 80;

  GET DIAGNOSTICS v_standard_rows = ROW_COUNT;

  UPDATE public.delivery_charge_rules
  SET min_order = 500, updated_at = now()
  WHERE upper(country_code) = 'IN'
    AND is_active = true
    AND coalesce(is_free, false) = true
    AND min_order = 500.01
    AND max_order IS NULL
    AND charge = 0;

  GET DIAGNOSTICS v_free_rows = ROW_COUNT;

  IF v_standard_rows <> 1 OR v_free_rows <> 1 THEN
    RAISE EXCEPTION 'Unexpected active India delivery rules: standard rows %, free rows %', v_standard_rows, v_free_rows;
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.admin_set_simple_delivery_policy(
  p_country text,
  p_threshold numeric,
  p_charge numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_country text := upper(trim(coalesce(p_country, '')));
  v_standard_max numeric;
  v_free_min numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() OR public.current_admin_country() <> v_country THEN
    RAISE EXCEPTION 'Not authorized for delivery settings';
  END IF;

  IF v_country NOT IN ('IN', 'BD') OR p_threshold IS NULL OR p_charge IS NULL
     OR p_threshold < 0 OR p_threshold > 1000000
     OR p_charge < 0 OR p_charge > 100000
     OR p_threshold <> round(p_threshold, 2)
     OR p_charge <> round(p_charge, 2) THEN
    RAISE EXCEPTION 'Invalid delivery threshold or charge';
  END IF;

  -- India threshold is inclusive. Keep Bangladesh's existing "above threshold" rule unchanged.
  v_standard_max := CASE WHEN v_country = 'IN' THEN greatest(p_threshold - 0.01, 0) ELSE p_threshold END;
  v_free_min := CASE WHEN v_country = 'IN' THEN p_threshold ELSE p_threshold + 0.01 END;

  PERFORM pg_advisory_xact_lock(hashtext('delivery_policy_' || v_country));

  UPDATE public.delivery_charge_rules
  SET is_active = false, updated_at = now()
  WHERE country_code = v_country AND is_active = true;

  INSERT INTO public.delivery_charge_rules
    (country_code, title, subtitle, min_order, max_order, charge, currency, is_free, featured, display_order, is_active)
  VALUES
    (v_country, 'Standard delivery', 'Delivery fee below ' || p_threshold, 0, v_standard_max, p_charge,
     CASE WHEN v_country = 'IN' THEN 'INR' ELSE 'BDT' END, false, false, 1, true),
    (v_country, 'Free delivery', 'Free on/above ' || p_threshold, v_free_min, null, 0,
     CASE WHEN v_country = 'IN' THEN 'INR' ELSE 'BDT' END, true, true, 2, true);
END;
$function$;
