-- Restrict admin helper RPCs to authenticated/service roles.
-- These helpers return only authorization booleans and are not needed by anonymous customers.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_master_admin() FROM PUBLIC, anon;
