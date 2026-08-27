-- Step 9B: Referral Reward Issue Ledger
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_referral_id_unique
  ON referral_rewards (referral_id);

CREATE OR REPLACE FUNCTION public.issue_referral_reward_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_existing_count int;
  v_order record;
BEGIN
  IF NEW.reward_status = 'calculated'
     AND (OLD.reward_status IS NULL OR OLD.reward_status <> 'calculated') THEN
    IF NEW.status <> 'qualified' THEN
      RETURN NEW;
    END IF;
    IF NEW.reward_amount IS NULL OR NEW.reward_amount <= 0 THEN
      RETURN NEW;
    END IF;
    IF NEW.qualifying_order_id IS NULL THEN
      RETURN NEW;
    END IF;
    SELECT * INTO v_order FROM orders WHERE id = NEW.qualifying_order_id;
    IF NOT FOUND OR v_order.status IN ('cancelled', 'refunded') THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM referral_settings WHERE id = 1 AND enabled = true) THEN
      RETURN NEW;
    END IF;
    SELECT count(*) INTO v_existing_count
    FROM referral_rewards
    WHERE referral_id = NEW.id;
    IF v_existing_count > 0 THEN
      RETURN NEW;
    END IF;
    INSERT INTO referral_rewards (
      referral_id, order_id, recipient_id, reward_type, reward_value, status, issued_at
    ) VALUES (
      NEW.id, NEW.qualifying_order_id, NEW.referrer_id, NEW.reward_type, NEW.reward_amount, 'issued', now()
    );
    NEW.reward_status := 'issued';
    NEW.rewarded_at := now();
    RETURN NEW;
  END IF;
  IF NEW.status <> 'qualified' AND OLD.status = 'qualified' THEN
    DELETE FROM referral_rewards
    WHERE referral_id = NEW.id AND status = 'issued' AND redeemed_at IS NULL;
    NEW.reward_status := 'none';
    NEW.rewarded_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_issue_referral_reward_ledger ON referrals;
CREATE TRIGGER trg_issue_referral_reward_ledger
  AFTER UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION issue_referral_reward_ledger();