# Payment security audit log

New payment events are recorded from rollout onward in `payment_security_audit_log`; historical orders and payment intents are not backfilled or reconciled.

- Verified India admins create verification success/blocked records through the dispatch Edge Function. Actor IDs come from `auth.getUser`, never the request body. Audit write failure holds dispatch.
- Successful dispatch and COD due collection write their audit records in the same database transaction as the order change. Dispatch rechecks the saved order amounts, intent identity and packed status under a lock. Replay cannot produce a second dispatch/collection record.
- Intent triggers record payment completion and recovery attempts/failures. Recovery success is recorded inside atomic recovery. Retry event keys prevent duplicates for one attempt. Recovery errors outside a fixed safe list use a generic audit reason.
- Only the service role can insert. All UPDATE, DELETE and TRUNCATE operations are rejected. IDs have no cascading foreign keys, so removal of an order/user does not remove history.
- Signed-in admins can read their current branch through RLS. `get_order_payment_audit` independently checks admin and order-country access, then includes pre-order recovery history through the linked intent. It uses a 50-record timestamp/ID cursor.
- India order details include an audit panel with refresh, actor ID, India-local timestamps, amounts and earlier-record pagination. Empty state explicitly says there are no recorded events; existing orders do not acquire invented historical records.

## Validation

`npm run typecheck` and `npm run build` pass. Targeted ESLint reports no errors (the order page retains its existing image warning). All 132 Cashfree handler scenarios pass, including 15 audit scenarios. `tests/cashfree-payment-audit-db.sql` runs candidate functions against temporary copies and rolls back; it verifies recovery dedup/replay, atomic dispatch/COD rollback, immutable records, branch/customer read restrictions, browser insert denial, pre-order history and pagination.

Database migration and Edge Functions were deployed and their fetched sources matched the tested sources. Anonymous dispatch returns 401; an authorized recovery scan returns 200 with zero eligible intents. Pre-rollout intent rows remain unchanged. The authenticated SECURITY DEFINER advisor notice for the read RPC is intentional: its admin and country checks are required to join the server-only intents table. Real Cashfree sandbox payment and signed-in browser end-to-end verification remain separate validation work.
