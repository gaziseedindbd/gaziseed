-- Finish removing multiple permissive RLS overlaps identified in the live schema.
--
-- These three tables intentionally expose active rows to both anonymous and
-- authenticated visitors. Keep that public SELECT policy for both roles, but
-- split the separate authenticated admin ALL policy so SELECT is handled by
-- the existing public-read policy instead of two permissive policies.
--
-- messenger_customer_profiles had a SELECT policy that was fully redundant
-- with its authenticated ALL policy. The ALL policy already uses the same
-- optimized auth.uid() init-plan expression, so remove only the redundant
-- SELECT policy.

DROP POLICY IF EXISTS delivery_charge_rules_admin_branch_all ON public.delivery_charge_rules;
CREATE POLICY delivery_charge_rules_admin_branch_insert ON public.delivery_charge_rules
  FOR INSERT TO authenticated
  WITH CHECK (can_access_country(country_code));
CREATE POLICY delivery_charge_rules_admin_branch_update ON public.delivery_charge_rules
  FOR UPDATE TO authenticated
  USING (can_access_country(country_code))
  WITH CHECK (can_access_country(country_code));
CREATE POLICY delivery_charge_rules_admin_branch_delete ON public.delivery_charge_rules
  FOR DELETE TO authenticated
  USING (can_access_country(country_code));

DROP POLICY IF EXISTS delivery_country_settings_admin_branch_all ON public.delivery_country_settings;
CREATE POLICY delivery_country_settings_admin_branch_insert ON public.delivery_country_settings
  FOR INSERT TO authenticated
  WITH CHECK (can_access_country(country_code));
CREATE POLICY delivery_country_settings_admin_branch_update ON public.delivery_country_settings
  FOR UPDATE TO authenticated
  USING (can_access_country(country_code))
  WITH CHECK (can_access_country(country_code));
CREATE POLICY delivery_country_settings_admin_branch_delete ON public.delivery_country_settings
  FOR DELETE TO authenticated
  USING (can_access_country(country_code));

DROP POLICY IF EXISTS homepage_promos_admin_branch_all ON public.homepage_promos;
CREATE POLICY homepage_promos_admin_branch_insert ON public.homepage_promos
  FOR INSERT TO authenticated
  WITH CHECK (can_access_country(country_code));
CREATE POLICY homepage_promos_admin_branch_update ON public.homepage_promos
  FOR UPDATE TO authenticated
  USING (can_access_country(country_code))
  WITH CHECK (can_access_country(country_code));
CREATE POLICY homepage_promos_admin_branch_delete ON public.homepage_promos
  FOR DELETE TO authenticated
  USING (can_access_country(country_code));

DROP POLICY IF EXISTS admins_read_messenger_customer_profiles ON public.messenger_customer_profiles;
