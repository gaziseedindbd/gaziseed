-- Add watermark configuration columns to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS watermark_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS watermark_logo_url text NOT NULL DEFAULT '/seed-bari-logo.webp';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS watermark_opacity real NOT NULL DEFAULT 0.25;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS watermark_size real NOT NULL DEFAULT 0.3;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS watermark_position text NOT NULL DEFAULT 'center';
