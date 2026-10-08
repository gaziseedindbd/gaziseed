-- AI audit issue #5: Generic Admin AI must not report enabled without a Vault key.
-- This affects only branch-specific Generic AI modules, never the live Messenger runtime.

BEGIN;

UPDATE public.ai_settings
SET is_enabled = false
WHERE api_key_secret_id IS NULL
  AND is_enabled = true;

COMMIT;
