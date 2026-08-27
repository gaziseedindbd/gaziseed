/*
# GAZI SEED - RLS Policies & Secure Order Functions

1. Public read policies for storefront tables (anon + authenticated)
2. Admin write policies (is_admin() check) for management tables
3. Customer self-service policies for own orders, addresses, reviews
4. SECURITY DEFINER function create_order() — server-side price calculation
   - Accepts items + bundle references, NOT prices
   - Server looks up product/bundle prices from database
   - Calculates subtotal, delivery charge, grand total
   - Prevents price manipulation from frontend
5. generate_order_number() helper

Security notes:
- Prices are NEVER trusted from the frontend
- create_order() retrieves all prices server-side
- Admin actions require is_admin() which checks admin_users table
- Customers can only see/modify their own orders and addresses
*/

-- ============ GENERATE ORDER NUMBER ============
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
  seq_val bigint;
  seq_text text;
BEGIN
  -- Use a sequence-like approach with extract from timestamp
  seq_val := EXTRACT(EPOCH FROM now())::bigint;
  seq_text := lpad((seq_val % 1000000)::text, 6, '0');
  RETURN 'GS' || seq_text;
END;
$$ LANGUAGE plpgsql;

-- ============ CREATE ORDER (SECURITY DEFINER) ============
-- Server-side price calculation. Frontend sends product_id + quantity (+ optional bundle_id).
-- Server looks up actual prices from database. Never trusts frontend prices.
CREATE OR REPLACE FUNCTION create_order(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_zone_id uuid,
  p_special_instructions text DEFAULT '',
  p_order_source text DEFAULT 'website',
  p_user_id uuid DEFAULT NULL,
  p_customer_email text DEFAULT '',
  p_coupon_code text DEFAULT '',
  p_utm_source text DEFAULT '',
  p_utm_medium text DEFAULT '',
  p_utm_campaign text DEFAULT '',
  p_utm_content text DEFAULT '',
  p_utm_term text DEFAULT '',
  p_fbclid text DEFAULT '',
  p_gclid text DEFAULT '',
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_delivery_charge numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_grand_total numeric(10,2) := 0;
  v_zone record;
  v_item jsonb;
  v_product record;
  v_bundle record;
  v_unit_price numeric(10,2);
  v_total_price numeric(10,2);
  v_qty int;
  v_coupon record;
  v_order_status_id uuid;
  v_item_name text;
  v_item_image text;
  v_bundle_name text;
  v_delivery_zone_name text := '';
BEGIN
  -- Validate required fields
  IF p_customer_name = '' OR p_customer_phone = '' OR p_delivery_address = '' THEN
    RETURN jsonb_build_object('error', 'Missing required fields');
  END IF;

  -- Validate Bangladesh phone number (basic)
  IF NOT p_customer_phone ~ '^01[0-9]{9}$' THEN
    RETURN jsonb_build_object('error', 'Invalid phone number');
  END IF;

  -- Get delivery zone
  IF p_delivery_zone_id IS NOT NULL THEN
    SELECT * INTO v_zone FROM delivery_zones WHERE id = p_delivery_zone_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Invalid delivery zone');
    END IF;
    v_delivery_charge := v_zone.charge;
    v_delivery_zone_name := v_zone.zone_name;
  END IF;

  -- Generate order number
  v_order_number := generate_order_number();

  -- Insert order (subtotal/total will be updated after items)
  INSERT INTO orders (
    order_number, user_id, customer_name, customer_phone, customer_email,
    delivery_address, delivery_zone_id, delivery_zone_name, delivery_charge,
    special_instructions, subtotal, discount, grand_total,
    payment_method, order_source, coupon_code,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid,
    status
  ) VALUES (
    v_order_number, p_user_id, p_customer_name, p_customer_phone, p_customer_email,
    p_delivery_address, p_delivery_zone_id, v_delivery_zone_name, 0,
    p_special_instructions, 0, 0, 0,
    'cod', p_order_source, p_coupon_code,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_fbclid, p_gclid,
    'pending'
  ) RETURNING id INTO v_order_id;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty < 1 THEN
      v_qty := 1;
    END IF;

    -- Check if this is a bundle order
    IF (v_item->>'bundle_id') IS NOT NULL THEN
      SELECT * INTO v_bundle FROM bundle_offers WHERE id = (v_item->>'bundle_id')::uuid AND is_active = true;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Invalid bundle: ' || (v_item->>'bundle_id'));
      END IF;

      -- Get product for name/image
      SELECT name_bn, image INTO v_item_name, v_item_image FROM products WHERE id = v_bundle.product_id;

      v_unit_price := v_bundle.bundle_price;
      v_total_price := v_bundle.bundle_price;
      v_bundle_name := v_bundle.bundle_name;

      -- If free delivery for this bundle, zero out delivery
      IF v_bundle.free_delivery THEN
        v_delivery_charge := 0;
      END IF;

      v_subtotal := v_subtotal + v_total_price;

      INSERT INTO order_items (
        order_id, product_id, product_name, quantity, unit_price, total_price,
        bundle_id, bundle_name, image
      ) VALUES (
        v_order_id, v_bundle.product_id, v_item_name, v_qty, v_unit_price, v_total_price,
        v_bundle.id, v_bundle_name, v_item_image
      );

      -- Deduct stock
      UPDATE products SET stock = GREATEST(0, stock - v_qty) WHERE id = v_bundle.product_id;
      INSERT INTO inventory_history (product_id, quantity_change, reason)
      VALUES (v_bundle.product_id, -v_qty, 'Order: ' || v_order_number);

    ELSE
      -- Normal product order
      SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid AND is_active = true;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Invalid product: ' || (v_item->>'product_id'));
      END IF;

      -- Server-side price: use sale_price if set and lower than regular, else regular_price
      IF v_product.sale_price IS NOT NULL AND v_product.sale_price > 0 AND v_product.sale_price < v_product.regular_price THEN
        v_unit_price := v_product.sale_price;
      ELSE
        v_unit_price := v_product.regular_price;
      END IF;

      v_total_price := v_unit_price * v_qty;
      v_subtotal := v_subtotal + v_total_price;
      v_item_name := COALESCE(NULLIF(v_product.name_bn, ''), v_product.name_en);
      v_item_image := v_product.image;

      INSERT INTO order_items (
        order_id, product_id, product_name, quantity, unit_price, total_price, image
      ) VALUES (
        v_order_id, v_product.id, v_item_name, v_qty, v_unit_price, v_total_price, v_item_image
      );

      -- Deduct stock
      UPDATE products SET stock = GREATEST(0, stock - v_qty) WHERE id = v_product.id;
      INSERT INTO inventory_history (product_id, quantity_change, reason)
      VALUES (v_product.id, -v_qty, 'Order: ' || v_order_number);
    END IF;
  END LOOP;

  -- Apply coupon if provided
  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT * INTO v_coupon FROM coupons WHERE code = p_coupon_code AND is_active = true
      AND (start_date IS NULL OR start_date <= now())
      AND (expiry_date IS NULL OR expiry_date >= now())
      AND (usage_limit IS NULL OR usage_count < usage_limit);

    IF FOUND THEN
      IF v_coupon.type = 'fixed' THEN
        v_discount := LEAST(v_coupon.value, v_subtotal);
      ELSIF v_coupon.type = 'percentage' THEN
        v_discount := v_subtotal * (v_coupon.value / 100.0);
        IF v_coupon.max_discount IS NOT NULL THEN
          v_discount := LEAST(v_discount, v_coupon.max_discount);
        END IF;
      END IF;

      -- Check min order
      IF v_subtotal < v_coupon.min_order THEN
        v_discount := 0;
      ELSE
        UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
      END IF;
    END IF;
  END IF;

  v_grand_total := v_subtotal - v_discount + v_delivery_charge;

  -- Update order totals
  UPDATE orders
  SET subtotal = v_subtotal, discount = v_discount, delivery_charge = v_delivery_charge, grand_total = v_grand_total
  WHERE id = v_order_id;

  -- Create initial status history
  INSERT INTO order_status_history (order_id, status, note)
  VALUES (v_order_id, 'pending', 'Order placed');

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'delivery_charge', v_delivery_charge,
    'grand_total', v_grand_total
  );
END;
$$;

-- ============ RLS POLICIES ============

-- CATEGORIES: public read, admin write
DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_categories" ON categories;
CREATE POLICY "admin_write_categories" ON categories FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- PRODUCTS: public read, admin write
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_products" ON products;
CREATE POLICY "admin_write_products" ON products FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- PRODUCT_IMAGES: public read, admin write
DROP POLICY IF EXISTS "public_read_product_images" ON product_images;
CREATE POLICY "public_read_product_images" ON product_images FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_product_images" ON product_images;
CREATE POLICY "admin_write_product_images" ON product_images FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- BUNDLE_OFFERS: public read, admin write
DROP POLICY IF EXISTS "public_read_bundles" ON bundle_offers;
CREATE POLICY "public_read_bundles" ON bundle_offers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_bundles" ON bundle_offers;
CREATE POLICY "admin_write_bundles" ON bundle_offers FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- LANDING_PAGES: public read, admin write
DROP POLICY IF EXISTS "public_read_landing_pages" ON landing_pages;
CREATE POLICY "public_read_landing_pages" ON landing_pages FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_landing_pages" ON landing_pages;
CREATE POLICY "admin_write_landing_pages" ON landing_pages FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- DELIVERY_ZONES: public read, admin write
DROP POLICY IF EXISTS "public_read_delivery_zones" ON delivery_zones;
CREATE POLICY "public_read_delivery_zones" ON delivery_zones FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_delivery_zones" ON delivery_zones;
CREATE POLICY "admin_write_delivery_zones" ON delivery_zones FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ORDERS: customers see own orders (by user_id OR phone), admin sees all
-- For guest orders (user_id is null), we allow SELECT by matching phone number via the create_order function only.
-- Public can INSERT (handled via create_order SECURITY DEFINER), but we also allow anon insert for the function context.
DROP POLICY IF EXISTS "read_own_orders" ON orders;
CREATE POLICY "read_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "admin_write_orders" ON orders;
CREATE POLICY "admin_write_orders" ON orders FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ORDER_ITEMS: read via order ownership, admin all
DROP POLICY IF EXISTS "read_own_order_items" ON order_items;
CREATE POLICY "read_own_order_items" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR is_admin()))
  );
DROP POLICY IF EXISTS "admin_write_order_items" ON order_items;
CREATE POLICY "admin_write_order_items" ON order_items FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ORDER_STATUS_HISTORY: admin only
DROP POLICY IF EXISTS "read_own_osh" ON order_status_history;
CREATE POLICY "read_own_osh" ON order_status_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND (orders.user_id = auth.uid() OR is_admin()))
  );
DROP POLICY IF EXISTS "admin_write_osh" ON order_status_history;
CREATE POLICY "admin_write_osh" ON order_status_history FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- INVENTORY_HISTORY: admin only
DROP POLICY IF EXISTS "admin_read_invhist" ON inventory_history;
CREATE POLICY "admin_read_invhist" ON inventory_history FOR SELECT
  TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_write_invhist" ON inventory_history;
CREATE POLICY "admin_write_invhist" ON inventory_history FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- CUSTOMER_ADDRESSES: owner only
DROP POLICY IF EXISTS "read_own_addresses" ON customer_addresses;
CREATE POLICY "read_own_addresses" ON customer_addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_addresses" ON customer_addresses;
CREATE POLICY "insert_own_addresses" ON customer_addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_addresses" ON customer_addresses;
CREATE POLICY "update_own_addresses" ON customer_addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_addresses" ON customer_addresses;
CREATE POLICY "delete_own_addresses" ON customer_addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- COUPONS: public read (to validate), admin write
DROP POLICY IF EXISTS "public_read_coupons" ON coupons;
CREATE POLICY "public_read_coupons" ON coupons FOR SELECT
  TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "admin_write_coupons" ON coupons;
CREATE POLICY "admin_write_coupons" ON coupons FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- REVIEWS: public read approved, authenticated insert, admin write all
DROP POLICY IF EXISTS "public_read_reviews" ON reviews;
CREATE POLICY "public_read_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (is_approved = true OR is_admin());
DROP POLICY IF EXISTS "auth_insert_reviews" ON reviews;
CREATE POLICY "auth_insert_reviews" ON reviews FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_write_reviews" ON reviews;
CREATE POLICY "admin_write_reviews" ON reviews FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- TESTIMONIALS: public read active, admin write
DROP POLICY IF EXISTS "public_read_testimonials" ON testimonials;
CREATE POLICY "public_read_testimonials" ON testimonials FOR SELECT
  TO anon, authenticated USING (is_active = true OR is_admin());
DROP POLICY IF EXISTS "admin_write_testimonials" ON testimonials;
CREATE POLICY "admin_write_testimonials" ON testimonials FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- SERVICES: public read, admin write
DROP POLICY IF EXISTS "public_read_services" ON services;
CREATE POLICY "public_read_services" ON services FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_services" ON services;
CREATE POLICY "admin_write_services" ON services FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- BANNERS: public read, admin write
DROP POLICY IF EXISTS "public_read_banners" ON banners;
CREATE POLICY "public_read_banners" ON banners FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_banners" ON banners;
CREATE POLICY "admin_write_banners" ON banners FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- BLOG_POSTS: public read published, admin write
DROP POLICY IF EXISTS "public_read_blog" ON blog_posts;
CREATE POLICY "public_read_blog" ON blog_posts FOR SELECT
  TO anon, authenticated USING (is_published = true OR is_admin());
DROP POLICY IF EXISTS "admin_write_blog" ON blog_posts;
CREATE POLICY "admin_write_blog" ON blog_posts FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- CONTACT_MESSAGES: admin read/write only (insert via function or anon)
DROP POLICY IF EXISTS "anon_insert_messages" ON contact_messages;
CREATE POLICY "anon_insert_messages" ON contact_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_messages" ON contact_messages;
CREATE POLICY "admin_read_messages" ON contact_messages FOR SELECT
  TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_write_messages" ON contact_messages;
CREATE POLICY "admin_write_messages" ON contact_messages FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- PAGES: public read published, admin write
DROP POLICY IF EXISTS "public_read_pages" ON pages;
CREATE POLICY "public_read_pages" ON pages FOR SELECT
  TO anon, authenticated USING (is_published = true OR is_admin());
DROP POLICY IF EXISTS "admin_write_pages" ON pages;
CREATE POLICY "admin_write_pages" ON pages FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- NAVIGATION: public read, admin write
DROP POLICY IF EXISTS "public_read_nav" ON navigation;
CREATE POLICY "public_read_nav" ON navigation FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_nav" ON navigation;
CREATE POLICY "admin_write_nav" ON navigation FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ANNOUNCEMENTS: public read active, admin write
DROP POLICY IF EXISTS "public_read_announcements" ON announcements;
CREATE POLICY "public_read_announcements" ON announcements FOR SELECT
  TO anon, authenticated USING (is_active = true OR is_admin());
DROP POLICY IF EXISTS "admin_write_announcements" ON announcements;
CREATE POLICY "admin_write_announcements" ON announcements FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- SITE_SETTINGS: public read, admin write
DROP POLICY IF EXISTS "public_read_settings" ON site_settings;
CREATE POLICY "public_read_settings" ON site_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_settings" ON site_settings;
CREATE POLICY "admin_write_settings" ON site_settings FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- MARKETING_SETTINGS: public read, admin write
DROP POLICY IF EXISTS "public_read_marketing" ON marketing_settings;
CREATE POLICY "public_read_marketing" ON marketing_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_marketing" ON marketing_settings;
CREATE POLICY "admin_write_marketing" ON marketing_settings FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- HOMEPAGE_SECTIONS: public read, admin write
DROP POLICY IF EXISTS "public_read_homepage" ON homepage_sections;
CREATE POLICY "public_read_homepage" ON homepage_sections FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_homepage" ON homepage_sections;
CREATE POLICY "admin_write_homepage" ON homepage_sections FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ADMIN_USERS: admin only
DROP POLICY IF EXISTS "admin_read_admin_users" ON admin_users;
CREATE POLICY "admin_read_admin_users" ON admin_users FOR SELECT
  TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_write_admin_users" ON admin_users;
CREATE POLICY "admin_write_admin_users" ON admin_users FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ GRANT EXECUTE ON FUNCTIONS ============
GRANT EXECUTE ON FUNCTION create_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_order_number TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO anon, authenticated;
