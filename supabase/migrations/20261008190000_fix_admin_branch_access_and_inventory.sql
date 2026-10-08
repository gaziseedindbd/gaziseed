-- Admin branch scoped access for operational queues and configurable landing content.
-- Existing anonymous/customer INSERT policies are intentionally preserved.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'contact_messages',
    'support_tickets',
    'stock_notifications',
    'combo_packs',
    'combo_items',
    'landing_pages',
    'bundle_offers',
    'quantity_offers',
    'landing_reviews',
    'landing_faqs',
    'animated_landing_pages',
    'animated_landing_packages',
    'navigation'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_table || '_admin_branch_access', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_access_country(country_code)) WITH CHECK (public.can_access_country(country_code))',
      target_table || '_admin_branch_access',
      target_table
    );
  END LOOP;
END $$;

-- Keep stock and its audit history in one transaction, so neither can persist alone.
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(p_product_id uuid, p_new_stock integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old_stock integer;
BEGIN
  IF p_new_stock IS NULL OR p_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock must be a non-negative integer';
  END IF;

  SELECT stock
    INTO v_old_stock
    FROM public.products
   WHERE id = p_product_id
     AND country_code = public.current_admin_country()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in the selected admin branch';
  END IF;

  UPDATE public.products
     SET stock = p_new_stock
   WHERE id = p_product_id
     AND country_code = public.current_admin_country();

  IF p_new_stock <> v_old_stock THEN
    INSERT INTO public.inventory_history (product_id, quantity_change, reason)
    VALUES (p_product_id, p_new_stock - v_old_stock, 'Manual adjustment');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_inventory_stock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(uuid, integer) TO authenticated;
