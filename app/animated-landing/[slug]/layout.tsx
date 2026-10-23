import type { Metadata } from 'next';
import { getSeoCountry, getServerRow, getServerProductById, localizedSeoText, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const landing = await getServerRow('animated_landing_pages', 'slug', slug, country);
  if (!landing || landing.status !== 'active') return {};

  const product = landing.product_id ? await getServerProductById(landing.product_id, country) : null;
  const title = localizedSeoText(landing.seo_title || landing.hero_title_en || landing.hero_title, country, landing.landing_name || (country === 'IN' ? product?.name_en : product?.name_bn) || product?.name_en || product?.name_bn || 'GAZI SEED Product Offer');
  const description = localizedSeoText(landing.meta_description || landing.hero_subtitle_en || landing.hero_subtitle, country, product?.short_description || product?.description || 'GAZI SEED seed offer.');
  const image = landing.hero_image || product?.image || product?.images?.[0] || null;

  return pageMetadata({
    title: `${title} | GAZI SEED`,
    description: description.slice(0, 160),
    image,
    path: `/animated-landing/${slug}`,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default async function AnimatedLandingSlugLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const landing = await getServerRow('animated_landing_pages', 'slug', slug, country);

  if (!landing || landing.status !== 'active') return <>{children}</>;

  const product = landing.product_id ? await getServerProductById(landing.product_id, country) : null;
  const title = localizedSeoText(landing.seo_title || landing.hero_title_en || landing.hero_title, country, landing.landing_name || (country === 'IN' ? product?.name_en : product?.name_bn) || product?.name_en || product?.name_bn || 'GAZI SEED Product Offer');
  const description = localizedSeoText(landing.meta_description || landing.hero_subtitle_en || landing.hero_subtitle, country, product?.short_description || product?.description || title).slice(0, 500);
  const image = landing.hero_image || product?.image || product?.images?.[0] || undefined;
  const url = `${SITE_URL}/animated-landing/${encodeURIComponent(slug)}`;

  const regular = Number(product?.regular_price || product?.price || 0);
  const sale = Number(product?.sale_price || product?.offer_price || regular);
  const price = sale > 0 ? sale : regular;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description,
    image: image ? [image] : undefined,
    url,
    brand: { '@type': 'Brand', name: 'GAZI SEED' },
    ...(product?.sku ? { sku: product.sku } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: country === 'IN' ? 'INR' : 'BDT',
      price: price > 0 ? price.toFixed(2) : undefined,
      availability: Number(product?.stock || 0) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'GAZI SEED', url: SITE_URL },
    },
    inLanguage: country === 'IN' ? 'en-IN' : 'bn-BD',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
