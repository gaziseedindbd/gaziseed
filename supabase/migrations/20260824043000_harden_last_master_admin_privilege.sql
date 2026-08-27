-- Restrict direct execution of the last-master-admin trigger function.
-- The function is invoked by the admin_users trigger; callers do not need RPC access.

REVOKE ALL ON FUNCTION public.guard_last_master_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_last_master_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_last_master_admin() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.guard_last_master_admin() TO postgres, service_role;
