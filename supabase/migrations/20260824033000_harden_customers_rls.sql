-- Restrict the legacy customers table to authenticated admins.
-- The table currently has no rows and no user_id ownership column, so
-- owner-based customer policies are not possible without changing the schema.

DROP POLICY IF EXISTS "Public access policy" ON public.customers;

CREATE POLICY "Admins can manage customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
