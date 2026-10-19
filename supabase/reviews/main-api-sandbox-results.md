# Main API Sandbox integration — 2026-10-19

Production release: BLOCKED. Draft PR only. Do not merge or deploy to Production.

## Implementation

The existing `cashfree-verify-dispatch` entrypoint routes the exact Sandbox project URL to `_shared/sandbox-dispatch.ts`. Other projects retain the prior handler; Production hardening is not implemented by this Sandbox routing patch. The adapter independently rejects non-Sandbox project URLs, uses only Sandbox Cashfree credentials/host, and uses existing private `security_compat` guards. It accepts the actual application request contract `{orderId,status,note}` and returns `ok`, `verified`, and dispatch `status`. Browser-supplied payment evidence is rejected.

Authentication checks the user with Supabase Auth, then checks active stored admin membership and India branch. The writer URL and actual writer SQL role are checked. Provider GET order, GET payments and GET refunds are checked before evidence creation. Exactly one SUCCESS payment must match identity/amount/currency. Refund observation revokes evidence. The named-argument-compatible dispatch RPC locks and rechecks the order, checks active India admin and fresh unconsumed evidence, and uses a transaction-bound guard before changing status. Existing private DB functions remain in place; no production schema was modified.

Sandbox deployments:
- `cashfree-verify-dispatch` v1, platform JWT check enabled plus handler user verification.
- `sandbox-admin-dispatch-preview` v3 forwards verification/dispatch using the user JWT to the above API; checkout/list remain isolated test utilities. Handler authentication remains enabled.
- Existing Preview: https://gaziseed-jbz8r5vya-gazi-seed.vercel.app/

## Actual deployed HTTP/browser checks

| Scenario | Result |
| --- | --- |
| Synthetic local paid order, provider still ACTIVE | 409 `provider_order_mismatch`; no dispatch |
| Previously refunded provider payment | 409 `refund_detected`; remains packed |
| INR 1 Sandbox payment completed through provider checkout, verify_only | 200 `ok:true`, `verified:true`, INR1 prepaid, due0 |
| Dispatch after verification through main API | status and order_status both shipped |
| Replay of shipped order | 409 `order_not_eligible` |

Positive fixture: `40000000-0000-4000-8000-000000000003`.
Provider order: `gazi_dispatch_40000000000040008000000000000003`.
Database readback: verification timestamp set; evidence consumed=true/revoked=false; local notification count=1; leftover transaction authorization markers=0.
No real debit, external customer notification, live Cashfree change or production data change was performed. Bangladesh test fixture was not dispatched.

## Automated verification

`node tests/sandbox-dispatch.test.cjs`: 32 mocked adapter scenarios passed (prepaid/COD advance, auth/branch/writer scope, forged inputs, provider mismatch, duplicate payment/intent, refund/error, evidence denial and concurrent order change).
Existing `tests/cashfree-dispatch.test.cjs`: 25 prior-handler regression scenarios passed locally against the modified entrypoint. These are mocks, not a COD provider/browser E2E certification.

## Remaining release work

This completes main-API Sandbox compatibility wiring, not the production port. The real application admin components/public schema have not been switched to the compatibility harness. Before any production release, port and review the evidence schema/permissions/guards atomically for real tables, preserve real audit and notification behavior, exercise actual admin components in an isolated full-application Preview, and prepare rollback/deployment ordering. PR #276, Production, live Cashfree and Bangladesh workflow remain untouched.
