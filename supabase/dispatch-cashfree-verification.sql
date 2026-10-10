-- Apply only after the Cashfree verification route and server credentials are ready.
-- All India prepaid/advance-paid dispatch transitions require trusted server-side verification.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cashfree_dispatch_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_cashfree_verified_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Prevent changing an India Cashfree order into another branch to bypass shipment controls.
  IF upper(coalesce(OLD.country_code, '')) = 'IN'
    AND NEW.country_code IS DISTINCT FROM OLD.country_code
    AND (
      lower(coalesce(OLD.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(OLD.payment_status, '')) IN ('paid', 'partially_paid')
      OR coalesce(OLD.payment_advance_amount, 0) > 0
      OR EXISTS (SELECT 1 FROM public.cashfree_payment_intents i WHERE i.completed_order_id = OLD.id)
    )
    AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
  THEN
    RAISE EXCEPTION 'Cannot change branch of India Cashfree-paid order';
  END IF;

  IF (upper(coalesce(NEW.country_code, '')) = 'IN'
      OR upper(coalesce(OLD.country_code, '')) = 'IN')
    AND lower(coalesce(OLD.status, '')) NOT IN ('shipped', 'delivered')
    AND lower(coalesce(NEW.status, '')) IN ('shipped', 'delivered')
    AND (
      lower(coalesce(NEW.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(OLD.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(NEW.payment_status, '')) IN ('paid', 'partially_paid')
      OR lower(coalesce(OLD.payment_status, '')) IN ('paid', 'partially_paid')
      OR coalesce(NEW.payment_advance_amount, 0) > 0
      OR coalesce(OLD.payment_advance_amount, 0) > 0
      OR EXISTS (
        SELECT 1 FROM public.cashfree_payment_intents i
        WHERE i.completed_order_id = NEW.id
      )
    )
  THEN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
       OR NEW.cashfree_dispatch_verified_at IS NULL
       OR NEW.cashfree_dispatch_verified_at < now() - interval '5 minutes'
       OR NOT EXISTS (
          SELECT 1 FROM public.cashfree_payment_intents i
          WHERE i.completed_order_id = NEW.id
            AND i.status = 'completed'
            AND upper(i.currency) = 'INR'
       )
    THEN
      RAISE EXCEPTION 'India paid orders require fresh verified Cashfree payment before dispatch'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zzz_guard_cashfree_verified_dispatch ON public.orders;
CREATE TRIGGER zzz_guard_cashfree_verified_dispatch
BEFORE UPDATE OF status, order_status, country_code ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_cashfree_verified_dispatch();

-- Do not allow browser/admin clients to forge a verification timestamp.
REVOKE UPDATE (cashfree_dispatch_verified_at) ON public.orders FROM authenticated, anon;
