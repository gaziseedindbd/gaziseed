/*
# GAZI SEED - Ads Landing Page System

1. Products table: add is_ads_only column (marks products that only exist for Ads, not shown in normal catalog)
2. Landing pages table: add landing_name, landing_slug, status, views columns for dedicated landing page management
3. Bundle offers: add is_default_selected, custom_delivery_charge columns
4. New table: landing_page_views (tracks page views per landing page for analytics)
5. RLS policies for new columns/tables

Notes:
- is_ads_only products are excluded from normal website queries (all-products, categories, search, homepage)
- landing_slug is the URL slug for /offer/[slug], separate from product slug
- status: draft, active, paused, archived
- views table stores actual page view events (no fake data)
*/

-- Add is_ads_only to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_ads_only boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_ads_only ON products(is_ads_only);

-- Add landing page management columns
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS landing_name text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS landing_slug text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
CREATE INDEX IF NOT EXISTS idx_landing_slug ON landing_pages(landing_slug);
CREATE INDEX IF NOT EXISTS idx_landing_status ON landing_pages(status);

-- Add bundle columns
ALTER TABLE bundle_offers ADD COLUMN IF NOT EXISTS is_default_selected boolean NOT NULL DEFAULT false;
ALTER TABLE bundle_offers ADD COLUMN IF NOT EXISTS custom_delivery_charge numeric(10,2) DEFAULT NULL;

-- Landing page views table
CREATE TABLE IF NOT EXISTS landing_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  utm_source text DEFAULT '',
  utm_medium text DEFAULT '',
  utm_campaign text DEFAULT '',
  utm_content text DEFAULT '',
  utm_term text DEFAULT '',
  fbclid text DEFAULT '',
  gclid text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE landing_page_views ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lpv_landing ON landing_page_views(landing_page_id);

-- RLS for landing_page_views: anon can insert (view tracking), admin can read
DROP POLICY IF EXISTS "anon_insert_lpv" ON landing_page_views;
CREATE POLICY "anon_insert_lpv" ON landing_page_views FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_lpv" ON landing_page_views;
CREATE POLICY "admin_read_lpv" ON landing_page_views FOR SELECT
  TO authenticated USING (is_admin());

-- Make landing_slug unique
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_landing_slug_unique') THEN
    CREATE UNIQUE INDEX idx_landing_slug_unique ON landing_pages(landing_slug) WHERE landing_slug <> '';
  END IF;
END $$;
