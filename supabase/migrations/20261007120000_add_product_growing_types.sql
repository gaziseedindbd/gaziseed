-- Keep the legacy single-value growing_type column for backward compatibility.
-- Add the normalized multi-value field used by the admin product form.

alter table public.products
  add column if not exists growing_types text[];

update public.products
set growing_types = array[growing_type]
where growing_types is null
  and growing_type is not null
  and btrim(growing_type) <> '';
