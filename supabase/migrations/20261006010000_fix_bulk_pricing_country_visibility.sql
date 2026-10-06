-- Public storefront visibility and uniqueness for country-aware bulk pricing.

create policy "bulk_pricing_public_country_select"
on public.bulk_pricing
for select
to anon, authenticated
using (
  is_active = true
  and country_code = current_visitor_country()
);

create unique index if not exists bulk_pricing_active_unique_tier
on public.bulk_pricing (
  product_id,
  coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  min_quantity,
  country_code
)
where is_active = true;
