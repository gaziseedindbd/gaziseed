-- Security remediation: keep product costs and guest review phone numbers private,
-- and restrict product image mutations to active admins.
-- This migration preserves existing storefront reads and admin product editing.
BEGIN;

-- 1) Product acquisition costs: move values out of the public product row.
CREATE TABLE IF NOT EXISTS public.product_private_costs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (country_code IN ('BD', 'IN')),
  cost_price numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_private_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_private_costs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_private_costs TO authenticated;

DROP POLICY IF EXISTS product_private_costs_admin_branch_access ON public.product_private_costs;
CREATE POLICY product_private_costs_admin_branch_access
  ON public.product_private_costs
  FOR ALL
  TO authenticated
  USING (public.can_access_country(country_code))
  WITH CHECK (public.can_access_country(country_code));

CREATE INDEX IF NOT EXISTS idx_product_private_costs_country
  ON public.product_private_costs(country_code);

-- Backfill existing values, then clear them from the table visible to storefront roles.
INSERT INTO public.product_private_costs (product_id, country_code, cost_price)
SELECT id,
       CASE WHEN upper(coalesce(country_code, 'BD')) = 'IN' THEN 'IN' ELSE 'BD' END,
       cost_price
FROM public.products
WHERE cost_price IS NOT NULL
ON CONFLICT (product_id) DO UPDATE
SET country_code = EXCLUDED.country_code,
    cost_price = EXCLUDED.cost_price,
    updated_at = now();

UPDATE public.products
SET cost_price = NULL
WHERE cost_price IS NOT NULL;

-- Compatibility guard: legacy server/admin writes to products.cost_price are redirected
-- to the private table, and the public products row is always stored with NULL cost_price.
CREATE OR REPLACE FUNCTION public.keep_product_cost_private()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_country text;
BEGIN
  v_country := CASE
    WHEN upper(coalesce(NEW.country_code, 'BD')) = 'IN' THEN 'IN'
    ELSE 'BD'
  END;

  IF NEW.cost_price IS NOT NULL THEN
    INSERT INTO public.product_private_costs (product_id, country_code, cost_price)
    VALUES (NEW.id, v_country, NEW.cost_price)
    ON CONFLICT (product_id) DO UPDATE
    SET country_code = EXCLUDED.country_code,
        cost_price = EXCLUDED.cost_price,
        updated_at = now();
  ELSIF TG_OP = 'UPDATE' AND NEW.country_code IS DISTINCT FROM OLD.country_code THEN
    UPDATE public.product_private_costs
    SET country_code = v_country, updated_at = now()
    WHERE product_id = NEW.id;
  END IF;

  NEW.cost_price := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS zz_private_product_cost ON public.products;
CREATE TRIGGER zz_private_product_cost
  BEFORE INSERT OR UPDATE OF cost_price, country_code
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_product_cost_private();

REVOKE ALL ON FUNCTION public.keep_product_cost_private() FROM PUBLIC, anon, authenticated;

-- 2) Guest review phone numbers: retain the phone only in a private, branch-scoped table.
CREATE TABLE IF NOT EXISTS public.review_private_details (
  review_id uuid PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (country_code IN ('BD', 'IN')),
  guest_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_private_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.review_private_details FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.review_private_details TO authenticated;

DROP POLICY IF EXISTS review_private_details_admin_branch_access ON public.review_private_details;
CREATE POLICY review_private_details_admin_branch_access
  ON public.review_private_details
  FOR ALL
  TO authenticated
  USING (public.can_access_country(country_code))
  WITH CHECK (public.can_access_country(country_code));

CREATE INDEX IF NOT EXISTS idx_review_private_details_country
  ON public.review_private_details(country_code);

-- Preserve existing guest contact details without leaving them on the public reviews row.
INSERT INTO public.review_private_details (review_id, country_code, guest_phone)
SELECT id,
       CASE WHEN upper(coalesce(country_code, 'BD')) = 'IN' THEN 'IN' ELSE 'BD' END,
       guest_phone
FROM public.reviews
WHERE guest_phone IS NOT NULL AND btrim(guest_phone) <> ''
ON CONFLICT (review_id) DO UPDATE
SET country_code = EXCLUDED.country_code,
    guest_phone = EXCLUDED.guest_phone,
    updated_at = now();

UPDATE public.reviews
SET guest_phone = NULL
WHERE guest_phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.keep_review_guest_phone_private()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_country text;
BEGIN
  v_country := CASE
    WHEN upper(coalesce(NEW.country_code, 'BD')) = 'IN' THEN 'IN'
    ELSE 'BD'
  END;

  IF NEW.guest_phone IS NOT NULL AND btrim(NEW.guest_phone) <> '' THEN
    INSERT INTO public.review_private_details (review_id, country_code, guest_phone)
    VALUES (NEW.id, v_country, btrim(NEW.guest_phone))
    ON CONFLICT (review_id) DO UPDATE
    SET country_code = EXCLUDED.country_code,
        guest_phone = EXCLUDED.guest_phone,
        updated_at = now();
  ELSIF TG_OP = 'UPDATE' AND NEW.country_code IS DISTINCT FROM OLD.country_code THEN
    UPDATE public.review_private_details
    SET country_code = v_country, updated_at = now()
    WHERE review_id = NEW.id;
  END IF;

  NEW.guest_phone := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS zz_private_review_guest_phone ON public.reviews;
CREATE TRIGGER zz_private_review_guest_phone
  BEFORE INSERT OR UPDATE OF guest_phone, country_code
  ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_review_guest_phone_private();

REVOKE ALL ON FUNCTION public.keep_review_guest_phone_private() FROM PUBLIC, anon, authenticated;

-- 3) Storage object writes are admin-only. Public bucket reads remain public.
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can upload" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can update" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can delete" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can delete product images" ON storage.objects;

CREATE POLICY "Storage admins can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Storage admins can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Storage admins can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

COMMIT;
