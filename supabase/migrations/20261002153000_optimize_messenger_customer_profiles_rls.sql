ALTER POLICY admins_read_messenger_customer_profiles
  ON public.messenger_customer_profiles
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );

ALTER POLICY admins_write_messenger_customer_profiles
  ON public.messenger_customer_profiles
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );