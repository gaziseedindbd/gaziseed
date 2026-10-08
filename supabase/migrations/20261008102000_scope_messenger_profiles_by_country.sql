-- AI audit issue #3: isolate Messenger customer profiles by admin branch.
-- Messenger webhook/runtime uses service_role and is not restricted by these authenticated-admin RLS policies.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.messenger_customer_profiles'::regclass
      AND conname = 'messenger_customer_profiles_country_code_check'
  ) THEN
    ALTER TABLE public.messenger_customer_profiles
      ADD CONSTRAINT messenger_customer_profiles_country_code_check
      CHECK (country_code IN ('BD', 'IN'));
  END IF;
END
$$;

DROP POLICY IF EXISTS "admins_write_messenger_customer_profiles"
  ON public.messenger_customer_profiles;

DROP POLICY IF EXISTS "messenger_customer_profiles_admin_country_all"
  ON public.messenger_customer_profiles;

CREATE POLICY "messenger_customer_profiles_admin_country_all"
ON public.messenger_customer_profiles
FOR ALL
TO authenticated
USING (public.can_access_country(country_code))
WITH CHECK (public.can_access_country(country_code));

COMMIT;
