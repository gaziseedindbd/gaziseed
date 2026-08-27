-- Step 8: Referral Reward Calculation
ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS reward_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS reward_type text,
  ADD COLUMN IF NOT EXISTS reward_status text DEFAULT 'none';

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
  IF NEW.status = 'qualified' AND (OLD.status IS NULL OR OLD.status <> 'qualified') THEN
    SELECT * INTO v_settings FROM referral_settings WHERE id = 1;
    IF v_settings IS NULL OR v_settings.enabled = false THEN
      RETURN NEW;
    END IF;
    SELECT * INTO v_order FROM orders WHERE id = NEW.qualifying_order_id;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
    v_reward_type := v_settings.reward_type;
    IF v_settings.reward_type = 'fixed' THEN
      v_reward := COALESCE(v_settings.reward_value, 0);
    ELSIF v_settings.reward_type = 'percentage' THEN
      v_reward := v_order.subtotal * COALESCE(v_settings.reward_value, 0) / 100.0;
    ELSE
      v_reward := 0;
    END IF;
    IF v_reward < 0 THEN
      v_reward := 0;
    END IF;
    IF v_settings.max_reward_per_referral IS NOT NULL THEN
      v_reward := LEAST(v_reward, v_settings.max_reward_per_referral);
    END IF;
    v_reward := ROUND(v_reward, 2);
    NEW.reward_amount := v_reward;
    NEW.reward_type := v_reward_type;
    NEW.reward_status := 'calculated';
    RETURN NEW;
  END IF;
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

DROP TRIGGER IF EXISTS trg_calculate_referral_reward ON referrals;
CREATE TRIGGER trg_calculate_referral_reward
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_referral_reward();