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
  EXECUTE format('GRANT SELECT (%s) ON TABLE public.products TO anon, authenticated', product_columns);

  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO review_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'reviews'
    AND column_name NOT IN ('guest_phone', 'user_id');

  EXECUTE 'REVOKE SELECT ON TABLE public.reviews FROM PUBLIC, anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON TABLE public.reviews TO anon, authenticated', review_columns);
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
