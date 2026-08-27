-- ============ HOMEPAGE THEME SETTING ============
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS homepage_theme text DEFAULT 'theme1';

-- ============ PROMOTIONAL POPUPS TABLE ============
CREATE TABLE IF NOT EXISTS promotional_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text DEFAULT '',
  description text DEFAULT '',
  image text DEFAULT '',
  offer text DEFAULT '',
  cta_text text DEFAULT '',
  cta_link text DEFAULT '',
  start_date timestamptz DEFAULT now(),
  end_date timestamptz DEFAULT NULL,
  is_active boolean DEFAULT false,
  show_on_main boolean DEFAULT true,
  show_on_offers boolean DEFAULT false,
  show_close_button boolean DEFAULT true,
  auto_close boolean DEFAULT false,
  auto_close_seconds int DEFAULT 10,
  display_frequency text DEFAULT 'every_visit',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE promotional_popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_popups" ON promotional_popups FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "admin_write_popups" ON promotional_popups FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ ADMIN NOTIFICATIONS TABLE ============
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  link text DEFAULT '',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_notifications" ON admin_notifications FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ DB TRIGGERS FOR NOTIFICATIONS ============
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, link)
  VALUES ('order', 'New Order: ' || NEW.order_number, '/admin/orders?number=' || NEW.order_number);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_new_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, link)
  VALUES ('review', 'New Review from ' || NEW.customer_name, '/admin/reviews');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_new_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, link)
  VALUES ('contact', 'New Contact Message from ' || NEW.name, '/admin/messages');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_new_support()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, link)
  VALUES ('support', 'New Support Ticket: ' || NEW.ticket_id, '/admin/support');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order ON orders;
CREATE TRIGGER trg_notify_order AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_new_order();

DROP TRIGGER IF EXISTS trg_notify_review ON reviews;
CREATE TRIGGER trg_notify_review AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION notify_new_review();

DROP TRIGGER IF EXISTS trg_notify_contact ON contact_messages;
CREATE TRIGGER trg_notify_contact AFTER INSERT ON contact_messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_contact();

DROP TRIGGER IF EXISTS trg_notify_support ON support_tickets;
CREATE TRIGGER trg_notify_support AFTER INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION notify_new_support();
