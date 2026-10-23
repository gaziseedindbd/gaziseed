import { getSeoCountry, pageMetadata, serializeJsonLd, SITE_URL } from '@/lib/seo-metadata';
import CategoriesClientPage from './client-page';

export async function generateMetadata() {
  const country = await getSeoCountry();
  const isIndia = country === 'IN';
  return pageMetadata({
    title: isIndia ? 'Seed Categories in India | GAZI SEED' : 'বীজের ক্যাটাগরি | GAZI SEED',
    description: isIndia
      ? 'Explore seed categories available from GAZI SEED India, including vegetables, flowers and gardening seeds.'
      : 'GAZI SEED-এর বীজ ও বাগান পণ্যের বিভিন্ন ক্যাটাগরি দেখুন।',
    path: '/categories',
    locale: isIndia ? 'en_IN' : 'bn_BD',
  });
}

export default async function CategoriesPage() {
  const country = await getSeoCountry();
  const isIndia = country === 'IN';
  const name = isIndia ? 'Seed Categories in India' : 'বীজের ক্যাটাগরি';
  const description = isIndia
    ? 'Explore seed categories available from GAZI SEED India, including vegetables, flowers and gardening seeds.'
    : 'GAZI SEED-এর বীজ ও বাগান পণ্যের বিভিন্ন ক্যাটাগরি দেখুন।';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/categories#webpage`,
        url: `${SITE_URL}/categories`,
        name,
        description,
        inLanguage: isIndia ? 'en-IN' : 'bn-BD',
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: isIndia ? 'Home' : 'হোম', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: isIndia ? 'Categories' : 'ক্যাটাগরি', item: `${SITE_URL}/categories` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <CategoriesClientPage />
    </>
  );
}
