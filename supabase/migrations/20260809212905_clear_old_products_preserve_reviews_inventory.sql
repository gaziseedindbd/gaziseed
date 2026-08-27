-- Clear old product catalog and ads landing product/offer data
-- while preserving reviews, inventory_history, orders, and customers.

-- Step 0: Drop broken trigger on order_items (references non-existent updated_at column)
DROP TRIGGER IF EXISTS trg_updated_order_items ON order_items;

-- Step 1: Temporarily make reviews.product_id and inventory_history.product_id nullable
-- and drop the CASCADE FK constraints so deleting products won't cascade-delete them.
ALTER TABLE reviews DROP CONSTRAINT reviews_product_id_fkey;
ALTER TABLE inventory_history DROP CONSTRAINT inventory_history_product_id_fkey;
ALTER TABLE reviews ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE inventory_history ALTER COLUMN product_id DROP NOT NULL;

-- Step 2: Detach review and inventory_history rows from the old products
UPDATE reviews SET product_id = NULL WHERE product_id IS NOT NULL;
UPDATE inventory_history SET product_id = NULL WHERE product_id IS NOT NULL;

-- Step 3: Delete all product-related data (CASCADE handles child tables:
--   product_images, product_variants, product_faqs, product_batches,
--   bundle_offers, bulk_pricing, quantity_offers, promotion_gifts,
--   combo_items, wishlists, stock_notifications, landing_pages)
DELETE FROM products;

-- Step 4: Delete any remaining ads landing child data (landing_pages CASCADE-deleted
--   with products above, but clear child tables explicitly in case of orphans)
DELETE FROM landing_faqs;
DELETE FROM landing_reviews;
DELETE FROM landing_page_views;

-- Step 5: Restore FK constraints (nullable now, SET NULL on delete so future
--   product deletions also preserve reviews and inventory history)
ALTER TABLE reviews
  ADD CONSTRAINT reviews_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id)
  ON DELETE SET NULL;

ALTER TABLE inventory_history
  ADD CONSTRAINT inventory_history_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id)
  ON DELETE SET NULL;
