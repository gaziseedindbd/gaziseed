import type { Metadata } from 'next';
import { getSeoCountry, getServerRow, localizedSeoText, pageMetadata, serializeJsonLd, SITE_URL } from '@/lib/seo-metadata';

function categoryDescription(value: unknown, country: 'BD' | 'IN', name: string): string {
  const fallback = `Seeds and growing products in ${name} — GAZI SEED`;
  const localized = localizedSeoText(value, country, fallback);
  // India category pages are presented in English; don't label Bengali or Hindi as en-IN.
  if (country === 'IN') {
    const hasIndicScript = Array.from(localized).some((character) => {
      const codePoint = character.codePointAt(0) || 0;
      return codePoint >= 0x0900 && codePoint <= 0x09ff;
    });
    if (hasIndicScript) return fallback;
  }
  return localized;
}

function absoluteCategoryImage(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.startsWith('https://') || normalized.startsWith('http://')) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country = slug.endsWith('-in') || slug.endsWith('-india') ? 'IN' : slug.endsWith('-bd') ? 'BD' : await getSeoCountry();
  const category = await getServerRow('categories', 'slug', slug, country);
  const title = country === 'IN' ? category?.name_en || category?.name_bn || slug.replace(/-/g, ' ') : category?.name_bn || category?.name_en || slug.replace(/-/g, ' ');
  const description = categoryDescription(category?.meta_description || category?.description, country, title);
  const image = category?.banner || category?.image || null;
  const metadata = pageMetadata({ title: title + ' | GAZI SEED', description, image, path: '/category/' + slug, locale: country === 'IN' ? 'en_IN' : 'bn_BD' });

  const counterpartSlug = country === 'IN'
    ? slug.replace(/-(?:in|india)$/i, '-bd')
    : slug.replace(/-bd$/i, '-in');
  const counterpartCountry = country === 'IN' ? 'BD' : 'IN';
  const counterpart = counterpartSlug !== slug
    ? await getServerRow('categories', 'slug', counterpartSlug, counterpartCountry)
    : null;

  if (!category || !counterpart || counterpart.is_active === false) return metadata;
  const currentUrl = SITE_URL + '/category/' + encodeURIComponent(slug);
  const counterpartUrl = SITE_URL + '/category/' + encodeURIComponent(counterpartSlug);
  const bdUrl = country === 'BD' ? currentUrl : counterpartUrl;
  const inUrl = country === 'IN' ? currentUrl : counterpartUrl;
  return {
    ...metadata,
    alternates: {
      canonical: currentUrl,
      languages: { 'bn-BD': bdUrl, 'en-IN': inUrl },
    },
  };
}

export default async function CategorySlugLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const country = slug.endsWith('-in') || slug.endsWith('-india') ? 'IN' : slug.endsWith('-bd') ? 'BD' : await getSeoCountry();
  const category = await getServerRow('categories', 'slug', slug, country);
  if (!category || category.is_active === false) return <>{children}</>;

  const countryName = country === 'IN' ? category.name_en || category.name_bn : category.name_bn || category.name_en;
  const name = countryName || slug.replace(/-/g, ' ');
  const description = categoryDescription(category.meta_description || category.description, country, name).slice(0, 500);
  const url = `${SITE_URL}/category/${encodeURIComponent(slug)}`;
  const image = absoluteCategoryImage(category.banner || category.image);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name,
        description,
        inLanguage: country === 'IN' ? 'en-IN' : 'bn-BD',
        url,
        image,
        isPartOf: { '@type': 'WebSite', name: 'GAZI SEED', url: SITE_URL },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: country === 'IN' ? 'Home' : 'হোম', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: country === 'IN' ? 'Categories' : 'ক্যাটাগরি', item: `${SITE_URL}/categories` },
          { '@type': 'ListItem', position: 3, name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      {children}
    </>
  );
}
