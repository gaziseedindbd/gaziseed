-- Fix: Change trigger from AFTER to BEFORE UPDATE so it can modify NEW.reward_status
-- Trigger order: calculate_referral_reward (BEFORE) fires first, then issue_referral_reward_ledger (BEFORE)
-- This is guaranteed because trigger names fire alphabetically: "calculate" < "issue"

DROP TRIGGER IF EXISTS trg_issue_referral_reward_ledger ON referrals;

CREATE TRIGGER trg_issue_referral_reward_ledger
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION issue_referral_reward_ledger();
