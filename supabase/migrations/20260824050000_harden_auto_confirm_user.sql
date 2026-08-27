-- Harden trigger-only auth helper.
-- Keep the existing auto-confirm behavior unchanged.
-- The function is invoked by auth.users trigger, not by clients.

ALTER FUNCTION public.auto_confirm_user()
  SET search_path = public;

REVOKE ALL ON FUNCTION public.auto_confirm_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auto_confirm_user() TO postgres, service_role;
