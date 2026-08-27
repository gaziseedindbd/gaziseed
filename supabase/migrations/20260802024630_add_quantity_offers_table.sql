/*
# GAZI SEED - Quantity Offers Table

Dedicated table for quantity-based custom pricing on Ads Landing Pages.
Each row = one quantity option with a manually-configured final price.

Key rules enforced server-side:
- Final price is ALWAYS the admin-configured bundle_price, never unit_price × quantity
- Stock deduction uses the quantity field, not 1
- Frontend sends only quantity_offer_id; backend retrieves real values
*/

CREATE TABLE IF NOT EXISTS quantity_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  offer_price numeric(10,2) NOT NULL DEFAULT 0,
  compare_price numeric(10,2) DEFAULT NULL,
  badge text DEFAULT '',
  free_delivery boolean NOT NULL DEFAULT false,
  custom_delivery_charge numeric(10,2) DEFAULT NULL,
  is_default_selected boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE quantity_offers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_qo_landing ON quantity_offers(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_qo_product ON quantity_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_qo_active ON quantity_offers(is_active);

-- RLS: public read active offers, admin full access
DROP POLICY IF EXISTS "public_read_quantity_offers" ON quantity_offers;
CREATE POLICY "public_read_quantity_offers" ON quantity_offers FOR SELECT
  TO anon, authenticated USING (is_active = true OR is_admin());
DROP POLICY IF EXISTS "admin_write_quantity_offers" ON quantity_offers;
CREATE POLICY "admin_write_quantity_offers" ON quantity_offers FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
