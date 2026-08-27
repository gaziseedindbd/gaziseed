-- Harden trigger-only order number helper.
-- Existing order numbering behavior remains unchanged.

ALTER FUNCTION public.set_order_number()
  SET search_path = public;

REVOKE ALL ON FUNCTION public.set_order_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_number() TO postgres, service_role;
