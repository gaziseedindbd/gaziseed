# Verified Completion Security Design — GAZI SEED India (Sandbox-only design)
Status: **DESIGN APPROVED FOR ISOLATED TEST IMPLEMENTATION; NOT PRODUCTION APPROVED**
Date: 2026-10-18
Scope: GitHub test branch `test/cashfree-payment-safety-isolated-20261018`, Supabase test project `qqehtphbpypcmxliaiqd`.
Never modify live Cashfree, production Supabase `ufxsthshyebahkwbmioe`, Bangladesh branch, or PR #276 without a separate explicit release review.

## Fundamental invariant
A client, checkout form, webhook body, database row, or previously saved payment session must **not** be authoritative evidence of provider payment status. Cashfree sandbox is queried by a trusted server with sandbox-only secrets. `ready` denotes a verified reusable **payment session**, never a paid transaction; `PAID` is a distinct order/payment-verification result, and dispatch authorization is a further, separate check.

## Trusted verification gate before a completion write
1. Verify runtime is exactly the allowlisted test project, HTTPS endpoint is Cashfree **sandbox** only, test authentication/JWT and request method. Do not log tokens, payment session identifiers, provider credentials or personal data.
2. Load the claimed checkout row server-side: country `IN`, currency `INR`, immutable checkout key, quote fingerprint, payment intent, expected deterministic provider order ID and server-authoritative amount. Require one row, valid state and no duplicate provider order mapping.
3. Fetch Cashfree **GET order** by the *recorded* provider order ID, then **GET order payments** with bounded timeouts; validate both responses' shapes, identities, correct order ID, exact ₹ amount/currency, status, and consistency of every payment attempt. Missing, malformed, 404, 429, 5xx, timeout or conflicting responses are **uncertain**, never proof the order is absent. No automatic second CREATE.
4. **Session ready gate**: Only complete `creating → ready` when the provider confirms the *same existing* order is ACTIVE with a still-valid expiry, the saved or confirmed `payment_session_id` genuinely belongs to that order, and payment attempts show no SUCCESS/PENDING/unknown ambiguity. Never infer a session ID from the caller. If a payment is already confirmed PAID, do **not** classify it as `ready` or create a new session: hand off to paid-order reconciliation.
5. **Paid gate**: Only record a paid fact separately when Cashfree order is PAID, transaction/order/amount/currency match, and payment attempts contain a verified SUCCESS with consistent identifiers and amounts. Unresolved pending/unknown/conflicting attempts block automatic finalization. Dispatch requires a fresh trusted server-side paid verification, not `ready`.
6. For successful session completion use an atomic, idempotent, row-locked compare-and-transition (same checkout/intent/order/fingerprint/quote amount); repeated equal evidence returns `already_ready`, conflicting evidence returns `conflict`; unexpected states fail closed.
7. Bind proof to the specific database checkout and provider order. Ensure `service_role` alone is **not** considered proof: a generic service-role RPC callable from unrelated server code is insufficient. Final implementation needs a narrow trusted verification writer, tightly scoped privileges, immutable evidence/proof handling, and audit trail. Caller-provided `verified:true`, `PAID`, raw session JSON, or an unrestricted service-role invocation must never unlock transition.

## State decision table
| Local | Provider / evidence | Outcome |
|---|---|---|
| creating | ACTIVE, matching live session, unexpired, attempts safe | Verified session → atomic ready |
| creating | PAID and verified SUCCESS | Paid-order reconciliation only, **not** session-ready |
| creating | 404, timeout, malformed, 5xx, unknown or mismatched attempts | Reconcile/manual hold; no retry CREATE and no ready |
| ready | identical independently verified session | Idempotent already_ready |
| ready | conflicting session/order/quote | conflict/manual reconciliation |
| any | FAILED/EXPIRED without decisive no-order proof | Reconcile, no speculative provider CREATE |

## Known stage gaps (must NOT be treated as solved)
- `cf_stage_finish_verified_checkout` currently verifies structural fields and atomically updates but **does not verify Cashfree**. Despite service-role-only permissions, another trusted server with service role can still call it with fabricated session data. Guardrail design requires replacing its use with a provider-bound restricted writer before any actual recovery rollout.
- Existing read-only stage recovery verifies provider order/payments but never writes; existing sandbox recovery uses `gzt_` order ID, stage claim uses `gzt-stage-`. A carefully isolated pre-existing ₹1 paid fixture exists; never mutate an actual customer order.
- A sandbox PAID fixture is **not** evidence that an ACTIVE session may be marked ready. Separate paid vs active tests.
- Earlier automatic timeout/failed-save tests were simulations, not demonstrated end-to-end network failure recovery.
- Existing generic `ready` transition can accept synthetic session data in the test database. Do not connect it to production checkout.

## Required release gates
- Positive ACTIVE unexpired verified-session test; PAID separate paid-state test.
- Negative 404/timeout/5xx, mismatched ID/amount/currency, missing session, altered quote/intent, SUCCESS/PENDING/unknown attempt mix, expired order and malformed provider response.
- 4+ concurrent *provider-verified* completions yield one allowed state change; no duplicate order.
- Evidence freshness/replay tests; privilege tests for anon/authenticated and unrelated server contexts; cross-branch isolation; webhook reconciliation and idempotency; coupon/wallet consistency; saved-address/PIN-first and all India checkout variants; dispatch paid-verification.
- Independent security/code review, successful test-branch build, explicit approval before any live PR/Production change.

**Design-only artifact. No new payment requests, database changes or production deployment are authorized by this file.**
