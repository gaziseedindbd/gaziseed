-- Allow the public homepage to read only active banners for the visitor's country.
-- Admin write policies remain unchanged.
drop policy if exists "banners_public_country_select" on public.banners;

create policy "banners_public_country_select"
on public.banners
for select
to anon
using (
  is_active = true
  and country_code = current_visitor_country()
);