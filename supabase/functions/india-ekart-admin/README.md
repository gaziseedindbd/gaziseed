# India Ekart Elite Admin integration

This Edge Function is India-admin only. Ekart credentials and seller legal details are read only from Supabase Edge Function secrets and are never returned to the browser. Pickup locations are loaded from the authenticated Ekart account address book; the Admin chooses the pickup alias per shipment.

## Required Edge Function secrets

Set these in Supabase Project Settings → Edge Functions → Secrets before enabling shipment booking:

- `EKART_CLIENT_ID`
- `EKART_USERNAME`
- `EKART_PASSWORD`
- `EKART_SELLER_NAME`
- `EKART_SELLER_ADDRESS`
- `EKART_SELLER_GSTIN` (optional; leave unset when the Ekart account ships without GSTIN. The integration sends an empty string, never a fabricated value.)
- `EKART_PICKUP_ADDRESS` (optional fallback only when using one Ekart pickup address without selecting a saved alias)
- `EKART_PICKUP_PHONE` (optional fallback)
- `EKART_PICKUP_PIN` (optional fallback)
- `EKART_PICKUP_CITY` (optional fallback)
- `EKART_PICKUP_STATE` (optional fallback)

Optional return address secrets: `EKART_RETURN_ALIAS` (registered Ekart alias) or `EKART_RETURN_NAME`, `EKART_RETURN_ADDRESS`, `EKART_RETURN_PHONE`, `EKART_RETURN_PIN`, `EKART_RETURN_CITY`, `EKART_RETURN_STATE`. By default RTO uses the selected pickup location. Optional goods description: `EKART_CATEGORY_OF_GOODS`.

The shipment form loads the saved Ekart address list and requires an explicit choice when multiple locations exist. The selected alias is checked again server-side for both price quote and booking; the matching PIN is used for serviceability, and the alias is sent to Ekart for pickup and default return location. For one-location setups, the configured pickup secrets remain a fallback. Seller GSTIN and legal name/address must match Ekart KYC.

Taxable value and tax amount are taken from the admin-entered invoice tax value; the integration does not guess GST rate or HSN. COD uses the remaining verified order balance and is limited by the documented Ekart API maximum.

## Implemented API workflows

- Auth token retrieval and short-lived in-memory token caching.
- Pincode lookup/serviceability, forward pricing estimate from V3 serviceability response.
- India order shipment creation with one-order/one-courier database guard and uncertain-outcome reconciliation state.
- Ekart tracking, labels, manifests, cancellation, preferred dispatch date, EWBN, NDR actions, saved-address listing/creation, bulk serviceability listing, and webhook listing (secret redacted).
- Reports are generated from the site's private shipment ledger and last synced tracking state.

## Documented API limitations

- The supplied OpenAPI spec has no explicit pickup-request endpoint. The UI therefore keeps shipments in “Pickup pending” until tracking reports pickup; a manifest is offered as the handover document, not falsely treated as a pickup request.
- Webhook create/update is intentionally not exposed yet. The spec says Ekart sends HMAC-signed events but does not define the signature header/canonicalization details needed to verify incoming requests. Do not register a webhook until Ekart supplies those details and a receiver is added.
- The pricing-estimate V1 schema in the supplied spec has an invalid `required: null` entry. The integration uses documented V3 serviceability response charges instead.

## Deployment

Apply the migration before deploying `india-ekart-admin`. Then deploy the Edge Function and set secrets in the target Supabase project. Booking remains blocked when required secrets are absent or incomplete. Do not run live shipment creation until credential, address, GST/tax and payment configuration are verified.
