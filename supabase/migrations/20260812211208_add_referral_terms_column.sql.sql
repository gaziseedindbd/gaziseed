ALTER TABLE referral_settings
  ADD COLUMN IF NOT EXISTS terms text;
