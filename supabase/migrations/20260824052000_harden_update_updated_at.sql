-- Harden trigger-only timestamp helper.
-- Existing trigger behavior remains unchanged.

ALTER FUNCTION public.update_updated_at()
  SET search_path = public;

REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO postgres, service_role;
