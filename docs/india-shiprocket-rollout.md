# India shipping booking foundation — 2026-10-20

PR #266 is synchronized with main 35a2c690b7d2ed227000505dbd9a2445f888b9fb. Four add/add conflicts are resolved by retaining the current main dashboard, rate page, overview API and rates API byte-for-byte. Existing mobile details, database-confirmed draft readback, payment preflight and rate diagnostics remain intact. Bangladesh, checkout, Messenger and the live Cashfree security release are preserved.

## What this increment implements

- A server-only, dependency-injected prepaid booking orchestrator: stored India admin authorization, authoritative order snapshot, Cashfree/refund verification, cheapest eligible quote, durable one-time reservation/claim, second actor/payment/quote/snapshot check, provider IDs persisted before AWB, and exact shipment/courier identity checks before AWB persistence.
- Missing/null/unknown courier rates do not become a free quote. Parcel bounds match the existing preparation API. Quotes with unknown operational pickup availability remain ineligible.
- Timeout, malformed provider response or persistence failure returns reconcile_required. No automatic external create retry; a failed attempt to mark reconciliation still leaves the durable claim blocking retry. A claim failure does not grant permission to reuse a reservation.
- Actor-bound database reserve/claim RPCs replace the actor-free versions. Reserved parcel and order financial/address/status changes are locked until the booking is resolved. The order lock serializes reservation with parcel edits.
- Pickup approval is atomic against a packed India order, records its original actor once, and pickup claims revalidate that actor's current India privileges. No provider pickup API is exposed or called.
- The redundant, undeployed india-shipping-payment-preflight prototype is removed. Use the deployed cashfree-verify-dispatch verify_only path; it is not reusable authorization to book.

## Deliberate boundary

There is no authenticated booking HTTP endpoint or production adapter wiring in this change. The orchestrator requires explicitly supplied trusted server adapters and enabled=true; nothing calls it from the website. No Production migration/function deployment, shipment, AWB, wallet debit or pickup is authorized by pushing this branch.

Partial COD money remains modeled and quotes still work, but external COD booking is blocked at payload, transport and database reservation layers. The former cod_amount assumption is removed: until the account/provider contract is verified, it must not be assumed that an extra field changes the amount Shiprocket collects. Full COD also remains blocked. Never reduce the declared invoice/order value to fake a partial balance.

Source contract reference: https://apidocs.shiprocket.in/?version=latest (Create Custom Order and Assign AWB). The documented custom-order subtotal is caller-calculated, not automatically reconciled from items. The partial-COD contract has not been verified for this account; do not unlock it from secondary-source examples.

The build payload is a prepaid foundation, not a certified invoice integration: final authoritative structured address/PIN validation, item/shipping/discount reconciliation, timestamp format, pickup-location verification and account-specific provider fixtures must be reviewed when implementing production adapters. Never construct booking snapshots or gateway evidence from client JSON.

Tracking-event projection/out-of-order processing remains a separate audited gap. This increment does not claim it is fixed. Existing webhook event ingestion is preserved.

## Validation and environments

24 TypeScript helper/orchestrator tests cover success, disabled/unauthorized/BD/COD paths, snapshot/refund/price changes, duplicate calls, timeouts, malformed responses, provider identity mismatch, persistence failures and unavailable reconciliation storage. These use mocked provider/database adapters; they are not live Shiprocket E2E tests.

30 real SQL checks pass in Sandbox qqehtphbpypcmxliaiqd, with all synthetic fixtures rolled back. They cover service/actor/branch permissions, parcel/money guards, duplicate reservations/claims, immutable reserved data, provider ID/AWB ordering, explicit pickup approval and replay rejection. Sequential one-shot claims are tested; concurrent external/provider crash behavior still needs integration coverage with the real adapters.

The draft shipping migration chain was applied ONLY in Sandbox, including 20261020074851_india_shipping_booking_guard.sql. Production still has only the earlier shipment/preparation/event tables and no new booking claims. Do not bulk db push: inventory applied migration versions and explicitly review this chain first. The old actor-free reserve/claim RPCs are revoked by the new guard migration.

## Next production integration gate

Implement reviewed server adapters behind a disabled feature gate, with auth-derived actor identity, authoritative versioned address/items/parcel/payment data and real Cashfree checks. Exercise duplicate concurrency and timeout reconciliation in Sandbox before enabling any live provider call. Reconcile reserved/submitting/external_created records manually against the immutable request key and provider dashboard when uncertain; do not clear locks or reset state automatically. No financial or destination changes are allowed while booking is unresolved. Pickup remains a separate explicit admin action after AWB readiness.
