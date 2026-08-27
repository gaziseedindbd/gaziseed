-- Step 8: Referral Reward Calculation
-- Adds reward storage columns to referrals table
-- Adds trigger to calculate reward when referral becomes qualified

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS reward_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS reward_type text,
  ADD COLUMN IF NOT EXISTS reward_status text DEFAULT 'none';

-- Function to calculate and store reward when a referral becomes qualified
-- This ONLY calculates and stores the reward amount. It does NOT transfer money,
-- modify wallet balance, modify order total, or issue discounts.
CREATE OR REPLACE FUNCTION public.calculate_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_settings record;
  v_order record;
  v_reward numeric(12,2);
  v_reward_type text;
BEGIN
  -- Only act when status changes TO 'qualified' (not from)
  IF NEW.status = 'qualified' AND (OLD.status IS NULL OR OLD.status <> 'qualified') THEN

    -- Load referral settings
    SELECT * INTO v_settings FROM referral_settings WHERE id = 1;

    -- If referral program is OFF, do nothing
    IF v_settings IS NULL OR v_settings.enabled = false THEN
      RETURN NEW;
    END IF;

    -- Safety: only calculate for qualified referrals
    -- (already guaranteed by the trigger condition above)

    -- Get the qualifying order for subtotal reference
    SELECT * INTO v_order FROM orders WHERE id = NEW.qualifying_order_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    v_reward_type := v_settings.reward_type;

    -- Calculate reward based on type
    IF v_settings.reward_type = 'fixed' THEN
      v_reward := COALESCE(v_settings.reward_value, 0);
    ELSIF v_settings.reward_type = 'percentage' THEN
      v_reward := v_order.subtotal * COALESCE(v_settings.reward_value, 0) / 100.0;
    ELSE
      v_reward := 0;
    END IF;

    -- Never allow negative reward
    IF v_reward < 0 THEN
      v_reward := 0;
    END IF;

    -- Apply maximum reward cap if set
    IF v_settings.max_reward_per_referral IS NOT NULL THEN
      v_reward := LEAST(v_reward, v_settings.max_reward_per_referral);
    END IF;

    -- Round to 2 decimal places
    v_reward := ROUND(v_reward, 2);

    -- Store the calculated reward (status = 'calculated' = computed but not yet issued)
    NEW.reward_amount := v_reward;
    NEW.reward_type := v_reward_type;
    NEW.reward_status := 'calculated';
    -- rewarded_at stays NULL until reward is actually issued (future step)

    RETURN NEW;
  END IF;

  -- If status is NOT qualified (pending, cancelled, etc.), ensure no reward
  IF NEW.status <> 'qualified' THEN
    NEW.reward_amount := NULL;
    NEW.reward_type := NULL;
    NEW.reward_status := 'none';
    NEW.rewarded_at := NULL;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trg_calculate_referral_reward ON referrals;

-- Create BEFORE UPDATE trigger to calculate reward when status becomes qualified
CREATE TRIGGER trg_calculate_referral_reward
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_referral_reward();
