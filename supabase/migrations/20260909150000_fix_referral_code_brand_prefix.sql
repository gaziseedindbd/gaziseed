-- Fix referral code branding: GAZISEED instead of SEEDBARI

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code_text text;
  attempt integer := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > 10 THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after 10 attempts';
    END IF;

    code_text := 'GAZISEED-';
    FOR i IN 1..6 LOOP
      code_text := code_text || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = code_text);
  END LOOP;

  RETURN code_text;
END;
$$;

-- Rename existing customer codes to the new brand prefix while preserving their unique suffix.
UPDATE referral_codes
SET code = regexp_replace(code, '^SEEDBARI-', 'GAZISEED-')
WHERE code LIKE 'SEEDBARI-%';
