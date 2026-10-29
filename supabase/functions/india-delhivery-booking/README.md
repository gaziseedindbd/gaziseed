# Delhivery production configuration

The booking and pickup functions derive staging or production from `SUPABASE_URL` and reject an `DELHIVERY_API_ENVIRONMENT` value that does not match. Never reuse a staging token against production or vice versa.

Required Edge Function secrets are the existing Supabase key bundles plus `DELHIVERY_API_TOKEN`. Set `DELHIVERY_PICKUP_LOCATION` to the exact active warehouse name registered in Delhivery One; the current account value is `GAZISEEDB2C-B2C`.

Staging booking and pickup remain disabled until their respective `DELHIVERY_BOOKING_ENABLED` and `DELHIVERY_PICKUP_ENABLED` secrets are explicitly set to `true`. In production, each function is enabled unless its corresponding setting is explicitly `false`. The functions still require a signed-in India admin and an explicit per-shipment or per-pickup confirmation in the admin screen.

Production shipment booking also fails closed unless `DELHIVERY_ACCOUNT_TAX_DEFAULTS_CONFIRMED=true`. Set that secret only after Delhivery confirms the seller GSTIN and HSN defaults are saved to the account. The order schema does not contain HSN or seller tax identity fields, and the code must not invent them.

Manifest requests are single-attempt. If Delhivery may have received a request but the result cannot be confirmed, the shipment stays locked for manual reconciliation. Pickup requests use a single active warehouse batch lock; close a batch only after the courier physically collects those parcels.
