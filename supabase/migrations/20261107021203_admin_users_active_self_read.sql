GRANT SELECT ON TABLE public.admin_users TO authenticated;

CREATE POLICY admin_users_select_active_self
ON public.admin_users
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id AND is_active IS TRUE);
