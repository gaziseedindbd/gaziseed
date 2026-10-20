# India shipping booking foundation — 2026-10-20

PR #266 is synchronized with main 35a2c690b7d2ed227000505dbd9a2445f888b9fb. Four add/add conflicts are resolved by retaining the current main dashboard, rate page, overview API and rates API byte-for-byte. Existing mobile details, database-confirmed draft readback, payment preflight and rate diagnostics remain intact. Bangladesh, checkout, Messenger and the live Cashfree security release are preserved.

## What this increment implements

- A server-only, dependency-injected prepaid booking orchestrator: stored India admin authorization, authoritative order snapshot, Cashfree/refund verification, cheapest eligible quote, durable one-time reservation/claim, second actor/payment/quote/snapshot check, provider IDs persisted before AWB, and exact shipment/courier identity checks before AWB persistence.
- Missing/null/unknown courier rates do not become a free quote. Parcel bounds match the existing preparation API. Quotes with unknown operational pickup availability remain ineligible.
- Timeout, malformed provider response or persistence failure returns reconcile_required. No automatic external create retry; a failed attempt to mark reconciliation still leaves the durable claim blocking retry. A claim failure does not grant permission to reuse a reservation.
- Actor-bound database reserve/claim RPCs replace the actor-free versions. Reserved parcel and order financial/address/status changes are locked until the booking is resolved. The order lock serializes reservation with parcel edits.
- Pickup approval is atomic against a packed India order, records its original actor once, and pickup claims revalidate that actor's current India privileges. No provider pickup API is exposed or called.
- The redundant, undeployed india-shipping-payment-preflight prototype is removed. Use the deployed cashfree-verify-dispatch verify_only path; it is not reusable authorization to book.

## Authenticated server integration and Sandbox verification

The new india-shipping-booking Edge Function authenticates a user JWT with getUser, checks India admin scope, and derives the actor from that identity. Its preview, confirm_destination and book actions accept no client actor, payment evidence, amounts or booking snapshots. Service-only RPCs independently validate the stored active India admin.

Authoritative context joins the packed order, measured parcel, order_items, completed INR payment intent and admin-confirmed destination. Item totals, shipping and discount must reconcile to the invoice; wallet payments remain blocked pending explicit reconciliation. Destination confirmation binds city/state/PIN to the saved source address and parcel PIN. This is human-admin confirmation, not independent postal geocoding. Changes invalidate confirmation; reserved items, destination, parcel and financial data are locked.

Cashfree order, successful payment and refunds are independently read on every booking preflight. The real provider adapter checks returned order total/payment method/shipment identity after persisting external IDs and before AWB. Unknown or mismatched readback requires reconciliation. Real Shiprocket invoice and response fixtures are not yet certified.

Sandbox qqehtphbpypcmxliaiqd alone forces sandbox_simulated mode. A fixed synthetic INR1 paid Cashfree Sandbox order passed HTTP preview, booking, durable external ID/AWB readback and duplicate rejection. Result: SBX-90000005, packed order, pickup not requested. Cashfree Sandbox reads and database persistence were real; courier quote/create/AWB were simulated. This operator-authenticated test harness did not exercise an end-user JWT through the normal Edge endpoint. The temporary harness is retired after verification. Sandbox overview and preparation Edge Functions are deployed with JWT verification. A Sandbox-only admin self-read RLS policy allows an active India admin to read user_id/role/is_active/country_code for their own row; unrelated users see zero rows and authenticated role updates remain denied. This setup is not applied to Production.

Production requires BOTH INDIA_SHIPPING_BOOKING_MODE=live_prepaid and INDIA_SHIPPING_PROVIDER_CONTRACT=prepaid_v1_verified. Neither was configured and no Production function or migration was deployed. The existing Admin UI now includes a Sandbox-only destination confirmation, authoritative preflight and explicit one-attempt booking control. It is hidden for Production clients. The same Vercel project has branch-specific public Supabase configuration for this draft Preview only. Browser verification remains pending: the local browser stopped responding during provider navigation; no end-user JWT flow is claimed as passed. No real Shiprocket shipment, AWB, wallet debit, charge or pickup was created.

## COD and remaining release gates

Partial and full COD booking remain blocked at payload, transport and database reservation layers. Do not infer a collection amount from an undocumented cod_amount field or reduce the invoice value to simulate a balance. The account-specific contract for collecting only the remaining balance still needs confirmation from Shiprocket and a provider test fixture. This cannot be certified by local mocks or Cashfree tests.

Official contract reference: https://apidocs.shiprocket.in/?version=latest (Create Custom Order, Serviceability, Order Details, Assign AWB). Payloads reconcile item subtotal, shipping and discount; real provider readback must confirm the final total before AWB. Verify pickup location, provider timestamps, actual response shapes and invoice semantics against this account before setting the Production gates.

Prepaid release additionally requires completing browser verification of the normal Admin JWT/UI flow, real provider integration and crash/concurrent-request reconciliation coverage. Tracking-event projection/out-of-order processing remains a separate audited gap. Existing webhook ingestion is preserved. No automatic create retries or pickup API are exposed.

## Validation and environments

39 TypeScript tests pass: API authorization/input boundaries, project gates, Cashfree currency/amount/payment/refund validation, booking success and duplicate rejection, immutable snapshot changes, provider readback mismatch, timeout and persistence reconciliation. Generated Deno core copies are checked against the shared source. Typecheck, targeted lint and the full Next.js build pass.

41 real SQL checks pass in Sandbox with transaction fixtures rolled back. Coverage includes actor/branch permissions, authoritative context and invoice validation, stale destination, canonical request keys, reserved data immutability, duplicate claims, provider ID/AWB ordering and explicit pickup approval/replay rejection.

The draft migration chain, including 20261020074851_india_shipping_booking_guard.sql and 20261020111914_india_shipping_server_context.sql, was applied ONLY in Sandbox. A minimal RLS-protected Sandbox order_items fixture table supplies the existing Production schema contract. Production retains its earlier tables and has no new booking context/destination/claim integration. Do not bulk db push; inventory migration versions and review the explicit chain first.

PR #266 remains draft and unmerged. Main/Production, Bangladesh and PR #276 are unchanged by this work. Uncertain reserved/submitting/external_created records must be manually reconciled against their immutable provider request key; never reset a claim automatically.
