-- Harden master-admin authorization helper search_path only.
-- Preserve SECURITY DEFINER behavior and authenticated/service_role execution.

ALTER FUNCTION public.is_master_admin()
  SET search_path = public;
