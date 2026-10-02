-- Remove overlapping permissive RLS policies while preserving access semantics.
--
-- The affected tables used an authenticated ALL policy plus a separate
-- authenticated SELECT policy. PostgreSQL therefore evaluates both policies
-- for reads and Supabase Performance Advisor reports multiple permissive
-- policies. Split the admin ALL policy into INSERT/UPDATE/DELETE policies;
-- the existing consolidated SELECT policy remains the sole authenticated
-- read policy.
--
-- Four public-read policies also explicitly included authenticated. Their
-- authenticated access is already covered by rls_consolidated_select, so
-- limit those policies to anon to remove the duplicate authenticated branch.

DO $$
BEGIN
  -- banners
  DROP POLICY IF EXISTS banners_admin_branch_all ON public.banners;
  CREATE POLICY banners_admin_branch_insert ON public.banners
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY banners_admin_branch_update ON public.banners
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY banners_admin_branch_delete ON public.banners
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- blog_posts
  DROP POLICY IF EXISTS blog_posts_admin_branch_all ON public.blog_posts;
  CREATE POLICY blog_posts_admin_branch_insert ON public.blog_posts
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY blog_posts_admin_branch_update ON public.blog_posts
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY blog_posts_admin_branch_delete ON public.blog_posts
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- bulk_pricing
  DROP POLICY IF EXISTS bulk_pricing_admin_branch_all ON public.bulk_pricing;
  CREATE POLICY bulk_pricing_admin_branch_insert ON public.bulk_pricing
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = bulk_pricing.product_id
          AND can_access_country(p.country_code)
      )
    );
  CREATE POLICY bulk_pricing_admin_branch_update ON public.bulk_pricing
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = bulk_pricing.product_id
          AND can_access_country(p.country_code)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = bulk_pricing.product_id
          AND can_access_country(p.country_code)
      )
    );
  CREATE POLICY bulk_pricing_admin_branch_delete ON public.bulk_pricing
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = bulk_pricing.product_id
          AND can_access_country(p.country_code)
      )
    );

  -- categories
  DROP POLICY IF EXISTS categories_admin_branch_all ON public.categories;
  CREATE POLICY categories_admin_branch_insert ON public.categories
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY categories_admin_branch_update ON public.categories
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY categories_admin_branch_delete ON public.categories
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- delivery_settings
  DROP POLICY IF EXISTS delivery_settings_admin_branch_all ON public.delivery_settings;
  CREATE POLICY delivery_settings_admin_branch_insert ON public.delivery_settings
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY delivery_settings_admin_branch_update ON public.delivery_settings
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY delivery_settings_admin_branch_delete ON public.delivery_settings
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- delivery_zones
  DROP POLICY IF EXISTS delivery_zones_admin_branch_all ON public.delivery_zones;
  CREATE POLICY delivery_zones_admin_branch_insert ON public.delivery_zones
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY delivery_zones_admin_branch_update ON public.delivery_zones
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY delivery_zones_admin_branch_delete ON public.delivery_zones
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- homepage_sections
  DROP POLICY IF EXISTS homepage_sections_admin_branch_all ON public.homepage_sections;
  CREATE POLICY homepage_sections_admin_branch_insert ON public.homepage_sections
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY homepage_sections_admin_branch_update ON public.homepage_sections
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY homepage_sections_admin_branch_delete ON public.homepage_sections
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- pages
  DROP POLICY IF EXISTS pages_admin_branch_all ON public.pages;
  CREATE POLICY pages_admin_branch_insert ON public.pages
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY pages_admin_branch_update ON public.pages
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY pages_admin_branch_delete ON public.pages
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- product_faqs
  DROP POLICY IF EXISTS product_faqs_admin_branch_all ON public.product_faqs;
  CREATE POLICY product_faqs_admin_branch_insert ON public.product_faqs
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_faqs.product_id
          AND can_access_country(p.country_code)
      )
    );
  CREATE POLICY product_faqs_admin_branch_update ON public.product_faqs
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_faqs.product_id
          AND can_access_country(p.country_code)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_faqs.product_id
          AND can_access_country(p.country_code)
      )
    );
  CREATE POLICY product_faqs_admin_branch_delete ON public.product_faqs
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_faqs.product_id
          AND can_access_country(p.country_code)
      )
    );

  -- product_images
  DROP POLICY IF EXISTS product_images_admin_branch_all ON public.product_images;
  CREATE POLICY product_images_admin_branch_insert ON public.product_images
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_images.product_id
          AND can_access_country(p.country_code)
      )
    );
  CREATE POLICY product_images_admin_branch_update ON public.product_images
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_images.product_id
          AND can_access_country(p.country_code)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_images.product_id
          AND can_access_country(p.country_code)
      )
    );
  CREATE POLICY product_images_admin_branch_delete ON public.product_images
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_images.product_id
          AND can_access_country(p.country_code)
      )
    );

  -- product_variants
  DROP POLICY IF EXISTS product_variants_admin_branch_all ON public.product_variants;
  CREATE POLICY product_variants_admin_branch_insert ON public.product_variants
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_variants.product_id
          AND can_access_country(p.country_code)
      )
    );
  CREATE POLICY product_variants_admin_branch_update ON public.product_variants
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_variants.product_id
          AND can_access_country(p.country_code)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_variants.product_id
          AND can_access_country(p.country_code)
      )
    );
  CREATE POLICY product_variants_admin_branch_delete ON public.product_variants
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_variants.product_id
          AND can_access_country(p.country_code)
      )
    );

  -- products
  DROP POLICY IF EXISTS products_admin_branch_all ON public.products;
  CREATE POLICY products_admin_branch_insert ON public.products
    FOR INSERT TO authenticated
    WITH CHECK (
      can_access_country(country_code)
      AND (
        category_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.categories c
          WHERE c.id = products.category_id
            AND can_access_country(c.country_code)
        )
      )
    );
  CREATE POLICY products_admin_branch_update ON public.products
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (
      can_access_country(country_code)
      AND (
        category_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.categories c
          WHERE c.id = products.category_id
            AND can_access_country(c.country_code)
        )
      )
    );
  CREATE POLICY products_admin_branch_delete ON public.products
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- promotion_gifts
  DROP POLICY IF EXISTS promotion_gifts_admin_branch_all ON public.promotion_gifts;
  CREATE POLICY promotion_gifts_admin_branch_insert ON public.promotion_gifts
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY promotion_gifts_admin_branch_update ON public.promotion_gifts
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY promotion_gifts_admin_branch_delete ON public.promotion_gifts
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- promotional_popups
  DROP POLICY IF EXISTS promotional_popups_admin_branch_all ON public.promotional_popups;
  CREATE POLICY promotional_popups_admin_branch_insert ON public.promotional_popups
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY promotional_popups_admin_branch_update ON public.promotional_popups
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY promotional_popups_admin_branch_delete ON public.promotional_popups
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- promotions
  DROP POLICY IF EXISTS promotions_admin_branch_all ON public.promotions;
  CREATE POLICY promotions_admin_branch_insert ON public.promotions
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY promotions_admin_branch_update ON public.promotions
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY promotions_admin_branch_delete ON public.promotions
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- referral_settings
  DROP POLICY IF EXISTS referral_settings_admin_branch_all ON public.referral_settings;
  CREATE POLICY referral_settings_admin_branch_insert ON public.referral_settings
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY referral_settings_admin_branch_update ON public.referral_settings
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY referral_settings_admin_branch_delete ON public.referral_settings
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- services
  DROP POLICY IF EXISTS services_admin_branch_all ON public.services;
  CREATE POLICY services_admin_branch_insert ON public.services
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY services_admin_branch_update ON public.services
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY services_admin_branch_delete ON public.services
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- site_settings
  DROP POLICY IF EXISTS site_settings_admin_branch_all ON public.site_settings;
  CREATE POLICY site_settings_admin_branch_insert ON public.site_settings
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY site_settings_admin_branch_update ON public.site_settings
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY site_settings_admin_branch_delete ON public.site_settings
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));

  -- videos
  DROP POLICY IF EXISTS videos_admin_branch_all ON public.videos;
  CREATE POLICY videos_admin_branch_insert ON public.videos
    FOR INSERT TO authenticated
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY videos_admin_branch_update ON public.videos
    FOR UPDATE TO authenticated
    USING (can_access_country(country_code))
    WITH CHECK (can_access_country(country_code));
  CREATE POLICY videos_admin_branch_delete ON public.videos
    FOR DELETE TO authenticated
    USING (can_access_country(country_code));
END
$$;

-- These public-read policies are only needed for anonymous users. The
-- authenticated role is already covered by the consolidated policy.
ALTER POLICY delivery_zones_public_read
  ON public.delivery_zones TO anon;
ALTER POLICY promotion_gifts_public_read
  ON public.promotion_gifts TO anon;
ALTER POLICY promotional_popups_public_read
  ON public.promotional_popups TO anon;
ALTER POLICY promotions_public_read
  ON public.promotions TO anon;
