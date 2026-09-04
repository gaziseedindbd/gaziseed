# SEED BARI Unified Integration

## Source-of-truth rules

1. The existing GitHub application remains the base application.
2. India (`IN`) and Bangladesh (`BD`) remain first-class storefront markets.
3. The existing Supabase project remains the production data layer.
4. The supplied SEED BARI ZIP is a business-logic and workflow reference, not a codebase to copy.
5. ZIP UI/layout is not treated as the final design. The final UI will be redesigned for SEED BARI.
6. Existing production data and working flows must not be destructively replaced.
7. ZIP migrations must be reconciled against the current Supabase schema before any production DDL is applied.

## Current integration boundary

### Retain as base

- Country-aware storefront (`IN` / `BD`)
- INR / BDT formatting
- Current product query and product/image/variant relationship
- Current cart and checkout entry points
- Current order and customer foundation
- Current Supabase SSR/browser client setup
- Current GitHub -> Vercel deployment relationship

### Integrate and upgrade

- Advanced product attributes and merchandising
- Variants and bulk pricing
- Inventory, stock alerts, movement history and combo inventory
- Coupons, promotions, offers and free-gift rules
- Combo commerce and transactional stock handling
- Master Admin / Admin hierarchy and permissions
- Reviews, support and customer operations
- CMS: homepage, banners, navigation, pages, blog, guides, services, video gallery
- Referral and rewards/wallet flows
- Campaign attribution and marketing events
- Payments, guest-order tracking and notification foundations
- AI configuration and operational hooks
- Landing pages and campaign-specific storefronts

### Explicit incompatibility rules

The ZIP contains older models that must not be copied verbatim into the current app. Examples include legacy field names such as `is_active`, `is_featured`, older delivery-zone structures, and referral tables such as `referral_codes` / `referrals`. Current production schema uses different names and relationships. Integration work must translate ZIP behavior to the current schema instead of creating parallel legacy models.

## Current Supabase reconciliation notes

The current production database already contains most of the major domain tables required by the ZIP reference, including products, product_images, product_variants, bulk_prices, combos, inventory_movements, customers, orders, coupons, referral_settings, referral_wallets, reward_settings, reward_wallets, landing_pages, campaigns, banners, promotional_popups, reviews, wishlists, support, CMS, AI, audit logs, payment transactions and guest-order/payment tables.

Therefore, the implementation path is **reconcile -> extend -> harden**, not **drop -> recreate**.

## Branch strategy

All implementation work starts from `main` on:

`feature/seed-bari-unified-integration`

Production `main` must remain untouched until a complete, tested integration is ready.
