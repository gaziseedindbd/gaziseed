/*
# GAZI SEED - Landing Page Content & SEO Fields

1. Add SEO and content fields to landing_pages table
2. Add section_order jsonb for content section ordering
3. Add og_title, og_description, og_image for social sharing
4. Add landing_reviews table for admin-managed reviews per landing page
5. Add landing_faqs table for admin-managed FAQs per landing page
6. Storage bucket for product/landing images (created separately)

Notes:
- All new columns are nullable/defaulted to avoid breaking existing rows
- landing_reviews and landing_faqs are separate from product reviews for flexibility
*/

-- Add SEO and content fields to landing_pages
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS seo_title text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS meta_description text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS og_title text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS og_description text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS og_image text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS section_order jsonb DEFAULT '[]'::jsonb;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS offer_headline text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS offer_badge text DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS discount_label text DEFAULT '';

-- Landing page reviews (admin-managed, separate from product reviews)
CREATE TABLE IF NOT EXISTS landing_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  customer_name text NOT NULL DEFAULT '',
  rating int NOT NULL DEFAULT 5,
  review text NOT NULL DEFAULT '',
  customer_image text DEFAULT '',
  review_image text DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE landing_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lr_landing ON landing_reviews(landing_page_id);

-- Landing page FAQs (admin-managed)
CREATE TABLE IF NOT EXISTS landing_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE landing_faqs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lf_landing ON landing_faqs(landing_page_id);

-- RLS for landing_reviews
DROP POLICY IF EXISTS "public_read_landing_reviews" ON landing_reviews;
CREATE POLICY "public_read_landing_reviews" ON landing_reviews FOR SELECT
  TO anon, authenticated USING (is_active = true OR is_admin());
DROP POLICY IF EXISTS "admin_write_landing_reviews" ON landing_reviews;
CREATE POLICY "admin_write_landing_reviews" ON landing_reviews FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- RLS for landing_faqs
DROP POLICY IF EXISTS "public_read_landing_faqs" ON landing_faqs;
CREATE POLICY "public_read_landing_faqs" ON landing_faqs FOR SELECT
  TO anon, authenticated USING (is_active = true OR is_admin());
DROP POLICY IF EXISTS "admin_write_landing_faqs" ON landing_faqs;
CREATE POLICY "admin_write_landing_faqs" ON landing_faqs FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
