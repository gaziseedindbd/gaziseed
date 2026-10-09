-- Allow public visitors to read only active animated landing pages and
-- packages for the branch sent in the x-gazi-country request header.
CREATE POLICY animated_landing_pages_public_active_select
  ON public.animated_landing_pages
  FOR SELECT
  TO anon
  USING (
    status = 'active'
    AND upper(country_code) = public.current_visitor_country()
  );

CREATE POLICY animated_landing_packages_public_active_select
  ON public.animated_landing_packages
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND upper(country_code) = public.current_visitor_country()
    AND EXISTS (
      SELECT 1
      FROM public.animated_landing_pages AS landing
      WHERE landing.id = animated_landing_packages.landing_page_id
        AND landing.status = 'active'
        AND upper(landing.country_code) = upper(animated_landing_packages.country_code)
    )
  );
