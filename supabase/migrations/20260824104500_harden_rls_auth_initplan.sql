-- SAFE-ZONE performance hardening only.
-- Replace per-row auth.uid() evaluation in selected RLS policies with
-- init-plan-friendly (select auth.uid()).
-- Authorization semantics remain unchanged.
-- No tables, columns, data, order logic, checkout logic, or admin hierarchy changes.

ALTER POLICY "Users can view own order items"
ON public.order_items
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id = (select auth.uid())
  )
);

ALTER POLICY "Users can manage own customer_addresses"
ON public.customer_addresses
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can view own admin profile"
ON public.admin_users
USING (user_id = (select auth.uid()));

ALTER POLICY "Users can manage their own addresses"
ON public.addresses
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));
