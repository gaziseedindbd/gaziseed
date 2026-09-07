# GAZI SEED — Master UI Design System

## 1. Brand Direction
GAZI SEED uses a premium agricultural e-commerce visual language: deep green, natural white, warm gold accents, large crop imagery, rounded surfaces, soft depth, strong Bengali-first readability, and conversion-focused product actions.

Design keywords: Premium, Trustworthy, Agricultural, Modern, Clean, Warm, Conversion-focused.

## 2. Core Color Tokens
- Brand Green: `#18794E` / `hsl(152 68% 28%)`
- Deep Ink Green: `hsl(160 30% 10%)`
- Natural Background: `hsl(48 33% 98%)`
- Card White: `#FFFFFF`
- Warm Gold Accent: `hsl(43 86% 55%)`
- Soft Green Surface: `hsl(152 68% 28% / .06-.12)`
- Border Neutral: `hsl(42 20% 86%)`
- Muted Text: `hsl(160 10% 40%)`
- Danger / Discount: `hsl(0 72% 51%)`

Rule: green is the primary action/trust color; gold is an accent, never the dominant UI color.

## 3. Typography
Use bold, compact headings with calm body copy.
- Hero: `clamp(2rem, 5vw, 5rem)`, weight 900
- Page title: 32–48px desktop, 26–34px mobile, weight 900
- Section title: 24–34px, weight 900
- Card title: 14–18px, weight 800–900
- Body: 14–16px, line-height 1.6–1.75
- Meta/labels: 10–13px, weight 600–800

Bangla text must remain readable at small sizes. Avoid ultra-tight line-height for Bangla.

## 4. Spacing System
Use an 8px-based rhythm.
- XS 4px
- SM 8px
- MD 12–16px
- LG 20–24px
- XL 32px
- 2XL 40–48px
- Section desktop 56–80px
- Section mobile 32–48px

Avoid crowded mobile cards. Minimum touch target: 40–44px.

## 5. Radius System
- Small control: 10–12px
- Button: 12–16px
- Product card: 22–28px
- Large content card: 24–32px
- Hero/promo: 20–28px
- Pills/badges: 999px

## 6. Shadow System
Use soft depth, not heavy floating shadows.
- Card base: `0 10px 35px -24px rgba(15,23,42,.5)`
- Card hover: `0 22px 55px -28px rgba(5,150,105,.45)`
- Large shell: `0 24px 70px -42px rgba(20,80,55,.35)`

## 7. Buttons
Primary: solid brand green, white text, bold, 44–52px height.
Secondary: soft green surface with green border/text.
Buy Now: dark ink / deep green emphasis.
Gold CTA is reserved for hero/promotional emphasis.

States required: hover, active, disabled, loading, focus-visible.

## 8. Product Card Standard
Desktop: 4-column default on All Products. Mobile: 2-column.

Required visual order:
1. Product image
2. Badge / wishlist
3. Rating or trust indicator
4. Product name
5. Optional English name / short meta
6. Price + compare price + discount
7. Stock / packet metadata
8. Add to Cart + Buy Now

Rules:
- Image-first composition
- `object-cover` unless product packshots require `object-contain`
- Preserve real product data and existing commerce logic
- Card hover may lift 4–6px on desktop only
- Never rely on hover for essential information on mobile

## 9. Product Details Standard
Desktop uses two columns: gallery + information shell.
Mobile stacks gallery first, product info second, sticky purchase actions allowed.

Required hierarchy:
- Trust badge / SKU
- Product name
- Rating + reviews
- Price block
- Variant selector
- Stock
- Quantity
- Add to Cart / Buy Now
- Delivery/trust benefits
- Description/specs/guide/reviews/FAQ
- Related products

## 10. Category Cards
Rounded premium tile, crop/seed image, clean centered label, subtle green gradient/surface. Category image should remain visually dominant.

## 11. Hero Standard
Image-first banner with dark directional overlay for legibility.
- Desktop target around 3.2:1
- Mobile target around 2:1
- Text width max ~52%
- White headline and body over imagery
- One strong CTA
- Slide indicators subtle and centered

## 12. Forms
Inputs: 44–48px minimum height, 12–14px radius, neutral border, brand-green focus ring.
Labels should be 12–14px bold. Error states must be clear in text, not color-only.

## 13. Mobile Rules
- Product grid: 2 columns
- Category grid: 2–4 based on card size
- Avoid horizontal overflow
- Keep buttons thumb-friendly
- Reduce decorative shadows/blur for performance
- Important action must remain visible without hover
- Minimum side padding 14–16px

## 14. Motion
Use subtle, fast motion.
- Hover/press: 160–250ms
- Image zoom: 500–700ms
- Hero transitions: 500–800ms
- Avoid excessive bouncing, rotation, or continuous motion

## 15. Accessibility
- Maintain sufficient contrast
- Visible focus state
- Semantic buttons/links
- Alt text for product/category imagery
- Do not communicate status by color alone
- Keep text readable at 200% zoom

## 16. Page Consistency Rule
Every customer-facing page should visually map back to this sequence:
`HOME → CATEGORY → ALL PRODUCTS → PRODUCT DETAILS → CART → CHECKOUT → ACCOUNT`

The page can have its own layout, but must reuse the same color, radius, spacing, typography, button, card, and interaction language.

## 17. Source of Truth
This document is the master UI reference for future GAZI SEED customer-facing redesigns. Existing business logic, Supabase data flow, cart, checkout, wishlist, product variants, pricing, and admin functionality must not be changed solely for presentation work.
