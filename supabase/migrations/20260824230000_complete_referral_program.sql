-- Complete, safe referral program schema and business logic.
-- Referral is OFF by default. Existing orders/checkout totals are untouched.

ALTER TABLE referral_settings
  ADD COLUMN IF NOT EXISTS reward_type text DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS reward_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_reward_per_referral numeric,
  ADD COLUMN IF NOT EXISTS terms text;

UPDATE referral_settings
SET reward_value = COALESCE(reward_value, reward_amount, 0),
    reward_type = COALESCE(reward_type, 'fixed')
WHERE id = 1;

CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_unique ON referral_codes(user_id);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own referral code" ON referral_codes;
CREATE POLICY "Users can view own referral code" ON referral_codes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage referral codes" ON referral_codes;
CREATE POLICY "Admins can manage referral codes" ON referral_codes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code_id uuid REFERENCES referral_codes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','rewarded','cancelled')),
  qualifying_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  reward_amount numeric(12,2),
  reward_type text,
  reward_status text NOT NULL DEFAULT 'none',
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_referred_idx ON referrals(referred_id);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals" ON referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
DROP POLICY IF EXISTS "Users can create referral for self" ON referrals;
CREATE POLICY "Users can create referral for self" ON referrals FOR INSERT WITH CHECK (auth.uid() = referred_id AND referrer_id <> auth.uid());
DROP POLICY IF EXISTS "Admins can manage referrals" ON referrals;
CREATE POLICY "Admins can manage referrals" ON referrals FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('pending','issued','redeemed','expired','reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referral_id)
);
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own referral rewards" ON referral_rewards;
CREATE POLICY "Users can view own referral rewards" ON referral_rewards FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage referral rewards" ON referral_rewards;
CREATE POLICY "Admins can manage referral rewards" ON referral_rewards FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS referral_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES referrals(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('referral_reward','reversal')),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reversed')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_wallet_transactions_user_idx ON referral_wallet_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS referral_wallet_reward_once_idx ON referral_wallet_transactions(referral_id, type) WHERE type='referral_reward';
ALTER TABLE referral_wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own referral wallet transactions" ON referral_wallet_transactions;
CREATE POLICY "Users can view own referral wallet transactions" ON referral_wallet_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage referral wallet transactions" ON referral_wallet_transactions;
CREATE POLICY "Admins can manage referral wallet transactions" ON referral_wallet_transactions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; code_text text; attempt integer := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > 10 THEN RAISE EXCEPTION 'Failed to generate unique referral code'; END IF;
    code_text := 'SEEDBARI-';
    FOR i IN 1..6 LOOP code_text := code_text || substr(chars, floor(random() * length(chars) + 1)::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = code_text);
  END LOOP;
  RETURN code_text;
END; $$;

CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM referral_codes WHERE user_id = p_user_id) THEN
    INSERT INTO referral_codes(user_id, code) VALUES (p_user_id, generate_referral_code());
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.create_referral_code_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM ensure_referral_code(NEW.id); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_create_referral_code_on_signup ON auth.users;
CREATE TRIGGER trg_create_referral_code_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_referral_code_on_signup();
DO $$ DECLARE u record; BEGIN FOR u IN SELECT id FROM auth.users LOOP PERFORM ensure_referral_code(u.id); END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.sync_referral_reward_value()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.reward_value IS NULL THEN NEW.reward_value := COALESCE(NEW.reward_amount,0); END IF;
    IF NEW.reward_amount IS NULL THEN NEW.reward_amount := COALESCE(NEW.reward_value,0); END IF;
  ELSE
    IF NEW.reward_value IS DISTINCT FROM OLD.reward_value AND NEW.reward_amount IS NOT DISTINCT FROM OLD.reward_amount THEN
      NEW.reward_amount := NEW.reward_value;
    ELSIF NEW.reward_amount IS DISTINCT FROM OLD.reward_amount AND NEW.reward_value IS NOT DISTINCT FROM OLD.reward_value THEN
      NEW.reward_value := NEW.reward_amount;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_sync_referral_reward_value ON referral_settings;
CREATE TRIGGER trg_sync_referral_reward_value BEFORE INSERT OR UPDATE ON referral_settings FOR EACH ROW EXECUTE FUNCTION sync_referral_reward_value();

CREATE OR REPLACE FUNCTION public.qualify_referral_from_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r referrals%ROWTYPE; s referral_settings%ROWTYPE; prior_count integer; min_amount numeric; order_subtotal numeric;
BEGIN
  IF COALESCE(NEW.order_status, NEW.status) NOT IN ('delivered','completed') THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM referral_settings WHERE id = 1;
  IF s IS NULL OR s.enabled IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT * INTO r FROM referrals WHERE referred_id = NEW.user_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT count(*) INTO prior_count FROM orders o WHERE o.user_id = NEW.user_id AND o.id <> NEW.id AND COALESCE(o.order_status,o.status) IN ('delivered','completed');
  IF prior_count > 0 THEN RETURN NEW; END IF;
  min_amount := COALESCE(s.min_order_amount, 0);
  order_subtotal := COALESCE(NEW.subtotal, NEW.total_amount, NEW.final_amount, 0);
  IF order_subtotal < min_amount THEN RETURN NEW; END IF;
  UPDATE referrals SET status='qualified', qualifying_order_id=NEW.id, updated_at=now() WHERE id=r.id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_qualify_referral_from_order ON orders;
CREATE TRIGGER trg_qualify_referral_from_order AFTER INSERT OR UPDATE OF status, order_status ON orders FOR EACH ROW EXECUTE FUNCTION qualify_referral_from_order();

CREATE OR REPLACE FUNCTION public.calculate_and_issue_referral_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s referral_settings%ROWTYPE; o orders%ROWTYPE; reward numeric(12,2); rtype text;
BEGIN
  IF NEW.status <> 'qualified' OR OLD.status = 'qualified' THEN RETURN NEW; END IF;
  SELECT * INTO s FROM referral_settings WHERE id=1;
  IF s IS NULL OR s.enabled IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT * INTO o FROM orders WHERE id=NEW.qualifying_order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  rtype := COALESCE(s.reward_type,'fixed');
  IF rtype='percentage' THEN reward := COALESCE(o.subtotal,0) * COALESCE(s.reward_value,s.reward_amount,0) / 100.0; ELSE reward := COALESCE(s.reward_value,s.reward_amount,0); END IF;
  reward := GREATEST(0, round(reward,2));
  IF s.max_reward_per_referral IS NOT NULL THEN reward := LEAST(reward,s.max_reward_per_referral); END IF;
  UPDATE referrals SET reward_amount=reward, reward_type=rtype, reward_status=CASE WHEN reward>0 THEN 'issued' ELSE 'none' END, rewarded_at=CASE WHEN reward>0 THEN now() ELSE NULL END, status=CASE WHEN reward>0 THEN 'rewarded' ELSE 'qualified' END, updated_at=now() WHERE id=NEW.id;
  IF reward>0 THEN
    INSERT INTO referral_rewards(referral_id,user_id,amount,status) VALUES (NEW.id,NEW.referrer_id,reward,'issued') ON CONFLICT (referral_id) DO NOTHING;
    INSERT INTO referral_wallet_transactions(user_id,referral_id,amount,type,status,description) VALUES (NEW.referrer_id,NEW.id,reward,'referral_reward','available','Referral reward for a qualifying order') ON CONFLICT (referral_id,type) WHERE type='referral_reward' DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_calculate_and_issue_referral_reward ON referrals;
CREATE TRIGGER trg_calculate_and_issue_referral_reward AFTER UPDATE OF status ON referrals FOR EACH ROW EXECUTE FUNCTION calculate_and_issue_referral_reward();

CREATE OR REPLACE FUNCTION public.reverse_referral_reward_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t referral_wallet_transactions%ROWTYPE;
BEGIN
  IF NEW.status='cancelled' AND OLD.status IN ('qualified','rewarded') THEN
    FOR t IN SELECT * FROM referral_wallet_transactions WHERE referral_id=NEW.id AND type='referral_reward' AND status='available' LOOP
      INSERT INTO referral_wallet_transactions(user_id,referral_id,amount,type,status,description) VALUES (t.user_id,NEW.id,t.amount,'reversal','reversed','Referral reward reversed after referral cancellation');
      UPDATE referral_wallet_transactions SET status='reversed' WHERE id=t.id;
    END LOOP;
    UPDATE referral_rewards SET status='reversed', updated_at=now() WHERE referral_id=NEW.id AND status='issued';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reverse_referral_reward_on_cancel ON referrals;
CREATE TRIGGER trg_reverse_referral_reward_on_cancel AFTER UPDATE OF status ON referrals FOR EACH ROW EXECUTE FUNCTION reverse_referral_reward_on_cancel();

CREATE OR REPLACE FUNCTION public.get_referral_wallet_balance()
RETURNS numeric LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
SELECT COALESCE(SUM(CASE WHEN type='referral_reward' AND status='available' THEN amount WHEN type='reversal' THEN -amount ELSE 0 END),0)::numeric FROM referral_wallet_transactions WHERE user_id=auth.uid();
$$;
GRANT EXECUTE ON FUNCTION get_referral_wallet_balance() TO authenticated;

INSERT INTO referral_settings(id, enabled, reward_amount, min_order_amount, created_at, updated_at)
VALUES (1, false, 0, 0, now(), now()) ON CONFLICT (id) DO NOTHING;
