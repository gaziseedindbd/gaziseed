-- Remove broad table reads from browser roles and grant only storefront-safe
-- product columns. Apply after the application switches to explicit selects.
REVOKE SELECT ON TABLE public.products FROM PUBLIC, anon, authenticated;
REVOKE SELECT (cost_price, search_vector, search_translit)
  ON TABLE public.products FROM PUBLIC, anon, authenticated;

DO $product_grants$
DECLARE
  v_safe_columns text;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO v_safe_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name NOT IN ('cost_price', 'search_vector', 'search_translit');

  IF v_safe_columns IS NULL THEN
    RAISE EXCEPTION 'No safe products columns found; refusing to alter product access';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON TABLE public.products TO anon, authenticated',
    v_safe_columns
  );
END;
$product_grants$;

-- Existing RLS policies continue to constrain writes to branch admins.
GRANT INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
