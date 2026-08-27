ALTER FUNCTION public.create_referral_code_on_signup() SET search_path = public;
ALTER FUNCTION public.ensure_referral_code(p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_referral_code() SET search_path = public;