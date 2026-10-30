-- Allow only the trusted Edge Function role to read the order snapshot it
-- validates before attempting a Delhivery manifest request.
GRANT EXECUTE ON FUNCTION public.india_delhivery_booking_snapshot(uuid) TO service_role;
