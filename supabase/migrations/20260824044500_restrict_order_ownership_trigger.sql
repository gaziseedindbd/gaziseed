-- Restrict direct execution of the trigger-only order ownership guard.
-- The trigger invokes this function; clients do not need RPC access.

REVOKE ALL ON FUNCTION public.guard_order_user_ownership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_order_user_ownership() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_order_user_ownership() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.guard_order_user_ownership() TO postgres, service_role;
