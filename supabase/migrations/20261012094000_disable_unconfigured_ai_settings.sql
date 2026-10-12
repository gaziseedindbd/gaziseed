-- Forward fix for an AI configuration that is marked enabled but has no Vault secret.
-- This changes only the feature flag; it does not read, print, or alter any secret value.
BEGIN;

UPDATE public.ai_settings
SET is_enabled = false
WHERE is_enabled IS TRUE
  AND api_key_secret_id IS NULL;

COMMIT;
