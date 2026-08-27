-- Keep legacy delivery tables intact for compatibility, but remove their public write surface.
-- Current checkout/order pricing uses calculate_delivery_charge() and does not require
-- customer access to these tables.

DROP POLICY IF EXISTS "Public access policy" ON public.delivery_settings;
DROP POLICY IF EXISTS "Public access policy" ON public.delivery_zones;

CREATE POLICY "Admins can manage delivery settings"
  ON public.delivery_settings
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can manage delivery zones"
  ON public.delivery_zones
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
