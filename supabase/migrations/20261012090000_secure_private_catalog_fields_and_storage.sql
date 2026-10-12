-- Protect internal product cost and guest-review contact fields from client Data API access.
-- This migration is a forward fix: it preserves cost values and review submissions.
-- Deploy the matching application changes before applying this migration in Production.

BEGIN;

CREATE TABLE IF NOT EXISTS public.product_costs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (country_code IN ('BD', 'IN')),
  cost_price numeric(12,2),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve existing unit-cost values in a table whose RLS is admin-only.
INSERT INTO public.product_costs (product_id, country_code, cost_price)
SELECT p.id, upper(p.country_code), p.cost_price
FROM public.products AS p
WHERE p.cost_price IS NOT NULL
  AND upper(p.country_code) IN ('BD', 'IN')
ON CONFLICT (product_id) DO UPDATE
SET country_code = EXCLUDED.country_code,
    cost_price = EXCLUDED.cost_price,
    updated_at = now();

-- Remove the legacy duplicate after copying it into the private table.
UPDATE public.products
SET cost_price = NULL
WHERE cost_price IS NOT NULL;

-- Prevent future authenticated/admin inserts from repopulating the legacy column.
CREATE OR REPLACE FUNCTION public.clear_legacy_product_cost_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.cost_price := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_legacy_product_cost_price() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_legacy_product_cost_price() TO service_role;

DROP TRIGGER IF EXISTS trg_clear_legacy_product_cost_price ON public.products;
CREATE TRIGGER trg_clear_legacy_product_cost_price
BEFORE INSERT OR UPDATE OF cost_price ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.clear_legacy_product_cost_price();

ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_costs_admin_branch_access ON public.product_costs;
CREATE POLICY product_costs_admin_branch_access
ON public.product_costs
FOR ALL
TO authenticated
USING (
  public.is_admin()
  AND public.can_access_country(country_code)
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.id = product_costs.product_id
      AND upper(p.country_code) = upper(product_costs.country_code)
  )
)
WITH CHECK (
  public.is_admin()
  AND public.can_access_country(country_code)
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.id = product_costs.product_id
      AND upper(p.country_code) = upper(product_costs.country_code)
  )
);

REVOKE ALL ON TABLE public.product_costs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_costs TO authenticated;

-- Keep customer photo reviews working without giving customers write access to product assets.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Replace table-wide SELECT privileges with explicit column grants.
-- New columns are not automatically exposed; grant them only after review.
DO $$
DECLARE
  product_columns text;
  review_columns text;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO product_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name NOT IN ('cost_price', 'search_vector', 'search_translit');

  EXECUTE 'REVOKE SELECT ON TABLE public.products FROM PUBLIC, anon, authenticated';
  -- Table-level revokes do not remove separately granted column privileges.
  EXECUTE 'REVOKE SELECT (cost_price, search_vector, search_translit) ON TABLE public.products FROM PUBLIC, anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON TABLE public.products TO anon, authenticated', product_columns);

  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO review_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'reviews'
    AND column_name NOT IN ('guest_phone', 'user_id');

  EXECUTE 'REVOKE SELECT ON TABLE public.reviews FROM PUBLIC, anon, authenticated';
  -- Remove any old column-specific grants on PII even if a prior role had one.
  EXECUTE 'REVOKE SELECT (guest_phone, user_id) ON TABLE public.reviews FROM PUBLIC, anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON TABLE public.reviews TO anon, authenticated', review_columns);
  -- These fields are only maintained through private product_costs now.
  EXECUTE 'REVOKE UPDATE (cost_price) ON TABLE public.products FROM PUBLIC, anon, authenticated';
  EXECUTE 'REVOKE INSERT (cost_price) ON TABLE public.products FROM PUBLIC, anon, authenticated';
END
$$;

-- Only an active admin may mutate objects in the public product-images bucket.
-- The bucket remains public for reading storefront images by public URL.
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Storage admins can delete product images" ON storage.objects;

-- Remove known legacy broad write-policy names if an older environment still has them.
DROP POLICY IF EXISTS "Allow Authenticated and Anon Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Updates" ON storage.objects;
DROP POLICY IF EXISTS "Enable Upload and View 1ifhysk_0" ON storage.objects;
DROP POLICY IF EXISTS "Enable Upload and View 1ifhysk_1" ON storage.objects;
DROP POLICY IF EXISTS "Enable Upload and View 1ifhysk_2" ON storage.objects;
DROP POLICY IF EXISTS "Enable Upload and View 1ifhysk_3" ON storage.objects;
DROP POLICY IF EXISTS "Public Access 16wiy3a_0" ON storage.objects;
DROP POLICY IF EXISTS "Public Access 16wiy3a_1" ON storage.objects;
DROP POLICY IF EXISTS "Public Access 16wiy3a_2" ON storage.objects;
DROP POLICY IF EXISTS "Public Access 16wiy3a_3" ON storage.objects;

CREATE POLICY "Storage admins can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Review uploads can insert review images" ON storage.objects;
CREATE POLICY "Review uploads can insert review images"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'review-images' AND name LIKE 'review-%');

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
