-- AI settings branch isolation: allow one settings row per country while preserving id=1.
-- Live Messenger AI uses Vercel environment variables and does not depend on this table.

BEGIN;

UPDATE public.ai_settings
SET country_code = upper(coalesce(nullif(country_code, ''), 'BD'))
WHERE country_code IS DISTINCT FROM upper(coalesce(nullif(country_code, ''), 'BD'));

ALTER TABLE public.ai_settings
  ALTER COLUMN country_code SET DEFAULT 'BD',
  ALTER COLUMN country_code SET NOT NULL;

ALTER TABLE public.ai_settings
  DROP CONSTRAINT IF EXISTS ai_settings_pkey;

ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id, country_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_settings'::regclass
      AND conname = 'ai_settings_country_code_check'
  ) THEN
    ALTER TABLE public.ai_settings
      ADD CONSTRAINT ai_settings_country_code_check
      CHECK (country_code IN ('BD', 'IN'));
  END IF;
END
$$;

INSERT INTO public.ai_settings (
  id,
  country_code,
  is_enabled,
  provider,
  api_key,
  model,
  base_url,
  temperature,
  max_tokens,
  feature_flags
)
SELECT
  1,
  'IN',
  false,
  'openai',
  '',
  '',
  '',
  0.7,
  1000,
  '{
    "business_analysis": false,
    "sales_analysis": false,
    "inventory_assistant": false,
    "marketing_assistant": false,
    "ads_assistant": false,
    "customer_support_ai": false,
    "seed_expert": false,
    "seo_aeo_assistant": false
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ai_settings
  WHERE id = 1 AND country_code = 'IN'
);

COMMIT;
