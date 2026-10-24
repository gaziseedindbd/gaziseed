import { cache } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import type { SeoCountry } from '@/lib/seo-metadata';

type ProductCountry = 'BD' | 'IN';

/**
 * Resolve old, unlocalized /product/:slug URLs to the product's country route.
 * If a slug exists in both storefronts, keep the visitor's selected/detected
 * storefront; otherwise fall back to the only storefront that owns the slug.
 */
export const resolveLegacyProductRoute = cache(async (
  slug: string,
  preferredCountry: SeoCountry,
): Promise<{ country: ProductCountry; ambiguous: boolean } | null> => {
  const lookup = async (country: ProductCountry) => {
    const supabase = await createServerSupabase(country);
    const { data, error } = await supabase
      .from('products')
      .select('country_code')
      .eq('slug', slug)
      .eq('country_code', country)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data ? country : null;
  };

  const [bdCountry, inCountry] = await Promise.all([lookup('BD'), lookup('IN')]);
  const availableCountries = [bdCountry, inCountry].filter(
    (country): country is ProductCountry => Boolean(country),
  );

  if (availableCountries.length === 0) return null;

  const country = availableCountries.includes(preferredCountry)
    ? preferredCountry
    : availableCountries[0];

  return { country, ambiguous: availableCountries.length > 1 };
});
