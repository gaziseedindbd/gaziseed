alter table public.bulk_pricing
  add column if not exists free_item_text text;
