-- AI audit issue #2: move generic AI provider keys to Supabase Vault.
-- Live Facebook Messenger provider keys remain in Vercel environment secrets.

BEGIN;

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS api_key_secret_id uuid;

UPDATE public.ai_settings
SET api_key = ''
WHERE coalesce(api_key, '') <> '';

UPDATE public.ai_settings
SET api_key = ''
WHERE api_key IS NULL;

ALTER TABLE public.ai_settings
  ALTER COLUMN api_key SET DEFAULT '',
  ALTER COLUMN api_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_settings'::regclass
      AND conname = 'ai_settings_plaintext_api_key_empty'
  ) THEN
    ALTER TABLE public.ai_settings
      ADD CONSTRAINT ai_settings_plaintext_api_key_empty
      CHECK (api_key = '');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.ai_store_api_key(
  p_country_code text,
  p_api_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v_secret_id uuid;
  v_name text;
BEGIN
  IF v_country NOT IN ('BD', 'IN') THEN
    RAISE EXCEPTION 'Invalid country code';
  END IF;

  IF p_api_key IS NULL OR length(trim(p_api_key)) < 8 THEN
    RAISE EXCEPTION 'API key is required';
  END IF;

  SELECT api_key_secret_id
  INTO v_secret_id
  FROM public.ai_settings
  WHERE id = 1 AND country_code = v_country
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI settings not found for country %', v_country;
  END IF;

  v_name := 'gazi_generic_ai_' || lower(v_country);

  IF v_secret_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM vault.secrets WHERE id = v_secret_id) THEN
    PERFORM vault.update_secret(
      v_secret_id,
      trim(p_api_key),
      v_name,
      'GAZI SEED generic AI provider key for ' || v_country,
      NULL
    );
  ELSE
    v_secret_id := vault.create_secret(
      trim(p_api_key),
      v_name,
      'GAZI SEED generic AI provider key for ' || v_country,
      NULL
    );

    UPDATE public.ai_settings
    SET api_key_secret_id = v_secret_id,
        api_key = ''
    WHERE id = 1 AND country_code = v_country;
  END IF;

  RETURN v_secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_get_api_key(
  p_country_code text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT ds.decrypted_secret
  FROM public.ai_settings s
  JOIN vault.decrypted_secrets ds
    ON ds.id = s.api_key_secret_id
  WHERE s.id = 1
    AND s.country_code = upper(trim(p_country_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.ai_store_api_key(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_get_api_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_store_api_key(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_get_api_key(text) TO service_role;

COMMIT;
