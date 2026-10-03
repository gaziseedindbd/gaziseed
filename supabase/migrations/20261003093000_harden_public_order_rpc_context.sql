-- Defense-in-depth hardening for the remaining public order RPC flows.
-- These triggers do not replace the RPC validation. They protect the final
-- orders/order_items writes against branch/phone/country inconsistencies if
-- the public SECURITY DEFINER RPCs are called directly.
--
-- Public-client requests are validated; service-role/background jobs are left
-- untouched.

CREATE OR REPLACE FUNCTION public.validate_public_offer_order_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, pg_temp'
AS $function$
DECLARE
  v_country text;
  v_phone text;
  v_combo_id uuid;
  v_package_id uuid;
  v_product_id uuid;
  v_page_country text;
  v_package_country text;
  v_product_country text;
  v_combo_country text;
begin
  IF auth.role() NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  v_country := public.current_visitor_country();
  v_phone := regexp_replace(coalesce(NEW.customer_phone, ''), '[^0-9]', '', 'g');

  IF v_country = 'IN' AND v_phone !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Enter a valid 10-digit Indian mobile number';
  END IF;

  IF v_country = 'BD' AND v_phone !~ '^01[0-9]{9}$' THEN
    RAISE EXCEPTION 'Enter a valid Bangladesh mobile number';
  END IF;

  IF NEW.delivery_zone_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.delivery_zones dz
       WHERE dz.id = NEW.delivery_zone_id
         AND dz.is_active = true
         AND upper(coalesce(dz.country_code, 'BD')) = v_country
     ) THEN
    RAISE EXCEPTION 'Selected delivery zone is not available in your country';
  END IF;

  -- Combo public checkout payloads carry combo_id in the first item.
  v_combo_id := NULLIF(NEW.items->0->>'combo_id', '')::uuid;

  IF v_combo_id IS NOT NULL THEN
    SELECT upper(coalesce(cp.country_code, 'BD'))
      INTO v_combo_country
    FROM public.combo_packs cp
    WHERE cp.id = v_combo_id
      AND coalesce(cp.is_active, true) = true;

    IF v_combo_country IS NULL OR v_combo_country <> v_country THEN
      RAISE EXCEPTION 'Combo is unavailable in your country';
    END IF;

    NEW.country_code := v_country;
    RETURN NEW;
  END IF;

  -- Animated landing public checkout payloads carry package_id + product_id.
  v_package_id := NULLIF(NEW.items->0->>'package_id', '')::uuid;
  v_product_id := NULLIF(NEW.items->0->>'product_id', '')::uuid;

  IF v_package_id IS NOT NULL THEN
    SELECT
      upper(coalesce(p.country_code, 'BD')),
      upper(coalesce(q.country_code, 'BD')),
      upper(coalesce(pr.country_code, 'BD'))
      INTO v_page_country, v_package_country, v_product_country
    FROM public.animated_landing_packages q
    JOIN public.animated_landing_pages p
      ON p.id = q.landing_page_id
    JOIN public.products pr
      ON pr.id = q.product_id
    WHERE q.id = v_package_id
      AND q.product_id = v_product_id
      AND p.product_id = v_product_id
      AND p.status = 'active'
      AND q.is_active = true
      AND pr.is_active = true
    LIMIT 1;

    IF v_page_country IS NULL
       OR v_package_country <> v_country
       OR v_page_country <> v_country
       OR v_product_country <> v_country THEN
      RAISE EXCEPTION 'Animated landing offer is unavailable in your country';
    END IF;

    NEW.country_code := v_country;
    RETURN NEW;
  END IF;

  RETURN NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_validate_public_offer_order_context ON public.orders;

CREATE TRIGGER trg_validate_public_offer_order_context
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_public_offer_order_context();

CREATE OR REPLACE FUNCTION public.sync_public_offer_order_item_country()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, pg_temp'
AS $function$
DECLARE
  v_country text;
BEGIN
  SELECT upper(coalesce(o.country_code, 'BD'))
    INTO v_country
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF v_country IN ('BD', 'IN') THEN
    NEW.country_code := v_country;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_public_offer_order_item_country ON public.order_items;

CREATE TRIGGER trg_sync_public_offer_order_item_country
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_offer_order_item_country();

REVOKE ALL ON FUNCTION public.validate_public_offer_order_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_public_offer_order_item_country() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_public_offer_order_context() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.sync_public_offer_order_item_country() TO postgres, service_role;
