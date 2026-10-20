# Real Admin Order component Sandbox acceptance — 2026-10-20

Production release remains BLOCKED. Preview: https://gaziseed-6zjcqdqmw-gazi-seed.vercel.app/

The user signed in with the existing confirmed Sandbox Auth account. The rendered original `app/admin/orders/page.tsx` showed only synthetic India test orders. It used its original Verify Cashfree Payment button, status dropdown, note input, Update button, PaymentAuditPanel and reload behavior, with the build-time Sandbox data adapter described in sandbox/admin-orders/README.md.

## Observed browser and database results

- Opened refunded fixture SBX-00000001 and attempted Verify Cashfree Payment and shipped Update. The modal remained open; DB readback confirmed packed, without dispatch. The prior main-API HTTP refund test established the specific refund_detected error.
- Created/opened INR1 provider Sandbox checkout for fixture `40000000-0000-4000-8000-000000000004` / provider `gazi_dispatch_40000000000040008000000000000004`. Used a provider-displayed test card and simulator SUCCESS; no actual debit occurred and the card was not saved.
- Opened SBX-00000004 in the original order modal. Verify Cashfree Payment displayed `VERIFIED PAID — ₹1 (Fully Paid)` and a successful verification entry in the original audit component.
- Selected shipped, entered `Real Admin UI Sandbox dispatch verified`, and used the original Update button. The modal closed and the refreshed order row showed shipped.
- DB readback confirmed status=shipped and order_status=shipped, verification timestamp set, expected note preserved, evidence consumed=true/revoked=false, history_count=1, local notification_count=1 and transaction markers=0.
- Reopened the order. The note persisted, shipped remained selected, and the original Payment Audit Log displayed verification and dispatch success rows. Repeating the current-status Update did not create a second dispatch/history/notification; this uses the adapter's direct-write rejection. The prior main-API replay test separately returned 409 order_not_eligible.
- Refunded India fixture and Bangladesh isolation fixture both remained packed.

## Checks already passed

Original-component static build and source/input-manifest isolation check; TypeScript typecheck; Sandbox client whitelist/session/error/history tests; 32 mocked main-API adapter tests. Earlier 25 prior-handler regressions also passed. Browser evidence above is prepaid only, not a COD advance provider E2E certification.

## Scope limit

This certifies component-level integration using the original Order UI and compatibility schema. It does not certify the full Next.js Admin layout/auth/RLS/real-table stack. Item list is intentionally empty and customer/address display values are labelled synthetic. Audit rows are derived from actual Sandbox evidence and history writes go to the private test table. No production database, live Cashfree, Bangladesh workflow, PR #276, billing, or project environment configuration was changed. Before production release, port the paired real-table evidence/permissions/guard/audit design, verify full-app compatibility, and review deployment and rollback ordering.
