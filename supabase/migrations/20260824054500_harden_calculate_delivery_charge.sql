-- Harden delivery charge calculation function search_path only.
-- Preserve public client execution and existing calculation behavior.

ALTER FUNCTION public.calculate_delivery_charge(numeric, boolean)
  SET search_path = public;
