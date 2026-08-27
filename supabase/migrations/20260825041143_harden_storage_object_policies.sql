-- Harden Storage object access without changing existing bucket visibility or existing files.
-- Current storefront assets remain publicly readable; only active admins may mutate storage.

DROP POLICY IF EXISTS "Allow Authenticated and Anon Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Enable Upload and View 1ifhysk_1" ON storage.objects;
DROP POLICY IF EXISTS "Public Access 16wiy3a_1" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Deletes" ON storage.objects;
DROP POLICY IF EXISTS "Enable Upload and View 1ifhysk_3" ON storage.objects;
DROP POLICY IF EXISTS "Public Access 16wiy3a_3" ON storage.objects;
DROP POLICY IF EXISTS "Enable Upload and View 1ifhysk_0" ON storage.objects;
DROP POLICY IF EXISTS "Public Access 16wiy3a_0" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Updates" ON storage.objects;
DROP POLICY IF EXISTS "Enable Upload and View 1ifhysk_2" ON storage.objects;
DROP POLICY IF EXISTS "Public Access 16wiy3a_2" ON storage.objects;

CREATE POLICY "Storage public storefront read"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id IN ('product-images', 'products')
  OR public.is_admin()
);

CREATE POLICY "Storage admins can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
);

CREATE POLICY "Storage admins can update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);

CREATE POLICY "Storage admins can delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  public.is_admin()
);

UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
WHERE id = 'product-images';

UPDATE storage.buckets
SET file_size_limit = 15 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
WHERE id = 'products';