DROP TRIGGER IF EXISTS trg_issue_referral_reward_ledger ON referrals;
CREATE TRIGGER trg_issue_referral_reward_ledger
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION issue_referral_reward_ledger();