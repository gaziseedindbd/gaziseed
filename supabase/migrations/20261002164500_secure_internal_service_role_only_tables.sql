-- Security hardening for internal/service-role-only tables.
--
-- These tables hold OTP hashes, provider responses, Messenger notification
-- queues, rate-limit state, SMS logs, and SMS settings. They are not
-- intended for direct browser/REST access.

REVOKE ALL ON TABLE
  public.india_mobile_otp_logs,
  public.india_mobile_otps,
  public.messenger_order_notifications,
  public.messenger_order_status_notifications,
  public.messenger_rate_limits,
  public.order_sms_logs,
  public.sms_settings
FROM PUBLIC, anon, authenticated;

-- Explicit deny policies document the intended boundary and remove the
-- "RLS enabled, no policy" advisor finding without granting client access.
CREATE POLICY india_mobile_otp_logs_service_role_only
  ON public.india_mobile_otp_logs
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY india_mobile_otps_service_role_only
  ON public.india_mobile_otps
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY messenger_order_notifications_service_role_only
  ON public.messenger_order_notifications
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY messenger_order_status_notifications_service_role_only
  ON public.messenger_order_status_notifications
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY messenger_rate_limits_service_role_only
  ON public.messenger_rate_limits
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY order_sms_logs_service_role_only
  ON public.order_sms_logs
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY sms_settings_service_role_only
  ON public.sms_settings
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
