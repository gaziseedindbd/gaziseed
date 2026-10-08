-- Public visitors place offer orders only through the validated SECURITY DEFINER RPC.
-- Do not grant direct INSERT on orders; the RPC enforces branch, offer, stock, and price checks.
GRANT EXECUTE ON FUNCTION public.create_order(text, text, text, text, text, jsonb, text, text, text, text, text, text, text) TO anon, authenticated;
