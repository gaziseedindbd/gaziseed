-- Step 7: Referral Qualification Logic
-- Adds qualifying_order_id to track which order qualified the referral
-- Adds trigger functions for order insert (qualification) and update (cancellation protection)

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS qualifying_order_id uuid;

-- Function to qualify a referral when a referred customer places their first eligible order
CREATE OR REPLACE FUNCTION public.qualify_referral_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_referral record;
  v_settings record;
  v_existing_order_count int;
BEGIN
  -- Only process orders with a user_id (registered customers)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Load referral settings
  SELECT * INTO v_settings FROM referral_settings WHERE id = 1;

  -- If referral program is OFF, do nothing
  IF v_settings IS NULL OR v_settings.enabled = false THEN
    RETURN NEW;
  END IF;

  -- Find a pending referral where this user is the referred customer
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = NEW.user_id
    AND status = 'pending'
  LIMIT 1;

  -- If no pending referral exists, this is a non-referred customer — do nothing
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check if this is the referred customer's first order (excluding cancelled)
  SELECT count(*) INTO v_existing_order_count
  FROM orders
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
    AND status NOT IN ('cancelled', 'refunded');

  -- Only the first eligible order can qualify the referral
  IF v_existing_order_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Check if order meets minimum eligible order amount (subtotal)
  IF NEW.subtotal < v_settings.min_order_amount THEN
    RETURN NEW;
  END IF;

  -- All conditions met: qualify the referral
  UPDATE referrals
  SET status = 'qualified',
      qualified_at = now(),
      qualifying_order_id = NEW.id,
      updated_at = now()
  WHERE id = v_referral.id
    AND status = 'pending';

  RETURN NEW;
END;
$function$;

-- Function to revoke qualification if the qualifying order is cancelled/refunded
CREATE OR REPLACE FUNCTION public.revoke_referral_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_referral record;
BEGIN
  -- Only act when status changes to cancelled or refunded
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('cancelled', 'refunded')
      AND OLD.status NOT IN ('cancelled', 'refunded')) THEN

    -- Find the referral qualified by this order
    SELECT * INTO v_referral
    FROM referrals
    WHERE qualifying_order_id = NEW.id
      AND status = 'qualified';

    IF FOUND THEN
      -- Revert to pending so it can be re-qualified by a future eligible order
      UPDATE referrals
      SET status = 'pending',
          qualified_at = NULL,
          qualifying_order_id = NULL,
          updated_at = now()
      WHERE id = v_referral.id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT * INTO v_referral
    FROM referrals
    WHERE qualifying_order_id = OLD.id
      AND status = 'qualified';

    IF FOUND THEN
      UPDATE referrals
      SET status = 'pending',
          qualified_at = NULL,
          qualifying_order_id = NULL,
          updated_at = now()
      WHERE id = v_referral.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Drop existing triggers if they exist (idempotent)
DROP TRIGGER IF EXISTS trg_qualify_referral_on_order ON orders;
DROP TRIGGER IF EXISTS trg_revoke_referral_on_cancel ON orders;

-- Create triggers
CREATE TRIGGER trg_qualify_referral_on_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION qualify_referral_on_order();

CREATE TRIGGER trg_revoke_referral_on_cancel
  AFTER UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION revoke_referral_on_cancel();
