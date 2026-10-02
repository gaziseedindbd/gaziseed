-- Pin the trigger function search_path to trusted schemas.
-- This removes mutable search_path resolution without changing function behavior.
ALTER FUNCTION public.update_messenger_customer_profiles_updated_at()
  SET search_path = public, pg_temp;
