-- SAFE-ZONE: tighten public order RPC identity handling without changing checkout entrypoints.
-- Anonymous callers must not be able to inject an arbitrary user_id.
-- Authenticated callers may only use their own auth.uid().
-- service_role/background jobs retain existing ability to set an explicit user_id.

CREATE OR REPLACE FUNCTION public.guard_order_user_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'anon' THEN
    NEW.user_id := NULL;
  ELSIF auth.uid() IS NOT NULL
        AND NEW.user_id IS NOT NULL
        AND NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Order user_id must match the authenticated user';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_order_user_ownership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_order_user_ownership() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_order_user_ownership() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.guard_order_user_ownership() TO postgres, service_role;
