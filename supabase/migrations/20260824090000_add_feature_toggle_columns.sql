alter table public.site_settings
  add column if not exists enable_bundles boolean not null default false,
  add column if not exists enable_combos boolean not null default false,
  add column if not exists enable_free_gifts boolean not null default false,
  add column if not exists enable_guides boolean not null default false,
  add column if not exists enable_photo_reviews boolean not null default false,
  add column if not exists enable_online_payment boolean not null default false,
  add column if not exists enable_courier boolean not null default false,
  add column if not exists enable_sms boolean not null default false,
  add column if not exists enable_whatsapp_api boolean not null default false,
  add column if not exists enable_adsense boolean not null default false;
