-- Fix: Set search_path on SECURITY DEFINER functions used by the auth.users trigger.
-- The supabase_auth_admin role has search_path=auth, so when the trigger fires
-- during OAuth user creation, unqualified table references (referral_codes)
-- can't be resolved. Setting an explicit search_path on the functions fixes this.

ALTER FUNCTION public.create_referral_code_on_signup() SET search_path = public;
ALTER FUNCTION public.ensure_referral_code(p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_referral_code() SET search_path = public;
