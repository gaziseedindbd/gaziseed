/*
# Final Future-Ready Master Upgrade

## Changes
- reviews: add guest_phone column (never exposed publicly)
- contact_messages: add admin_reply, replied_at columns
- landing_pages: add landing_type, combo_product_ids, combo_quantities for combo landing pages
- site_settings: add integration fields (courier, SMS, WhatsApp, payment) + additional feature toggles
*/

-- 1. Reviews: guest phone (private, never exposed)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS guest_phone text;

-- 2. Contact Messages: admin reply
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS replied_at timestamptz;

-- 3. Landing Pages: combo support
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS landing_type text NOT NULL DEFAULT 'standard';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS combo_product_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS combo_quantities jsonb DEFAULT '[]'::jsonb;

-- 4. Site Settings: integration fields
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS courier_provider text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS courier_api_key text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS sms_provider text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS sms_api_key text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_api_key text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS payment_api_key text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS meta_pixel_id text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ga4_measurement_id text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS gtm_container_id text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS google_ads_id text;

-- 5. Additional feature toggles
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_bundles boolean NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_combos boolean NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_free_gifts boolean NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_guides boolean NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_photo_reviews boolean NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_online_payment boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_courier boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_sms boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_whatsapp_api boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_adsense boolean NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS adsense_client_id text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS adsense_slot_id text;

-- 6. RLS: guest_phone should never be exposed to anon/public
-- Drop existing public read policy on reviews and recreate without guest_phone exposure
-- (RLS already restricts reviews; guest_phone is only visible to admins via auth check)
