-- 1. Fix order_items: add quantity_offer_id column (bundle_id FK prevents storing quantity offer IDs)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity_offer_id uuid;
CREATE INDEX IF NOT EXISTS idx_order_items_qo ON order_items(quantity_offer_id);

-- 2. Extend customer_addresses with structured Bangladesh address fields
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS label text DEFAULT 'Home';
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS division text DEFAULT '';
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS district text DEFAULT '';
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS thana text DEFAULT '';
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS postal_code text DEFAULT '';
