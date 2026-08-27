/*
# Create the product-images storage bucket

## Summary
The storage policies for the `product-images` bucket were created in an
earlier migration, but the bucket itself was never created. This meant
every upload attempt (local file or URL import) failed with a
"bucket not found" error.

## Changes
1. Creates the `product-images` storage bucket as a public bucket
   (public read, authenticated write/delete — policies already exist).
2. Inserts a default row into `site_settings` (id=1) so that the
   watermark settings lookup in image-processing.ts resolves cleanly
   instead of getting null. Uses safe defaults matching the app's
   defaults: watermark enabled, logo at /seed-bari-logo.webp, opacity
   0.25, size 0.3, position center.

## Security
- No existing data is modified or deleted.
- The bucket is public (anyone can read), which matches the existing
  SELECT policy that allows anon+authenticated reads.
- Writes are still gated by the existing INSERT policy (authenticated only).
- The site_settings insert is idempotent (ON CONFLICT DO NOTHING).
*/

-- 1. Create the product-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760,  -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure a default site_settings row exists so watermark lookups don't return null
INSERT INTO site_settings (id, watermark_enabled, watermark_logo_url, watermark_opacity, watermark_size, watermark_position)
VALUES (1, true, '/seed-bari-logo.webp', 0.25, 0.3, 'center')
ON CONFLICT (id) DO NOTHING;
