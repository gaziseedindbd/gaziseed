# SUPER KING SEED — Safe Redesign Map

## Purpose

This document defines the safe boundary for the UI redesign. The redesign branch must preserve existing business logic, Supabase schema, authentication, API behavior, cart/order behavior, tracking, and admin permissions unless a separate approved change explicitly requires otherwise.

## Baseline

- Source baseline: `main`
- Redesign branch: `redesign-safe-v1`
- Database/schema is treated as read-only during visual redesign.
- No destructive migration is allowed as part of UI work.

## Architecture zones

### 1. Customer routes — UI + page composition

`app/account/page.tsx`
`app/all-products/page.tsx`
`app/blog/page.tsx`
`app/cart/page.tsx`
`app/categories/page.tsx`
`app/category/**`
`app/checkout/page.tsx`
`app/contact/page.tsx`
`app/login/page.tsx`
`app/page.tsx`

These may receive visual/layout changes, but existing data fetching, mutations, validation, navigation, and state behavior must be preserved.

### 2. Admin routes — UI + page composition

`app/admin/**`

Major current modules include:

- admin-management
- ads-landing
- ai
- banners
- batches
- blog
- campaigns
- categories
- combos
- coupons
- customers
- delivery
- homepage
- inventory
- messages
- navigation
- orders
- pages
- popups

Admin role/permission behavior must not be changed by redesign work.

### 3. Customer reusable components

`components/site/**`

Current important components include:

- `site-header.tsx`
- `site-footer.tsx`
- `home.tsx`
- `product-card.tsx`
- `product-gallery.tsx`
- `all-products-page.tsx`
- `address-selector.tsx`
- `cart-provider.tsx`
- `announcement-bar.tsx`
- `bottom-nav.tsx`
- `promotional-popup.tsx`
- `review-form.tsx`
- `referral-section.tsx`
- `marketing-tracker.tsx`
- `referral-tracker.tsx`
- `language-provider.tsx`
- `feature-provider.tsx`
- `toast-provider.tsx`
- `theme-provider.tsx`
- `theme-switcher.tsx`
- `theme-wrapper.tsx`
- `whatsapp-button.tsx`
- `account-password-launcher.tsx`
- `change-password-form.tsx`
- `home-floating-reviews.tsx`

Visual markup/classes can be redesigned. Providers, handlers, side effects, storage keys, and external integrations must be preserved unless separately reviewed.

### 4. Admin reusable components

`components/admin/**`

Known shared components:

- `admin-layout.tsx`
- `image-uploader.tsx`
- `media-uploader.tsx`
- `notification-center.tsx`
- `repeatable-list.tsx`

Uploader behavior, storage paths, validation, notification behavior, and repeatable-field semantics are protected.

### 5. Shared logic — PROTECTED

`lib/**`

Important protected files:

- `lib/data.ts`
- `lib/cart.ts`
- `lib/marketing.ts`
- `lib/referral.ts`
- `lib/image-processing.ts`
- `lib/imageOptimizer.ts`
- `lib/bangladesh-locations.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/types.ts`

These are not redesign targets. Any change requires explicit functional review.

### 6. Supabase — HARD PROTECTED

`supabase/migrations/**`
`supabase/functions/**`

Do not modify tables, columns, relationships, indexes, RLS policies, functions, triggers, or migrations during visual redesign.

### 7. Global shell — HIGH RISK UI

`app/layout.tsx` wires the global customer shell and providers, including:

- FeatureProvider
- MarketingTracker
- ReferralTracker
- LanguageProvider
- ToastProvider
- CartProvider
- AnnouncementBar
- SiteHeader
- SiteFooter
- WhatsAppButton
- PromotionalPopup
- BottomNav
- ThemeSwitcher
- AccountPasswordLauncher
- HomeFloatingReviews

Layout styling can change, but these functional integrations must remain wired unless explicitly reviewed.

### 8. Global styling

`app/globals.css`

This is a primary redesign target. Existing design tokens, theme classes, responsive behavior, and special selectors must be audited before replacement.

## Redesign rules

1. Work only on `redesign-safe-v1` until functional parity is verified.
2. Do not redesign by deleting/rebuilding the data layer.
3. Prefer CSS/class/markup changes over business-logic rewrites.
4. Preserve component props and event contracts where possible.
5. Preserve route paths and URL parameters.
6. Preserve database field names and query semantics.
7. Preserve auth and role/permission checks.
8. Preserve cart, checkout, order, coupon, inventory, referral, review, and tracking behavior.
9. Preserve upload/storage behavior.
10. Verify mobile and desktop after each major UI area.
11. Only merge to `main` after functional verification.

## Safe redesign order

1. Global design tokens / typography / spacing
2. Customer header + navigation
3. Homepage visual composition
4. Product card + product listing visuals
5. Product detail/gallery visuals
6. Cart + checkout visuals
7. Account/auth visuals
8. Footer / utility UI
9. Admin shell/navigation visuals
10. Admin module visuals one module at a time
11. Final regression check

## High-risk files to avoid casual editing

- `app/layout.tsx`
- `app/admin/layout.tsx`
- `components/site/cart-provider.tsx`
- `components/site/marketing-tracker.tsx`
- `components/site/referral-tracker.tsx`
- `components/site/feature-provider.tsx`
- `components/site/language-provider.tsx`
- `components/admin/admin-layout.tsx`
- `components/admin/image-uploader.tsx`
- `components/admin/media-uploader.tsx`
- `lib/data.ts`
- `lib/cart.ts`
- `lib/marketing.ts`
- `lib/referral.ts`
- `lib/supabase/**`
- `supabase/**`

## Current component inventory source

The current `components/site` tree contains 25 tracked files. The current `components/admin` tree contains the shared admin components listed above. The repository also contains the `app/admin` route tree and Supabase migration/function directories.
