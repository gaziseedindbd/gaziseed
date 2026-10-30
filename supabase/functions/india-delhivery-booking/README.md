# Delhivery production configuration

The booking and pickup functions derive staging or production from `SUPABASE_URL` and reject an `DELHIVERY_API_ENVIRONMENT` value that does not match. Never reuse a staging token against production or vice versa.

Required Edge Function secrets are the existing Supabase key bundles plus `DELHIVERY_API_TOKEN`. Set `DELHIVERY_PICKUP_LOCATION` to the exact active warehouse name registered in Delhivery One; the current account value is `GAZISEEDB2C-B2C`.

Staging booking and pickup remain disabled until their respective `DELHIVERY_BOOKING_ENABLED` and `DELHIVERY_PICKUP_ENABLED` secrets are explicitly set to `true`. In production, each function is enabled unless its corresponding setting is explicitly `false`. The functions still require a signed-in India admin and an explicit per-shipment or per-pickup confirmation in the admin screen.

The Delhivery Company Details page currently contains the seller GST value, so the booking request relies on Delhivery's account default and does not hardcode that identifier into source. The manifest includes HSN `1209` for the active India catalog's vegetable and flower seeds sold for sowing. CBIC lists heading 1209 at nil GST when the goods are seeds meant for sowing. Do not use this HSN for non-seed products or seeds supplied for a different purpose; classify those separately.

The Delhivery Tax Configuration contains the `Seeds for Sowing - Nil GST` tax class (`SEEDS0`, single GST rate 0%). Product-level HSN/tax assignment in Delhivery's product catalog is separate from this tax class. Production booking still requires `DELHIVERY_ACCOUNT_TAX_DEFAULTS_CONFIRMED=true`; keep that gate until Delhivery confirms the account seller GST value is accepted as the default.

Manifest requests are single-attempt. If Delhivery may have received a request but the result cannot be confirmed, the shipment stays locked for manual reconciliation. Pickup requests use a single active warehouse batch lock; close a batch only after the courier physically collects those parcels.
