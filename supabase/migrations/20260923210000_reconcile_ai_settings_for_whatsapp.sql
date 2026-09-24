/*
 * Reconcile the live AI settings schema with the WhatsApp AI agent.
 * This migration is additive: legacy columns remain untouched.
 */

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS base_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{
    "business_analysis": false,
    "sales_analysis": false,
    "inventory_assistant": false,
    "marketing_assistant": false,
    "ads_assistant": false,
    "customer_support_ai": false,
    "seed_expert": false,
    "seo_aeo_assistant": false
  }'::jsonb;

UPDATE public.ai_settings
SET model = model_name
WHERE COALESCE(model, '') = ''
  AND COALESCE(model_name, '') <> '';

INSERT INTO public.ai_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
