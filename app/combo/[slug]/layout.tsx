import type { Metadata } from 'next';
import { getSeoCountry, getServerRow, localizedSeoText, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

function firstImage(combo: any): string | null {
  const values = [
    ...(Array.isArray(combo?.images) ? combo.images : []),
    combo?.og_image,
    combo?.image_url,
    combo?.featured_image,
    combo?.image,
  ];
  return values.find((value) => typeof value === 'string' && value.trim() && !value.includes('placehold.co'))?.trim() || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const combo = await getServerRow('combo_packs', 'slug', slug, country);
  if (!combo || combo.is_active === false) {
    return {
      title: 'Combo unavailable | GAZI SEED',
      robots: { index: false, follow: true },
      alternates: { canonical: `/combo/${encodeURIComponent(slug)}` },
    };
  }

  const fallbackTitle = country === 'IN' ? combo.name_en || combo.name_bn : combo.name_bn || combo.name_en;
  const title = localizedSeoText(combo.seo_title, country, fallbackTitle || 'GAZI SEED Combo');
  const fallbackDescription = country === 'IN' ? combo.description_en || combo.description_bn : combo.description_bn || combo.description_en;
  const description = localizedSeoText(combo.meta_description || fallbackDescription, country, title);

  return pageMetadata({
    title,
    description,
    image: firstImage(combo) || `${SITE_URL}/api/og/combo/${encodeURIComponent(slug)}?v=3`,
    path: `/combo/${encodeURIComponent(slug)}`,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
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
  const country = await getSeoCountry();
  const combo = await getServerRow('combo_packs', 'slug', slug, country);
  if (!combo || combo.is_active === false) return <>{children}</>;

  const name = country === 'IN' ? combo.name_en || combo.name_bn : combo.name_bn || combo.name_en;
  const description = localizedSeoText(
    combo.meta_description || (country === 'IN' ? combo.description_en || combo.description_bn : combo.description_bn || combo.description_en),
    country,
    name || 'GAZI SEED Combo',
  ).slice(0, 500);
  const image = firstImage(combo);
  const url = `${SITE_URL}/combo/${encodeURIComponent(slug)}`;
  const price = Number(combo.combo_price || 0);
  const regular = Number(combo.regular_total || 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: name || 'GAZI SEED Combo',
    description,
    image: image ? [image] : undefined,
    url,
    brand: { '@type': 'Brand', name: 'GAZI SEED' },
    category: 'Seed Combo',
    inLanguage: country === 'IN' ? 'en-IN' : 'bn-BD',
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: country === 'IN' ? 'INR' : 'BDT',
      price: price > 0 ? price.toFixed(2) : undefined,
      ...(regular > price && price > 0 ? { priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) } : {}),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'GAZI SEED', url: SITE_URL },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
