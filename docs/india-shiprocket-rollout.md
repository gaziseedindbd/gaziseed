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

Sandbox qqehtphbpypcmxliaiqd alone forces sandbox_simulated mode. A fixed synthetic INR1 paid Cashfree Sandbox order passed HTTP preview, booking, durable external ID/AWB readback and duplicate rejection. Result: SBX-90000005, packed order, pickup not requested. Cashfree Sandbox reads and database persistence were real; courier quote/create/AWB were simulated. A later normal Admin browser test also passed through the JWT-protected endpoint: login, destination confirmation, prepaid preflight, explicit one-attempt booking, durable AWB readback and disabled duplicate controls. The paid fixture passed Cashfree verify-only, while the refunded fixture was blocked. The earlier complete simulated booking was checkpointed and recycled only for this isolated synthetic UI test; no uncertain/live claim was reset. The temporary harness is retired after verification. Sandbox overview and preparation Edge Functions are deployed with JWT verification. A Sandbox-only admin self-read RLS policy allows an active India admin to read user_id/role/is_active/country_code for their own row; unrelated users see zero rows and authenticated role updates remain denied. This setup is not applied to Production.

Production requires BOTH INDIA_SHIPPING_BOOKING_MODE=live_prepaid and INDIA_SHIPPING_PROVIDER_CONTRACT=prepaid_v1_verified. Neither was configured and no Production function or migration was deployed. The existing Admin UI now includes a Sandbox-only destination confirmation, authoritative preflight and explicit one-attempt booking control. It is hidden for Production clients. The same Vercel project has branch-specific public Supabase configuration for this draft Preview only. Normal Admin browser verification subsequently passed on Preview gaziseed-kffrmk255-gazi-seed.vercel.app. Branch-specific empty overrides prevent inheriting the shared privileged server credential and Meta CAPI token; AI messaging is disabled on this branch. No real Shiprocket shipment, AWB, wallet debit, charge or pickup was created.

## COD and remaining release gates

Partial and full COD booking remain blocked at payload, transport and database reservation layers. Do not infer a collection amount from an undocumented cod_amount field or reduce the invoice value to simulate a balance. The account-specific contract for collecting only the remaining balance still needs confirmation from Shiprocket and a provider test fixture. This cannot be certified by local mocks or Cashfree tests.

Official contract reference: https://apidocs.shiprocket.in/?version=latest (Create Custom Order, Serviceability, Order Details, Assign AWB). Payloads reconcile item subtotal, shipping and discount; real provider readback must confirm the final total before AWB. Verify pickup location, provider timestamps, actual response shapes and invoice semantics against this account before setting the Production gates.

Normal Admin JWT/UI booking verification is complete for the simulated Sandbox courier. Prepaid live release still requires real provider integration and real-provider crash reconciliation coverage. Database concurrency is verified: two simultaneous reservations yield one ID; two simultaneous claims yield one success; reconciliation blocks reclaim and late external-ID recording. Synthetic race fixtures were removed after verification. Tracking projection now uses timezone-qualified event timestamps and atomic latest-event updates. Older, equal-time, future and unqualified events cannot overwrite the projection; terminal delivery cannot regress. Order, payment and pickup state remain unchanged. Unqualified provider timestamp formats stay in history until account-specific formats are verified. The webhook source is updated in the draft; provider webhook configuration/deployment is not enabled in Production. No automatic create retries or pickup API are exposed.

## Validation and environments

45 TypeScript tests pass: API authorization/input boundaries, project gates, Cashfree currency/amount/payment/refund validation, booking success and duplicate rejection, immutable snapshot changes, provider readback mismatch, timeout and persistence reconciliation. Generated Deno core copies are checked against the shared source. Typecheck, targeted lint and the full Next.js build pass.

50 real SQL checks pass in Sandbox with transaction fixtures rolled back. Coverage includes actor/branch permissions, authoritative context and invoice validation, stale destination, canonical request keys, reserved data immutability, duplicate claims, provider ID/AWB ordering and explicit pickup approval/replay rejection.

The draft migration chain, including 20261020074851_india_shipping_booking_guard.sql and 20261020111914_india_shipping_server_context.sql and 20261020134257_india_shipping_tracking_projection.sql, was applied ONLY in Sandbox. A minimal RLS-protected Sandbox order_items fixture table supplies the existing Production schema contract. Production retains its earlier tables and has no new booking context/destination/claim integration. Do not bulk db push; inventory migration versions and review the explicit chain first.

PR #266 remains draft and unmerged. Main/Production, Bangladesh and PR #276 are unchanged by this work. Uncertain reserved/submitting/external_created records must be manually reconciled against their immutable provider request key; never reset a claim automatically.

The remaining provider gate is concrete: Shiprocket redirected to /newlogin and no signed-in provider session was available. No provider write request was made. Official usage guidance warns that valid API requests affect real account data: https://apidocs-test.shiprocket.in/guides/usage-guidelines/. Obtain account-specific COD collection semantics and a provider-approved test procedure before enabling live creation/AWB. A documentation hostname containing test is not proof of a transactional Sandbox.

## Actual Shiprocket Sandbox contract run

The account now has enabled Sandbox access at sandbox.shiprocket.in, using api-sandbox.shiprocket.in. Live credentials were not reused. A synthetic pickup GAZI-SBX-ONLY / 110001 was created only there. Provider validation rejected an address without house/road information and a repeated-digit dummy phone; corrected synthetic input was accepted.

Prepaid order 353206429 / shipment 352582290 was created with item subtotal INR500, shipping INR100, discount INR20. Readback confirmed total INR580, INR currency, prepaid method, original request key and a single `shipments` OBJECT. The draft guard is fixed to accept the documented object/array shapes while checking order/shipment identity, currency, invoice charges and item lines. Repeating the same create key returned the SAME order and shipment IDs.

Partial-COD probe 353206430 / 352582291 supplied partial_cod_collected=120, but order readback did not expose a verified remaining-collection amount or advance field. Acceptance alone is not certification; COD stays blocked. Sandbox serviceability returned couriers with pickup_availability=0, so the automatic booking gate stayed blocked. A separate isolated prepaid AWB contract request encountered a connection failure; subsequent read-only reconciliation returned NEW with AWB null. No automatic AWB retry or pickup was sent. This is not an AWB success claim.

A real-Sandbox transport option is prepared behind INDIA_SHIPPING_BOOKING_MODE=sandbox_provider, valid only on gaziseed-test. It requires SHIPROCKET_SANDBOX_API_EMAIL/PASSWORD and the test pickup configuration; login and all calls are restricted to the exact Sandbox API host. The mode is not enabled yet and the default remains simulation until the user securely supplies the Sandbox password. UI labels distinguish simulation from the real provider Sandbox. Production gates remain off.


### Website connection diagnostic — 2026-10-20 20:25 IST

The Sandbox Preview's existing `/admin/india-shipping/connection` button was traced through the actual signed-in India Admin session. The `india-shipping-connection-check` function was missing from Sandbox, and its previous source only selected live credential names/endpoint. Fixed exact-project-bound selection, deployed the diagnostic only to `qqehtphbpypcmxliaiqd` (JWT verification enabled), and added current Supabase browser CORS headers. Unknown projects, unauthorized admins and missing Sandbox credentials cannot make provider calls. Redirects are refused; diagnostics never expose credentials, token or raw provider response.

Actual website request at `2026-10-20T14:55:05.394Z` produced a structured Edge Function log:
- `admin_authorized: true`, `environment: sandbox`, `credentials_configured: true`.
- Endpoint: `https://api-sandbox.shiprocket.in/v1/external/auth/login`.
- `provider_http_status: 498`, `provider_response_type: text/plain`, `code: provider_access_denied`.
- `noShipmentCreated: true`, `database_modified: false`, `pickup_requested: false`.

This confirms website → Sandbox Edge Function → India Admin authorization → secret lookup → outbound provider request. It does **not** validate the saved password, successful provider authentication, AWB or full booking. A separate credential-free request also received 498, so an invalid password has not been established. The denial's exact owner (provider/in-between network) is still unconfirmed; do not claim Shiprocket requires IP allowlisting without confirmation. Sandbox dashboard advertises the same HTTPS host for external integrations; changing to plaintext HTTP or production is not a safe workaround.

49 shipping tests pass, including Sandbox/live credential separation, unknown-project/unauthorized refusal, CORS, redirects and safe error categorization. Production's existing connection-check function remains unchanged (version 4). Booking mode remains `sandbox_simulated`; the temporary operator test harness remains retired. No migration, live booking, AWB or pickup was executed during this diagnostic.
