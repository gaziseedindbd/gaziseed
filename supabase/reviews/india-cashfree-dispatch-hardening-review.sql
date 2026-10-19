-- REVIEW-ONLY. DO NOT APPLY TO PRODUCTION. Must deploy atomically with verified backend caller and end-to-end QA.
-- India-only payment dispatch timestamp hardening. Bangladesh order status updates must remain unchanged.
-- The authorization marker is transaction scoped and is not granted to API roles.
BEGIN;
CREATE TABLE IF NOT EXISTS public.cashfree_dispatch_tx_authorizations (
  order_id uuid PRIMARY KEY,
  transaction_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON public.cashfree_dispatch_tx_authorizations FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.cashfree_dispatch_tx_authorizations ENABLE ROW LEVEL SECURITY;

-- Replace the existing guard in a paired deployment. The real implementation MUST:
-- (1) reject ANY alteration of cashfree_dispatch_verified_at without a marker matching
--     NEW.id and txid_current(), including timestamp-only UPDATE operations;
-- (2) permit India paid packed->shipped only with the same marker, current evidence,
--     and the existing completed-intent/amount/currency/branch checks;
-- (3) reject India paid order country_code changes without an explicit protected transition;
-- (4) preserve BD ordinary updates and all existing financial/status guards.
-- Avoid trusting current_setting('request.jwt.claim.role') or caller-supplied 'service_role'
-- as verification evidence. The marker is only internal transaction authorization:
-- it is NOT proof of payment from Cashfree.
--
-- In the existing dispatch_verified_cashfree_order(...) transaction, AFTER validating
-- order/intent identity and BEFORE updating public.orders, INSERT the marker:
--
-- INSERT INTO public.cashfree_dispatch_tx_authorizations(order_id, transaction_id)
-- VALUES(o.id,txid_current())
-- ON CONFLICT(order_id) DO UPDATE SET
-- transaction_id=excluded.transaction_id,created_at=clock_timestamp();
--
-- Immediately DELETE that marker after the protected UPDATE, within the same transaction.
-- The function must remain SECURITY DEFINER with SET search_path = '' and tightly
-- restricted EXECUTE privileges.
--
-- CRITICAL: the existing service_role-callable RPC can be invoked without an
-- authenticated Cashfree provider response. Do NOT release this marker-only design.
-- Require a server-only, dedicated writer principal or cryptographic proof bound to
-- fresh provider GET order AND GET payment responses. Check SUCCESS payment transaction,
-- provider order_id, payment_id, matching amount/currency, refunds, and replay.
-- A backend-held service_role key alone does NOT establish provider provenance.
ROLLBACK;
