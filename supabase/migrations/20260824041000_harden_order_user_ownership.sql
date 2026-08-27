-- Prevent authenticated callers from assigning an order to a different user.
-- Guest orders (NULL user_id) remain allowed, and service-role/background jobs are not
-- blocked because auth.uid() is NULL outside a user session.

CREATE OR REPLACE FUNCTION public.guard_order_user_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.user_id IS NOT NULL
     AND NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Order user_id must match the authenticated user';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_order_user_ownership ON public.orders;

CREATE TRIGGER trg_guard_order_user_ownership
BEFORE INSERT OR UPDATE OF user_id ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_order_user_ownership();
