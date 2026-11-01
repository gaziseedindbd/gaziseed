import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { getSeoCountry } from '@/lib/seo-metadata';
import { resolveLegacyProductRoute } from '@/lib/legacy-product-route';

const LEGACY_PRODUCT_REDIRECTS: Record<string, string> = {
  'naga-bombay-chili-seeds': '/in/product/high-yield-naga-bombay-chilli-seeds-1g',
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const legacyDestination = LEGACY_PRODUCT_REDIRECTS[slug.toLowerCase()];
  if (legacyDestination) permanentRedirect(legacyDestination);

  const preferredCountry = await getSeoCountry();
  const productRoute = await resolveLegacyProductRoute(slug, preferredCountry);

  if (!productRoute) notFound();

  const destination = `/${productRoute.country.toLowerCase()}/product/${encodeURIComponent(slug)}`;
  if (productRoute.ambiguous) redirect(destination);
  permanentRedirect(destination);
}
