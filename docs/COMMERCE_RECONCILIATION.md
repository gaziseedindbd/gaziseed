# SEED BARI Commerce Reconciliation

## Implemented
- Checkout input is country-aware and can carry `state` for shipping calculation.
- Server action validates cart presence and item quantities before calling the transactional RPC.
- Checkout still uses the existing `create_checkout_order` transaction instead of duplicating stock/order writes in application code.
- Coupon matching now accepts either a country-specific coupon or a coupon with `country IS NULL` as a global coupon.
- Coupon percentage/fixed values are clamped at zero before discount calculation.
- Existing product and combo stock locking/deduction logic remains transactional.
- Combo component validation now checks that variant-backed components belong to an active product in the requested country.

## Intentionally not changed
- No ZIP migrations were copied into production.
- No production data was deleted or rewritten.
- `combo_items.variant_id` remains unchanged because loosening that NOT NULL constraint requires a separate reviewed schema migration. Existing data is preserved.

## Validation limitation
Local `npm`/TypeScript validation is still unavailable in this environment because GitHub cannot be cloned over the network. Supabase migrations were applied successfully through the connected project.
