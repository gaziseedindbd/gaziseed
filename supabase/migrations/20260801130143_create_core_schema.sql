/*
# GAZI SEED - Core E-commerce Schema

Creates the foundational database tables for a full-stack seed e-commerce platform:
- Categories & subcategories for product organization
- Products with seed-specific attributes
- Product images gallery
- Facebook/Instagram bundle offers (independent pricing)
- Ads landing page content per product
- Delivery zones with COD support
- Orders and order items (single unified order table)
- Order status history tracking
- Inventory history
- Customer addresses for registered users
- Coupons/discount codes
- Reviews (admin-moderated) and testimonials

Security:
- RLS enabled on all tables
- Public read access for storefront data (products, categories, etc.)
- Guest order creation via SECURITY DEFINER function (server-side price calculation)
- Admin write access via is_admin() check
- Customer self-service for own orders/addresses
*/

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bn text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  image text DEFAULT '',
  banner text DEFAULT '',
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  seo_title text DEFAULT '',
  meta_description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bn text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  sku text DEFAULT '',
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  short_description text DEFAULT '',
  description text DEFAULT '',
  regular_price numeric(10,2) NOT NULL DEFAULT 0,
  sale_price numeric(10,2) DEFAULT NULL,
  stock int NOT NULL DEFAULT 0,
  low_stock_threshold int NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  is_best_seller boolean NOT NULL DEFAULT false,
  is_new_arrival boolean NOT NULL DEFAULT false,
  is_seasonal boolean NOT NULL DEFAULT false,
  image text DEFAULT '',
  images jsonb DEFAULT '[]'::jsonb,
  video_url text DEFAULT '',
  seed_type text DEFAULT '',
  variety text DEFAULT '',
  brand text DEFAULT '',
  origin text DEFAULT '',
  season text DEFAULT '',
  planting_season text DEFAULT '',
  germination_time text DEFAULT '',
  germination_rate text DEFAULT '',
  harvest_time text DEFAULT '',
  plant_spacing text DEFAULT '',
  planting_depth text DEFAULT '',
  sunlight text DEFAULT '',
  water_requirement text DEFAULT '',
  soil_type text DEFAULT '',
  growing_location text DEFAULT '',
  packet_weight text DEFAULT '',
  seed_quantity text DEFAULT '',
  expected_yield text DEFAULT '',
  cultivation_instructions text DEFAULT '',
  storage_instructions text DEFAULT '',
  features jsonb DEFAULT '[]'::jsonb,
  benefits jsonb DEFAULT '[]'::jsonb,
  seo_title text DEFAULT '',
  meta_description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ============ PRODUCT_IMAGES ============
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- ============ BUNDLE_OFFERS ============
CREATE TABLE IF NOT EXISTS bundle_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bundle_name text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1,
  bundle_price numeric(10,2) NOT NULL DEFAULT 0,
  compare_price numeric(10,2) DEFAULT NULL,
  savings text DEFAULT '',
  badge text DEFAULT '',
  free_delivery boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE bundle_offers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bundles_product ON bundle_offers(product_id);

-- ============ LANDING_PAGES ============
CREATE TABLE IF NOT EXISTS landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  title text DEFAULT '',
  subtitle text DEFAULT '',
  images jsonb DEFAULT '[]'::jsonb,
  video_url text DEFAULT '',
  compare_price numeric(10,2) DEFAULT NULL,
  offer_price numeric(10,2) DEFAULT NULL,
  benefits jsonb DEFAULT '[]'::jsonb,
  features jsonb DEFAULT '[]'::jsonb,
  description text DEFAULT '',
  growing_guide text DEFAULT '',
  trust_text text DEFAULT '',
  cod_text text DEFAULT '',
  delivery_text text DEFAULT '',
  faq jsonb DEFAULT '[]'::jsonb,
  cta_text text DEFAULT '',
  section_visibility jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

-- ============ DELIVERY_ZONES ============
CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL DEFAULT '',
  charge numeric(10,2) NOT NULL DEFAULT 0,
  estimated_time text DEFAULT '',
  cod_enabled boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid DEFAULT NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  customer_email text DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  delivery_zone_id uuid DEFAULT NULL REFERENCES delivery_zones(id) ON DELETE SET NULL,
  delivery_zone_name text DEFAULT '',
  delivery_charge numeric(10,2) NOT NULL DEFAULT 0,
  special_instructions text DEFAULT '',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  grand_total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cod',
  order_source text NOT NULL DEFAULT 'website',
  utm_source text DEFAULT '',
  utm_medium text DEFAULT '',
  utm_campaign text DEFAULT '',
  utm_content text DEFAULT '',
  utm_term text DEFAULT '',
  fbclid text DEFAULT '',
  gclid text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  internal_notes text DEFAULT '',
  coupon_code text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(order_source);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ============ ORDER_ITEMS ============
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid DEFAULT NULL REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  bundle_id uuid DEFAULT NULL REFERENCES bundle_offers(id) ON DELETE SET NULL,
  bundle_name text DEFAULT '',
  image text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ============ ORDER_STATUS_HISTORY ============
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_osh_order ON order_status_history(order_id);

-- ============ INVENTORY_HISTORY ============
CREATE TABLE IF NOT EXISTS inventory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_change int NOT NULL DEFAULT 0,
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_invhist_product ON inventory_history(product_id);

-- ============ CUSTOMER_ADDRESSES ============
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  delivery_zone_id uuid DEFAULT NULL REFERENCES delivery_zones(id) ON DELETE SET NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- ============ COUPONS ============
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'fixed',
  value numeric(10,2) NOT NULL DEFAULT 0,
  min_order numeric(10,2) DEFAULT 0,
  max_discount numeric(10,2) DEFAULT NULL,
  start_date timestamptz DEFAULT now(),
  expiry_date timestamptz DEFAULT NULL,
  usage_limit int DEFAULT NULL,
  usage_count int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name text NOT NULL DEFAULT '',
  rating int NOT NULL DEFAULT 5,
  review text DEFAULT '',
  photo text DEFAULT '',
  is_approved boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

-- ============ TESTIMONIALS ============
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL DEFAULT '',
  image text DEFAULT '',
  review text NOT NULL DEFAULT '',
  rating int NOT NULL DEFAULT 5,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- ============ SERVICES ============
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  short_description text DEFAULT '',
  full_description text DEFAULT '',
  icon text DEFAULT '',
  image text DEFAULT '',
  cta_text text DEFAULT '',
  cta_url text DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- ============ BANNERS ============
CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desktop_image text NOT NULL DEFAULT '',
  mobile_image text DEFAULT '',
  title text DEFAULT '',
  subtitle text DEFAULT '',
  cta_text text DEFAULT '',
  cta_url text DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  start_date timestamptz DEFAULT NULL,
  end_date timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- ============ BLOG_POSTS ============
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  featured_image text DEFAULT '',
  content text DEFAULT '',
  category text DEFAULT '',
  seo_title text DEFAULT '',
  meta_description text DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  publish_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);

-- ============ CONTACT_MESSAGES ============
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text DEFAULT '',
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- ============ PAGES ============
CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  content text DEFAULT '',
  seo_title text DEFAULT '',
  meta_description text DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- ============ NAVIGATION ============
CREATE TABLE IF NOT EXISTS navigation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  parent_id uuid DEFAULT NULL REFERENCES navigation(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE navigation ENABLE ROW LEVEL SECURITY;

-- ============ ANNOUNCEMENTS ============
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL DEFAULT '',
  link text DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ============ SITE_SETTINGS ============
CREATE TABLE IF NOT EXISTS site_settings (
  id int PRIMARY KEY DEFAULT 1,
  website_name text NOT NULL DEFAULT 'GAZI SEED',
  logo text DEFAULT '',
  favicon text DEFAULT '',
  phone text DEFAULT '',
  whatsapp text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  business_hours text DEFAULT '',
  currency text NOT NULL DEFAULT 'BDT',
  currency_symbol text NOT NULL DEFAULT '৳',
  facebook text DEFAULT '',
  instagram text DEFAULT '',
  youtube text DEFAULT '',
  tiktok text DEFAULT '',
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  whatsapp_message text DEFAULT 'আসসালামু আলাইকুম, আমি একটি প্রোডাক্ট সম্পর্কে জানতে চাই',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- ============ MARKETING_SETTINGS ============
CREATE TABLE IF NOT EXISTS marketing_settings (
  id int PRIMARY KEY DEFAULT 1,
  meta_pixel_id text DEFAULT '',
  ga4_measurement_id text DEFAULT '',
  gtm_id text DEFAULT '',
  tiktok_pixel_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE marketing_settings ENABLE ROW LEVEL SECURITY;

-- ============ HOMEPAGE_SECTIONS ============
CREATE TABLE IF NOT EXISTS homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  title text DEFAULT '',
  subtitle text DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE homepage_sections ENABLE ROW LEVEL SECURITY;

-- ============ ADMIN_USERS ============
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ============ updated_at TRIGGERS ============
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  tables_arr text[] := ARRAY['categories','products','bundle_offers','landing_pages','delivery_zones','orders','order_items','customer_addresses','coupons','services','banners','blog_posts','pages','site_settings','marketing_settings','homepage_sections'];
BEGIN
  FOREACH t IN ARRAY tables_arr LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_%s ON %s;', t, t);
    EXECUTE format('CREATE TRIGGER trg_updated_%s BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;

-- ============ is_admin() HELPER ============
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;
