# GAZI SEED India — Shiprocket guarded rollout

## Authorized workflow
After backend payment validation, create exactly one Shiprocket order; request
serviceability and verified rates using pickup PIN, destination PIN, measured
weight, parcel dimensions, COD/prepaid mode; select cheapest eligible courier;
assign its courier_id when requesting AWB. **Never call pickup endpoint until
an authorized India admin explicitly approves a packed shipment.**

## Mandatory guards before enabling live external calls
- Store credentials only server-side. Shiprocket API access must not be callable
  directly from the browser or by unauthenticated users.
- Use authoritative India order and Cashfree API verification: prepaid must be
  fully paid; partial-COD must have Cashfree advance verified and only the
  remaining due passed to Shiprocket as COD amount. Guard refunded/failed orders.
- Product weight, package dimensions, both PIN codes, and Shiprocket pickup
  location must be configured and validated before shipment creation.
- Persist a country-scoped shipment table with unique (country_code, order_id)
  and unique Shiprocket order/shipment identifiers, request state, courier, AWB,
  COD amount and audit fields. Lock/idempotently claim work before external calls;
  reconcile ambiguous timeouts with Shiprocket rather than retrying blindly.
- Shipping courier cost is GAZI SEED's expense; customer delivery fee follows
  independently the India ₹99 under ₹500 / free from ₹500 policy once deployed.
- Never infer pickup eligibility from courier rate alone. Verify Shiprocket
  serviceability and operational pickup location, and fail closed when unknown.
- Persist pickup-approved actor/time and enforce RBAC server-side. Pickup API
  must be isolated from shipment/AWB automation. Never auto-pickup.
- Validate signed/authorized tracking callback requests according to Shiprocket
  webhook configuration; protect status transitions from replay/out-of-order.
- Keep Bangladesh orders, existing checkout/Cashfree functions, and historic
  order records unchanged.

## Test matrix before merge or Production
1. India prepaid valid/invalid/refunded; India COD advance paid/unpaid; full COD.
2. Cheapest available vs. cheaper non-COD courier; zero/unknown shipping rates.
3. Invalid destination PIN, pickup PIN, weight, dimensions, pickup location.
4. Duplicate events, concurrent invocations, Shiprocket timeouts and retries.
5. AWB assigned but pickup not approved; admin approval and audit trail.
6. Order cancellations and partial shipment failures; tracking status changes.
7. Bangladesh branch isolation and customer shipping policy consistency.

## Current implementation boundary
Only the pure rate-selection and fail-closed eligibility helpers exist.
There is **no shipment creation, AWB API call, pickup request, DB migration,
production settings change, or enabled automation** in this PR.


## Webhook and database foundation (14 October 2026)
- Draft migration: `supabase/migrations/20261014030000_india_shipping_webhook_foundation.sql`.
- Creates India-only shipment-to-order mapping and a deduplicated webhook event log.
- The trigger rejects linking non-India orders; tables have RLS enabled and no anon/authenticated access.
- Migration has NOT been applied to the database and must be checked against deployed orders schema before applying.
- Webhook receiver upload is **not complete**; do not enter a webhook URL/token or enable Shiprocket webhooks.
- Production prerequisites: authenticated POST receiver with secret header verification, event payload contract testing, event replay/out-of-order handling, and a country-scoped lookup that never changes Cashfree payment status.
- Explicit admin permission remains mandatory for any pickup API call.
- Shiprocket Domestic KYC is under review; wallet currently shown as ₹0.

## Pickup claim foundation (draft)
- `20261014031000_india_pickup_claim_guard.sql` introduces pickup state and a one-time atomic claim.
- Claim is restricted to service-role, India orders currently marked `packed`, with AWB + shipment ID and recorded admin approval.
- It returns false on repeat claims and does not initiate a pickup request.
- **Not a complete approval workflow**: a new authenticated India-admin endpoint must validate actor, record explicit approval and handle external pickup retries/reconciliation. Never allow clients to set approval columns.
- Migration is not applied and must be reviewed with Supabase security/permissions before deployment.

## Next integration increment (14 October 2026)
- `lib/shiprocket/india-client.ts`: isolated server-side authentication, PIN-to-PIN serviceability lookup, order submission and explicit courier AWB request; does **not** expose pickup booking.
- `supabase/functions/india-delivery-approval/index.ts`: validates logged-in India admin and packed India order, records first explicit approval only when shipment/AWB exists; does not book pickup.
- **Not wired to the admin interface or automatic order flow.** Do not call create-order directly until server-side Cashfree verification, shipment reservation/idempotency, address, measured packaging and partial-COD money handling are complete and tested.
- Secret values are not present in this PR; no API user login or live booking test has occurred.
- Webhooks, pickup and courier endpoints are not enabled in production.

## Duplicate-shipment reservation (draft)
- `20261014032000_india_shipping_creation_reservation.sql` enforces one reservation per India order under a row lock, and a single transition from `reserved` to `submitting`. A repeated attempt gets no reservation/claim.
- If the provider call times out after `submitting`, do **not** reset the row or retry automatically. Reconcile external order by the immutable request key and account dashboard first; mark `reconcile_required` if outcome uncertain.
- This is not authorization to book: orchestrator must perform server-side Cashfree order/amount/refund verification for prepaid and partial-COD, validate full-COD authorization and COD remainder, verify pickup and delivery PINs/weights, then reserve and claim.
- Migration is in a draft PR and not yet applied. No live Shiprocket create-order/AWB calls have been made.

## Payment, courier and booking payload foundation
- `lib/shiprocket/india-payment-policy.ts` enforces a prepaid zero-COD rule and exact Cashfree-paid partial COD remainder; unpaid full COD is intentionally blocked pending a separate authorization policy.
- `lib/shiprocket/india-booking.ts` normalizes provider serviceability quotes and constructs validated India-only payloads with exact COD due.
- These helpers are **not** an automatic shipment booking endpoint. Their gateway evidence must only be produced by server-side Cashfree verification and refund checking; never accept verification evidence from a client request.
- Existing India order rows have a freeform delivery_address without reliable structured ZIP/state/city and no verified package dimensions. Booking must fail closed until authoritative destination, pickup, package weight and line items are available.
- Live Shiprocket creation/AWB test still needs approved KYC, funded wallet, API credentials stored as server secrets, a safe disposable test order and explicit authorization. No credentials or live API bookings have been performed in this PR.

- `lib/shiprocket/india-prepare.ts` now composes payment policy, cheapest eligible courier, and validated booking payload as a pure testable function; it deliberately performs no external side effects.
- Booking endpoint and AWB persistence still require integrating the existing independent Cashfree verifier with authenticated server workflows, authoritative structured delivery address and packing measurements, secure credentials, and safe one-shot external order creation.
