-- Step 9B: Referral Reward Issue Ledger
-- Creates exactly ONE referral_rewards record when a referral's reward_status becomes 'calculated'
-- Uses the existing referral_rewards table — no new tables, no wallet, no balance

-- Add unique constraint on referral_id to enforce one reward record per referral at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_referral_id_unique
  ON referral_rewards (referral_id);

-- Function to issue reward into the ledger when reward_status becomes 'calculated'
CREATE OR REPLACE FUNCTION public.issue_referral_reward_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_existing_count int;
  v_order record;
BEGIN
  -- Only act when reward_status transitions TO 'calculated'
  IF NEW.reward_status = 'calculated'
     AND (OLD.reward_status IS NULL OR OLD.reward_status <> 'calculated') THEN

    -- Safety: referral must be qualified
    IF NEW.status <> 'qualified' THEN
      RETURN NEW;
    END IF;

    -- Safety: reward_amount must be positive
    IF NEW.reward_amount IS NULL OR NEW.reward_amount <= 0 THEN
      RETURN NEW;
    END IF;

    -- Safety: qualifying_order_id must exist
    IF NEW.qualifying_order_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Safety: check the qualifying order is not cancelled/refunded
    SELECT * INTO v_order FROM orders WHERE id = NEW.qualifying_order_id;
    IF NOT FOUND OR v_order.status IN ('cancelled', 'refunded') THEN
      RETURN NEW;
    END IF;

    -- Safety: check referral settings — program must be enabled
    IF NOT EXISTS (SELECT 1 FROM referral_settings WHERE id = 1 AND enabled = true) THEN
      RETURN NEW;
    END IF;

    -- Duplicate protection: if a reward record already exists for this referral, do nothing
    SELECT count(*) INTO v_existing_count
    FROM referral_rewards
    WHERE referral_id = NEW.id;

    IF v_existing_count > 0 THEN
      RETURN NEW;
    END IF;

    -- Create exactly ONE reward ledger record
    -- recipient = referrer (the person who shared their code)
    INSERT INTO referral_rewards (
      referral_id,
      order_id,
      recipient_id,
      reward_type,
      reward_value,
      status,
      issued_at
    ) VALUES (
      NEW.id,
      NEW.qualifying_order_id,
      NEW.referrer_id,
      NEW.reward_type,
      NEW.reward_amount,
      'issued',
      now()
    );

    -- Mark the referral as rewarded
    NEW.reward_status := 'issued';
    NEW.rewarded_at := now();

    RETURN NEW;
  END IF;

  -- If referral reverts to pending/cancelled, clean up un-issued rewards
  IF NEW.status <> 'qualified' AND OLD.status = 'qualified' THEN
    -- Delete any 'issued' reward that hasn't been redeemed yet
    DELETE FROM referral_rewards
    WHERE referral_id = NEW.id
      AND status = 'issued'
      AND redeemed_at IS NULL;

    -- Reset reward fields (already handled by calculate_referral_reward BEFORE trigger,
    -- but ensure consistency)
    NEW.reward_status := 'none';
    NEW.rewarded_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trg_issue_referral_reward_ledger ON referrals;

-- Create AFTER UPDATE trigger (fires after calculate_referral_reward BEFORE trigger)
CREATE TRIGGER trg_issue_referral_reward_ledger
  AFTER UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION issue_referral_reward_ledger();
