-- Disable the stale homepage banner only when both referenced Storage objects are missing.
update public.banners b
set is_active = false,
    updated_at = now()
where b.id = 'f7d95aca-9ea5-4f71-b921-9d6bde62aebb'
  and b.is_active = true
  and not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'product-images'
      and o.name = regexp_replace(b.desktop_image, '.*/product-images/', '')
  )
  and not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'product-images'
      and o.name = regexp_replace(b.mobile_image, '.*/product-images/', '')
  );
