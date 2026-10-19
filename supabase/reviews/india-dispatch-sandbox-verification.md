# India dispatch Sandbox verification

Review only. Production release remains BLOCKED. No production migration or deployment is authorized by this report.

## Verified on 2026-10-19

Sandbox project: `qqehtphbpypcmxliaiqd`.
Existing Vercel project Preview: https://gaziseed-jbz8r5vya-gazi-seed.vercel.app/
Sandbox API: `sandbox-admin-dispatch-preview` v2; private compatibility schema: `security_compat`.

A browser-driven INR 1 Cashfree Sandbox checkout was followed by authenticated HTTP verification (`200`, `verified: true`) and dispatch. Database readback confirmed both status aliases became `shipped`, `cashfree_dispatch_verified_at` was set, evidence was consumed, and exactly one local notification event existed. Repeating dispatch returned `409 order_not_eligible`. Attempting dispatch of the refunded fixture returned `409 refund_detected`; that fixture stayed packed. Bangladesh isolation fixture stayed packed and was not visible in the India list.

These results certify the isolated compatibility harness, not the production website integration. The positive fixture was synthetic; its local paid/completed values alone were not accepted as payment proof. The API fetched Cashfree provider order, successful payment transaction and refund information before recording evidence.

## Current repository gap

Default-branch `supabase/functions/cashfree-verify-dispatch/index.ts` was read at blob `75fddc48ffda310e14d8d69e0229f7c7f05183e6` on 2026-10-19. It reads live provider order and refund endpoints, but does not read successful payment transactions or invoke the dedicated evidence-writer path used by the Sandbox harness. It invokes the existing dispatch RPC with the existing named arguments.

Do not point the actual website at this synthetic-fixture API. Do not copy `security_compat` table names into production handlers. Do not treat the existing marker-only SQL blueprint as deployable.

## Required paired implementation

1. Adapt the independently authenticated evidence writer to the real order/intent schema. Keep credentials server-only and writer permissions limited to explicit evidence RPCs; no direct order UPDATE or evidence INSERT.
2. Verify the current provider order, exactly one matching successful payment transaction, currency and prepaid/COD-advance amount, plus refund state. Fail closed on provider errors. Invalidate existing evidence after observing a refund.
3. Preserve the existing authenticated India admin checks and named dispatch signature. Inside the protected transaction, recheck active admin, branch, locked order/intent snapshot, fresh unrevoked evidence, and one-time consumption.
4. Pair guard and RPC changes atomically. Guard timestamp-only updates, status aliases and branch mutation using actual SQL identity and transaction-bound authorization rather than mutable request JWT role settings. Preserve Bangladesh behavior and existing financial/notification triggers.
5. Exercise the real admin components and adapted API in Sandbox Preview: prepaid and COD advance, duplicate/replay, refunds, amount mismatch, stale evidence, cross-branch and inactive-admin denial, timestamp bypass, concurrent order changes, and notification once.
6. Review rollback and deployment ordering before requesting a separate Production release decision. No Production credentials belong in the Sandbox Preview.

## Boundaries

No changes to Production database, live Cashfree, Bangladesh workflow or PR #276 were made for this verification. This draft remains NOT DEPLOYABLE. The standalone Sandbox Preview is a test harness, not a replacement for the application checkout/admin UI.
