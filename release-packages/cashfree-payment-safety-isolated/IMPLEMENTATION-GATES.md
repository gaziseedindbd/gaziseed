# India Cashfree payment safety — isolated implementation gate

Branch: `test/cashfree-payment-safety-isolated-20261018`
Starting point: PR #276 head `01b0fec26932bb28a3a34a39539f235b71273937`.
This branch is **not** a production-ready change; no payment runtime logic is modified by this document.

## Critical findings
- The PR's India Cashfree session handler issues a fresh payment intent ID, provider order ID and idempotency key on each request.
- On provider timeout it marks the intent failed, even though the provider might have created the order.
- Address/PIN-first UX and Bangladesh behavior must remain unchanged.

## Implementation requirements (not yet implemented)
1. Persistent, unique checkout key, tied to authenticated user/session and server-validated quote fingerprint (India only); validate reuse and mismatched payload.
2. Atomic idempotency claim in India database before external API call; avoid races from duplicate and concurrent requests. Use deterministic provider order ID/idempotency key per checkout.
3. Store pending/uncertain state on ambiguous provider outcome. Never automatically mark failed or create a second provider order when status is uncertain.
4. Lookup the original provider order and payment attempts server-side. Verify ID, amount, currency, expiry and pending/success attempts. Only then decide whether to reuse a session or stop for reconciliation.
5. Explicit expiration/requote and user action for creating a genuinely new checkout, with coupon/wallet locks and safe refunds/reversals where applicable.
6. Confirm dispatch/payment settlement separately through Cashfree server-side verification.
7. Keep India and Bangladesh branches and endpoints isolated; reject production credentials/endpoints in sandbox tests.

## Mandatory gates before changing production
- Database RLS/permissions review, atomic transaction and uniqueness tests.
- Provider API timeout, 5xx, malformed response and delayed-save fault tests, using isolated sandbox.
- 4+ request real concurrency test; exactly one provider order.
- Paid, active, pending, failed, expired and ambiguous payment attempt tests.
- Saved address/PIN-first checkout regression; normal checkout, ads, animated, combo, and COD advance.
- Build/typecheck, preview QA, webhook/coupon/wallet checks, code review and explicit merge authorization.

## Current scope
Sandbox experiment lives in Supabase **gaziseed-test** only. Sandbox simulations are not proof of real network timeout recovery. Two historical ₹120 creating simulation rows remain unresolved and must not be changed automatically. PR #276 remains Draft and unmerged.
