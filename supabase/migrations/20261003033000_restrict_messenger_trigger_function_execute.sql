-- Restrict internal Messenger order notification trigger functions.
-- These are invoked by database triggers on public.orders and are not public RPC APIs.
REVOKE EXECUTE ON FUNCTION public.enqueue_messenger_order_confirmation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_messenger_order_status_notification() FROM PUBLIC, anon, authenticated;

-- Preserve the existing service-role capability.
GRANT EXECUTE ON FUNCTION public.enqueue_messenger_order_confirmation() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_messenger_order_status_notification() TO service_role;
