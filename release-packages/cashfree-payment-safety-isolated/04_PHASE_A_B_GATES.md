# Phase A → Phase B implementation gates (sandbox only)
Date: 2026-10-18. This is a progress audit, not an approval or completion certificate.

## Proven in isolated test
- Registry claim, duplicate/changed payload and four parallel claims.
- Atomic finish SQL's structural/idempotency and four-way race tests with dummy evidence; rollback/cleanup verified.
- Read-only live sandbox PAID-order lookup; PAID must not transition to session-ready.
- Typed pure decision guard and negative fixture cases; latest test-branch Preview build passed.

## Phase A still blocking
1. Verified ACTIVE session provenance: payment_session_id must come from trusted server-side Cashfree CREATE response preserved with immutable checkout/order binding. A saved string alone is not a provider attestation; GET order alone does not authenticate an arbitrary session string.
2. Provider-bound writer: current cf_stage_finish_verified_checkout can be invoked by a general service-role process with synthetic evidence and DOES NOT verify provider. Introduce a narrow trusted completion path and deny direct general-purpose invocation for production.
3. Atomic ready transition tied to an independently verified ACTIVE order with matching ID/amount/currency, unexpired order and nonambiguous attempts. Never run it on the sandbox PAID fixture.
4. Separate PAID verification/reconciliation path, not conflated with session-ready.
5. Positive ACTIVE integration, negative provider response/attempt tests, concurrency and privilege/evidence replay verification.

## Phase B begins only after Phase A tests passed
- Real provider timeout, 5xx, malformed response, lost response, delayed DB save tests and safe reconciliation; mock decision checks alone are not proof of live recovery.
- Stuck-record manual reconciliation and idempotency under retries.

## Strict protection
No changes to production Supabase ufxsthshyebahkwbmioe, production Cashfree, Bangladesh branch, PR #276. Never create a new provider order from 404 or timeout. Never mark PAID from session ready. Never ship based on frontend paid flag.
