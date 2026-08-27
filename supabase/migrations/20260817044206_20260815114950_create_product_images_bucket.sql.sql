INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 'product-images', true, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO site_settings (id, watermark_enabled, watermark_logo_url, watermark_opacity, watermark_size, watermark_position)
VALUES (1, true, '/seed-bari-logo.webp', 0.25, 0.3, 'center')
ON CONFLICT (id) DO NOTHING;