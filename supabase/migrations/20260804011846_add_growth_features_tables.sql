/*
# Add related seeds, combo packs, promotions, batches, stock notifications, product FAQs, and SEO columns

## Summary
Adds tables and columns for: related products, combo packs (with multi-product bundles and server-side stock deduction), free gift promotions, batch/expiry management, back-in-stock notifications, product FAQs, and image alt text.

## New Tables
- combo_packs: Multi-product combo packs with SEO
- combo_items: Products included in a combo with quantities
- promotions: Free gift promotions with flexible rules
- promotion_gifts: Gift products for a promotion (single or customer-choice)
- product_batches: Batch/expiry tracking per product
- stock_notifications: Back-in-stock notify requests
- product_faqs: Repeatable FAQs per product

## Modified Tables
- products: added related_product_ids (jsonb array), image_alt (text), image_alt_bn (text)
- blog_posts: added related_product_ids (jsonb array) for internal linking

## Security
- All new tables have RLS enabled
- Admin-only write policies (via admin_users check)
- Public read for active/published records
- Stock notifications: anyone can insert (anon + authenticated), admin-only read/update
- Product FAQs: public read for active, admin-only write
- Combo packs: public read for active, admin-only write
- Promotions: public read for active, admin-only write
- Batches: admin-only read/write (internal data)
*/

-- 1. Related product IDs on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS related_product_ids jsonb DEFAULT '[]'::jsonb;

-- 2. Image alt text on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_alt text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_alt_bn text;

-- 3. Blog related products for internal linking
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS related_product_ids jsonb DEFAULT '[]'::jsonb;

-- 4. Combo Packs
CREATE TABLE IF NOT EXISTS combo_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bn text NOT NULL,
  name_en text,
  slug text UNIQUE NOT NULL,
  description_bn text,
  description_en text,
  images jsonb DEFAULT '[]'::jsonb,
  regular_total numeric(12,2) NOT NULL DEFAULT 0,
  combo_price numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  seo_title text,
  meta_description text,
  og_image text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Combo Items (products within a combo)
CREATE TABLE IF NOT EXISTS combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES combo_packs(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 6. Promotions (Free Gift)
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  min_quantity integer NOT NULL DEFAULT 0,
  min_amount numeric(12,2) DEFAULT 0,
  eligibility text NOT NULL DEFAULT 'all',
  eligible_product_ids jsonb DEFAULT '[]'::jsonb,
  eligible_category_ids jsonb DEFAULT '[]'::jsonb,
  gift_mode text NOT NULL DEFAULT 'automatic',
  free_quantity integer NOT NULL DEFAULT 1,
  start_date timestamptz,
  end_date timestamptz,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  one_per_order boolean NOT NULL DEFAULT true,
  can_combine boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Promotion Gifts (products given as gifts)
CREATE TABLE IF NOT EXISTS promotion_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 8. Product Batches
CREATE TABLE IF NOT EXISTS product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number text,
  lot_number text,
  supplier text,
  received_date date,
  packing_date date,
  best_before date,
  expiry_date date,
  batch_stock integer NOT NULL DEFAULT 0,
  cost_price numeric(12,2),
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9. Stock Notifications
CREATE TABLE IF NOT EXISTS stock_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  phone text NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'waiting',
  notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 10. Product FAQs
CREATE TABLE IF NOT EXISTS product_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  question_bn text NOT NULL,
  answer_bn text NOT NULL,
  question_en text,
  answer_en text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 11. Enable RLS on all new tables
ALTER TABLE combo_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_faqs ENABLE ROW LEVEL SECURITY;

-- 12. Combo Packs policies
DROP POLICY IF EXISTS "public_read_active_combos" ON combo_packs;
CREATE POLICY "public_read_active_combos" ON combo_packs FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "admins_write_combos" ON combo_packs;
CREATE POLICY "admins_write_combos" ON combo_packs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- Combo Items policies
DROP POLICY IF EXISTS "public_read_combo_items" ON combo_items;
CREATE POLICY "public_read_combo_items" ON combo_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admins_write_combo_items" ON combo_items;
CREATE POLICY "admins_write_combo_items" ON combo_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 13. Promotions policies
DROP POLICY IF EXISTS "public_read_active_promotions" ON promotions;
CREATE POLICY "public_read_active_promotions" ON promotions FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "admins_write_promotions" ON promotions;
CREATE POLICY "admins_write_promotions" ON promotions FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- Promotion Gifts policies
DROP POLICY IF EXISTS "public_read_promotion_gifts" ON promotion_gifts;
CREATE POLICY "public_read_promotion_gifts" ON promotion_gifts FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admins_write_promotion_gifts" ON promotion_gifts;
CREATE POLICY "admins_write_promotion_gifts" ON promotion_gifts FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 14. Product Batches policies (admin-only)
DROP POLICY IF EXISTS "admins_read_batches" ON product_batches;
CREATE POLICY "admins_read_batches" ON product_batches FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "admins_write_batches" ON product_batches;
CREATE POLICY "admins_write_batches" ON product_batches FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 15. Stock Notifications policies
DROP POLICY IF EXISTS "anon_insert_stock_notifications" ON stock_notifications;
CREATE POLICY "anon_insert_stock_notifications" ON stock_notifications FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admins_read_stock_notifications" ON stock_notifications;
CREATE POLICY "admins_read_stock_notifications" ON stock_notifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "admins_update_stock_notifications" ON stock_notifications;
CREATE POLICY "admins_update_stock_notifications" ON stock_notifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "admins_delete_stock_notifications" ON stock_notifications;
CREATE POLICY "admins_delete_stock_notifications" ON stock_notifications FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 16. Product FAQs policies
DROP POLICY IF EXISTS "public_read_active_faqs" ON product_faqs;
CREATE POLICY "public_read_active_faqs" ON product_faqs FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "admins_write_faqs" ON product_faqs;
CREATE POLICY "admins_write_faqs" ON product_faqs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 17. Indexes
CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_product_id ON combo_items(product_id);
CREATE INDEX IF NOT EXISTS idx_promotion_gifts_promo_id ON promotion_gifts(promotion_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_notifications_product_id ON stock_notifications(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_notifications_status ON stock_notifications(status);
CREATE INDEX IF NOT EXISTS idx_product_faqs_product_id ON product_faqs(product_id);
CREATE INDEX IF NOT EXISTS idx_combo_packs_slug ON combo_packs(slug);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
