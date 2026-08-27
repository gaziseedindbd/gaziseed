/*
# AI Provider Settings Foundation

1. New Tables
- `ai_settings` (single row, id=1) — stores AI provider configuration
  - `is_enabled` (boolean, default false) — master AI on/off switch
  - `provider` (text) — 'openai' | 'gemini' | 'claude' | 'custom'
  - `api_key` (text) — encrypted server-side, never exposed to frontend
  - `model` (text) — provider-specific model name
  - `base_url` (text) — optional, for compatible/custom providers
  - `temperature` (numeric) — optional, 0-2
  - `max_tokens` (integer) — optional
  - `feature_flags` (jsonb) — future AI module toggles, all default false
  - `created_at`, `updated_at` (timestamps)

2. Security
- RLS enabled on `ai_settings`.
- Only MASTER_ADMIN role can SELECT, INSERT, UPDATE.
- Anon and regular authenticated users get NO access.
- API keys are stored server-side only; frontend receives masked values only.

3. Notes
- This migration creates the foundation ONLY. No AI features are implemented.
- The `feature_flags` jsonb stores toggles for: business_analysis, sales_analysis,
  inventory_assistant, marketing_assistant, ads_assistant, customer_support_ai,
  seed_expert, seo_aeo_assistant — all default false.
- A trigger ensures only one row (id=1) ever exists.
*/

CREATE TABLE IF NOT EXISTS ai_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'openai',
  api_key text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  base_url text NOT NULL DEFAULT '',
  temperature numeric DEFAULT 0.7,
  max_tokens integer DEFAULT NULL,
  feature_flags jsonb NOT NULL DEFAULT '{
    "business_analysis": false,
    "sales_analysis": false,
    "inventory_assistant": false,
    "marketing_assistant": false,
    "ads_assistant": false,
    "customer_support_ai": false,
    "seed_expert": false,
    "seo_aeo_assistant": false
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Only master_admin can read AI settings (contains API keys)
DROP POLICY IF EXISTS "master_admin_read_ai_settings" ON ai_settings;
CREATE POLICY "master_admin_read_ai_settings"
ON ai_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = 'master_admin'
    AND admin_users.is_active = true
  )
);

-- Only master_admin can insert AI settings
DROP POLICY IF EXISTS "master_admin_insert_ai_settings" ON ai_settings;
CREATE POLICY "master_admin_insert_ai_settings"
ON ai_settings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = 'master_admin'
    AND admin_users.is_active = true
  )
);

-- Only master_admin can update AI settings
DROP POLICY IF EXISTS "master_admin_update_ai_settings" ON ai_settings;
CREATE POLICY "master_admin_update_ai_settings"
ON ai_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = 'master_admin'
    AND admin_users.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = 'master_admin'
    AND admin_users.is_active = true
  )
);

-- Ensure the single row exists
INSERT INTO ai_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_settings_updated_at ON ai_settings;
CREATE TRIGGER ai_settings_updated_at
BEFORE UPDATE ON ai_settings
FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();
