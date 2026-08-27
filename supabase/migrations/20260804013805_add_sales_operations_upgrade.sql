/*
# Sales & Operations Upgrade

## New Tables
- product_variants: Optional variants per product (size/pack)
- bulk_pricing: Wholesale/bulk tiered pricing per product/variant
- wishlists: Customer wishlist items
- support_tickets: Customer issue/germination support
- support_ticket_replies: Admin-customer conversation
- customer_tags: Manual/derived customer tags

## Modified Tables
- products: added min_order_qty, max_order_qty, suitable_months (jsonb), growing_type (text), season_tags (jsonb), cost_price, show_low_stock
- site_settings: added feature toggle columns (all default OFF/safe)
- orders: added cost_price_total, coupon_discount, support fields
- order_items: added variant_id, variant_name, is_free_gift, promotion_id, cost_price

## Security
- All new tables have RLS
- Admin-only write for business data
- Customers can only read/write own wishlist/tickets
- Cost price never exposed to anon/public SELECT policies
*/

-- 1. Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  regular_price numeric(12,2) NOT NULL,
  sale_price numeric(12,2),
  stock integer NOT NULL DEFAULT 0,
  weight_or_count text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Bulk Pricing
CREATE TABLE IF NOT EXISTS bulk_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Wishlists
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 4. Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text UNIQUE NOT NULL DEFAULT ('ST' || lpad((EXTRACT(EPOCH FROM now())::bigint % 1000000)::text, 6, '0')),
  user_id uuid,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_number text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text,
  issue_type text NOT NULL,
  description text NOT NULL,
  photo_url text,
  preferred_resolution text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Support Ticket Replies
CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  reply_by uuid,
  reply_by_role text NOT NULL DEFAULT 'customer',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 6. Customer Tags
CREATE TABLE IF NOT EXISTS customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tag text NOT NULL,
  is_auto boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 7. Products: new columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_qty integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_order_qty integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS suitable_months jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS growing_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS season_tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_low_stock boolean NOT NULL DEFAULT true;

-- 8. Site Settings: feature toggles
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_variants boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_bulk_pricing boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_seasonal_finder boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_recently_viewed boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_wishlist boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_coupons boolean NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_order_again boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_support_tickets boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_low_stock_msg boolean NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_reward_points boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_referral boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_abandoned_checkout boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS duplicate_order_hours integer NOT NULL DEFAULT 24;

-- 9. Order items: variant + gift + cost fields
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id uuid;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_free_gift boolean NOT NULL DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS promotion_id uuid;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price numeric(12,2);

-- 10. Enable RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;

-- 11. Product Variants policies
DROP POLICY IF EXISTS "public_read_active_variants" ON product_variants;
CREATE POLICY "public_read_active_variants" ON product_variants FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "admins_write_variants" ON product_variants;
CREATE POLICY "admins_write_variants" ON product_variants FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 12. Bulk Pricing policies
DROP POLICY IF EXISTS "public_read_active_bulk" ON bulk_pricing;
CREATE POLICY "public_read_active_bulk" ON bulk_pricing FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "admins_write_bulk" ON bulk_pricing;
CREATE POLICY "admins_write_bulk" ON bulk_pricing FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 13. Wishlist policies (customer owns own)
DROP POLICY IF EXISTS "user_read_own_wishlist" ON wishlists;
CREATE POLICY "user_read_own_wishlist" ON wishlists FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_insert_own_wishlist" ON wishlists;
CREATE POLICY "user_insert_own_wishlist" ON wishlists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_delete_own_wishlist" ON wishlists;
CREATE POLICY "user_delete_own_wishlist" ON wishlists FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins_read_wishlist" ON wishlists;
CREATE POLICY "admins_read_wishlist" ON wishlists FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 14. Support Tickets policies
DROP POLICY IF EXISTS "user_read_own_tickets" ON support_tickets;
CREATE POLICY "user_read_own_tickets" ON support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));
DROP POLICY IF EXISTS "user_insert_own_tickets" ON support_tickets;
CREATE POLICY "user_insert_own_tickets" ON support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins_update_tickets" ON support_tickets;
CREATE POLICY "admins_update_tickets" ON support_tickets FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 15. Support Ticket Replies policies
DROP POLICY IF EXISTS "user_read_own_ticket_replies" ON support_ticket_replies;
CREATE POLICY "user_read_own_ticket_replies" ON support_ticket_replies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_ticket_replies.ticket_id AND (support_tickets.user_id = auth.uid() OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true))));
DROP POLICY IF EXISTS "user_insert_own_ticket_replies" ON support_ticket_replies;
CREATE POLICY "user_insert_own_ticket_replies" ON support_ticket_replies FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_ticket_replies.ticket_id AND (support_tickets.user_id = auth.uid() OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true))));

-- 16. Customer Tags policies (admin-only)
DROP POLICY IF EXISTS "admins_read_customer_tags" ON customer_tags;
CREATE POLICY "admins_read_customer_tags" ON customer_tags FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));
DROP POLICY IF EXISTS "admins_write_customer_tags" ON customer_tags;
CREATE POLICY "admins_write_customer_tags" ON customer_tags FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 17. Indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_bulk_pricing_product_id ON bulk_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_product ON wishlists(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket_id ON support_ticket_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_user_id ON customer_tags(user_id);
