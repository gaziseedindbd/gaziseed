# Meta Conversions API setup

GAZI SEED keeps the browser Pixel as the client-side event source and adds server-side Purchase events through Meta Conversions API.

## Required Vercel environment variables

- META_CAPI_ACCESS_TOKEN: Meta Conversions API access token for dataset/pixel 2700023083750021.
- META_CAPI_GRAPH_VERSION: optional; defaults to v26.0.
- META_CAPI_TEST_EVENT_CODE: optional; set temporarily while validating server events in Meta Events Manager Test Events.

The existing marketing_settings.meta_pixel_id remains the source of truth for the Pixel ID in both BD and IN branches.

## Event deduplication

Browser Purchase and server Purchase use the deterministic event ID:

purchase:<country_code>:<order_number>

The browser sends it as Meta Pixel eventID; CAPI sends the same value as event_id. Meta can therefore deduplicate the two copies of the same Purchase event. Keep the event ID stable for the same order. Matching event name and event ID are the key deduplication fields for browser/server copies. citeturn749147search0turn749147search1

## Server payload

The server sends Purchase with website action source, order value/currency, order ID, content IDs/items and normalized hashed customer identifiers. IP address and user agent are sent when the event is triggered from the order-success route.

The integration pins Graph API v26.0 by default; Meta's current Graph API release is v26.0 as of July 29, 2026. citeturn864932search1

## Delivery and retries

A service-role-only meta_capi_events table provides idempotency and delivery state. Order-success triggers immediate server delivery. A protected cron route retries pending/failed recent website purchases.

No checkout, payment, Messenger, or public order RPC logic is changed by this module.
