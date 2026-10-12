-- Read-only regression checks for the private-column/Storage forward migration.
-- Run after applying 20261012090000_secure_private_catalog_fields_and_storage.sql
-- against the intended test database, not as part of the Production audit.

DO $$
DECLARE
  policy_check text;
BEGIN
  IF has_column_privilege('anon', 'public.products', 'cost_price', 'SELECT')
     OR has_column_privilege('authenticated', 'public.products', 'cost_price', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: products.cost_price remains SELECT-accessible to client roles';
  END IF;

  IF has_column_privilege('anon', 'public.reviews', 'guest_phone', 'SELECT')
     OR has_column_privilege('authenticated', 'public.reviews', 'guest_phone', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: reviews.guest_phone remains SELECT-accessible to client roles';
  END IF;

  IF has_column_privilege('anon', 'public.reviews', 'user_id', 'SELECT')
     OR has_column_privilege('authenticated', 'public.reviews', 'user_id', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: reviews.user_id remains SELECT-accessible to client roles';
  END IF;

  IF NOT has_column_privilege('anon', 'public.products', 'id', 'SELECT')
     OR NOT has_column_privilege('anon', 'public.reviews', 'id', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: public product/review read fields were accidentally removed';
  END IF;

  IF has_table_privilege('anon', 'public.product_costs', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon has table-level SELECT on product_costs';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.products WHERE cost_price IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: legacy products.cost_price still contains duplicated private values';
  END IF;

  SELECT with_check INTO policy_check
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Storage admins can upload product images'
    AND cmd = 'INSERT';

  IF policy_check IS NULL OR position('is_admin' IN policy_check) = 0 THEN
    RAISE EXCEPTION 'FAIL: product image upload policy is not admin-scoped';
  END IF;

  SELECT with_check INTO policy_check
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Review uploads can insert review images'
    AND cmd = 'INSERT';

  IF policy_check IS NULL OR position('review-images' IN policy_check) = 0 THEN
    RAISE EXCEPTION 'FAIL: separate review-image upload policy is missing';
  END IF;
END
$$;
