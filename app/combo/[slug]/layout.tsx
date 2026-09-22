import type { Metadata } from 'next';
import { getServerRow, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

function firstImage(combo: any): string | null {
  const values = [
    ...(Array.isArray(combo?.images) ? combo.images : []),
    combo?.image_url,
    combo?.featured_image,
    combo?.image,
  ];
  return values.find((v) => typeof v === 'string' && v.trim() && !v.includes('placehold.co'))?.trim() || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const combo = await getServerRow('combo_packs', 'slug', slug);
  const title = combo?.title_bn || combo?.title_en || 'Combo Offer';
  const description = combo?.description_bn || combo?.description_en || `${title} — GAZI SEED`;
  const ogImage = `${SITE_URL}/api/og/combo/${encodeURIComponent(slug)}?v=3`;

  return pageMetadata({
    title: `${title} | GAZI SEED`,
    description,
    image: ogImage,
    path: `/combo/${slug}`,
  });
}

export default async function ComboSlugLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const { slug } = await params;
  const combo = await getServerRow('combo_packs', 'slug', slug);

  if (!combo) return <>{children}</>;

  const name = combo.title_bn || combo.title_en || 'GAZI SEED Combo';
  const description = (combo.description_bn || combo.description_en || `${name} — GAZI SEED`).slice(0, 500);
  const image = firstImage(combo);
  const url = `${SITE_URL}/combo/${encodeURIComponent(slug)}`;

  const tiers = Array.isArray(combo.tier_pricing) ? combo.tier_pricing : [];
  const firstTier = tiers[0] || {};
  const price = Number(firstTier.offer ?? combo.combo_price ?? 0);
  const regular = Number(firstTier.regular ?? combo.regular_total ?? 0);
  const availability = combo.is_active === false
    ? 'https://schema.org/OutOfStock'
    : 'https://schema.org/InStock';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: image ? [image] : undefined,
    url,
    brand: { '@type': 'Brand', name: 'GAZI SEED' },
    category: 'Seed Combo',
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'BDT',
      price: price > 0 ? price.toFixed(2) : undefined,
      ...(regular > price && price > 0 ? { priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) } : {}),
      availability,
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'GAZI SEED',
        url: SITE_URL,
      },
    },
    ...(tiers.length ? {
      additionalProperty: [{
        '@type': 'PropertyValue',
        name: 'Available pack options',
        value: tiers.map((tier: any) => String(tier?.qty ?? tier?.quantity ?? 1)).join(', '),
      }],
    } : {}),
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
