-- Durable Messenger order-tracking verification lockout.
-- This migration belongs to the feature branch and must be reviewed before deployment.

CREATE TABLE IF NOT EXISTS public.messenger_tracking_verification_limits (
  page_id text NOT NULL,
  external_user_id text NOT NULL,
  country_code text NOT NULL CHECK (country_code IN ('IN', 'BD')),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 3),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, external_user_id, country_code)
);

ALTER TABLE public.messenger_tracking_verification_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY messenger_tracking_verification_service_role_all
  ON public.messenger_tracking_verification_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE public.messenger_tracking_verification_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messenger_tracking_verification_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_messenger_tracking_verification(
  p_page_id text,
  p_external_user_id text,
  p_country_code text,
  p_action text
)
RETURNS TABLE(allowed boolean, failed_attempts integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_now timestamptz := now();
  v_row public.messenger_tracking_verification_limits%ROWTYPE;
BEGIN
  IF p_page_id IS NULL OR btrim(p_page_id) = '' THEN
    RAISE EXCEPTION 'Messenger page id is required';
  END IF;
  IF p_external_user_id IS NULL OR btrim(p_external_user_id) = '' THEN
    RAISE EXCEPTION 'Messenger external user id is required';
  END IF;
  IF p_country_code NOT IN ('IN', 'BD') THEN
    RAISE EXCEPTION 'Unsupported country code';
  END IF;
  IF p_action NOT IN ('check', 'fail', 'success') THEN
    RAISE EXCEPTION 'Unsupported verification action';
  END IF;

  INSERT INTO public.messenger_tracking_verification_limits(page_id, external_user_id, country_code)
  VALUES (p_page_id, p_external_user_id, p_country_code)
  ON CONFLICT (page_id, external_user_id, country_code) DO NOTHING;

  SELECT *
    INTO v_row
    FROM public.messenger_tracking_verification_limits
   WHERE page_id = p_page_id
     AND external_user_id = p_external_user_id
     AND country_code = p_country_code
   FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN QUERY SELECT false, v_row.failed_attempts,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - v_now)))::integer);
    RETURN;
  END IF;

  -- Expired cooldowns are reset at the beginning of the next attempt.
  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until <= v_now THEN
    v_row.failed_attempts := 0;
    v_row.blocked_until := NULL;
  END IF;

  IF p_action = 'fail' THEN
    v_row.failed_attempts := LEAST(3, v_row.failed_attempts + 1);
    IF v_row.failed_attempts >= 3 THEN
      v_row.blocked_until := v_now + interval '15 minutes';
    END IF;
  ELSIF p_action = 'success' THEN
    v_row.failed_attempts := 0;
    v_row.blocked_until := NULL;
  END IF;

  v_row.country_code := p_country_code;
  v_row.updated_at := v_now;

  UPDATE public.messenger_tracking_verification_limits
     SET country_code = v_row.country_code,
         failed_attempts = v_row.failed_attempts,
         blocked_until = v_row.blocked_until,
         updated_at = v_row.updated_at
   WHERE page_id = p_page_id
     AND external_user_id = p_external_user_id
     AND country_code = p_country_code;

  RETURN QUERY SELECT
    (v_row.blocked_until IS NULL OR v_row.blocked_until <= v_now),
    v_row.failed_attempts,
    CASE
      WHEN v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now
        THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - v_now)))::integer)
      ELSE 0
    END;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_messenger_tracking_verification(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_messenger_tracking_verification(text, text, text, text)
  TO service_role;
