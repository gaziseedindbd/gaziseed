alter table public.products
  add column if not exists promotional_offer_badge_hi text,
  add column if not exists promotional_offer_title_hi text,
  add column if not exists promotional_offer_description_hi text,
  add column if not exists promotional_offer_benefits_hi jsonb not null default '[]'::jsonb,
  add column if not exists promotional_offer_image_en text,
  add column if not exists promotional_offer_image_hi text,
  add column if not exists promotional_offer_cta_text_hi text,
  add column if not exists promotional_offer_note_hi text;

alter table public.products
  drop constraint if exists products_promotional_offer_benefits_hi_array_check;

alter table public.products
  add constraint products_promotional_offer_benefits_hi_array_check
  check (jsonb_typeof(promotional_offer_benefits_hi) = 'array');