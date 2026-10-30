
-- Reusable India parcel profiles for repeated seed orders. Profiles are managed
-- only by the India-admin Edge Function; no public or authenticated table access.
CREATE TABLE IF NOT EXISTS public.india_shipping_package_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'IN' CHECK (country_code = 'IN'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  package_type text NOT NULL DEFAULT 'mailer'
    CHECK (package_type IN ('mailer', 'box', 'custom')),
  weight_kg numeric(9,3) NOT NULL CHECK (weight_kg BETWEEN 0.01 AND 100),
  length_cm numeric(9,2) NOT NULL CHECK (length_cm BETWEEN 1 AND 200),
  breadth_cm numeric(9,2) NOT NULL CHECK (breadth_cm BETWEEN 1 AND 200),
  height_cm numeric(9,2) NOT NULL CHECK (height_cm BETWEEN 1 AND 200),
  product_keywords text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(product_keywords) <= 12),
  min_item_count integer NOT NULL DEFAULT 1 CHECK (min_item_count BETWEEN 1 AND 1000),
  max_item_count integer CHECK (max_item_count BETWEEN 1 AND 1000),
  fragile boolean NOT NULL DEFAULT false,
  packing_notes text NOT NULL DEFAULT '' CHECK (length(packing_notes) <= 500),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT india_shipping_package_profiles_item_range_check
    CHECK (max_item_count IS NULL OR max_item_count >= min_item_count)
);

CREATE UNIQUE INDEX IF NOT EXISTS india_shipping_package_profiles_name_unique
  ON public.india_shipping_package_profiles (country_code, lower(name))
  WHERE is_active;

ALTER TABLE public.india_shipping_package_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.india_shipping_package_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.india_shipping_package_profiles TO service_role;

ALTER TABLE public.india_shipping_preparations
  ADD COLUMN IF NOT EXISTS package_profile_id uuid
    REFERENCES public.india_shipping_package_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fragile_shipment boolean NOT NULL DEFAULT false;

COMMENT ON TABLE public.india_shipping_package_profiles IS
  'Reusable parcel dimensions and handling profiles for India Delhivery shipments; accessed through India-admin Edge Functions only.';
COMMENT ON COLUMN public.india_shipping_preparations.package_profile_id IS
  'Optional reusable package profile applied to this saved parcel draft.';
