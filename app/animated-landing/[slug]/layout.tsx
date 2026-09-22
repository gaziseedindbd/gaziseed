import type { Metadata } from 'next';
import { getServerRow, getServerProductById, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getServerRow('animated_landing_pages', 'slug', slug);
  if (!landing || landing.status !== 'active') return {};

  const product = landing.product_id ? await getServerProductById(landing.product_id) : null;
  const title = landing.hero_title || landing.landing_name || product?.name_bn || product?.name_en || 'GAZI SEED Product Offer';
  const description = landing.hero_subtitle || product?.short_description || product?.description || 'GAZI SEED — বীজ ও কৃষি পণ্যের বিশেষ অফার।';
  const image = landing.hero_image || product?.image || product?.images?.[0] || null;

  return pageMetadata({
    title: `${title} | GAZI SEED`,
    description: description.slice(0, 160),
    image,
    path: `/animated-landing/${slug}`,
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
  const landing = await getServerRow('animated_landing_pages', 'slug', slug);

  if (!landing || landing.status !== 'active') return <>{children}</>;

  const product = landing.product_id ? await getServerProductById(landing.product_id) : null;
  const title = landing.hero_title || landing.landing_name || product?.name_bn || product?.name_en || 'GAZI SEED Product Offer';
  const description = (landing.hero_subtitle || product?.short_description || product?.description || title).slice(0, 500);
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
      priceCurrency: 'BDT',
      price: price > 0 ? price.toFixed(2) : undefined,
      availability: Number(product?.stock || 0) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'GAZI SEED', url: SITE_URL },
    },
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
