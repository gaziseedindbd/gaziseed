-- Public storefronts may read only active Ads landing pages for the visitor's selected country.
-- Draft/paused rows remain hidden, while authenticated admin branch policies are unchanged.
GRANT SELECT ON TABLE public.landing_pages TO anon;

DROP POLICY IF EXISTS landing_pages_public_active_read ON public.landing_pages;

CREATE POLICY landing_pages_public_active_read
ON public.landing_pages
FOR SELECT
TO anon
USING (
  lower(btrim(coalesce(status, ''))) = 'active'
  AND upper(country_code) = upper(public.current_visitor_country())
);
