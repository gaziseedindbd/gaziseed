import { getSeoCountry, pageMetadata, serializeJsonLd, SITE_URL } from '@/lib/seo-metadata';
import { AllProductsPage } from '@/components/site/all-products-page';

export async function generateMetadata() {
  const country = await getSeoCountry();
  const isIndia = country === 'IN';
  return pageMetadata({
    title: isIndia ? 'Shop Seeds Online in India | GAZI SEED' : 'সকল বীজ ও বাগান পণ্য | GAZI SEED',
    description: isIndia
      ? 'Browse vegetable, flower and gardening seeds available for delivery across India.'
      : 'বীজ, গাছ ও বাগান পণ্যের সংগ্রহ দেখুন এবং ঘরে বসে অর্ডার করুন।',
    path: '/all-products',
    locale: isIndia ? 'en_IN' : 'bn_BD',
  });
}

export default async function Page() {
  const country = await getSeoCountry();
  const isIndia = country === 'IN';
  const name = isIndia ? 'Shop Seeds Online in India' : 'সকল বীজ ও বাগান পণ্য';
  const description = isIndia
    ? 'Browse vegetable, flower and gardening seeds available for delivery across India.'
    : 'বীজ, গাছ ও বাগান পণ্যের সংগ্রহ দেখুন এবং ঘরে বসে অর্ডার করুন।';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/all-products#webpage`,
        url: `${SITE_URL}/all-products`,
        name,
        description,
        inLanguage: isIndia ? 'en-IN' : 'bn-BD',
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: isIndia ? 'Home' : 'হোম', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: isIndia ? 'Products' : 'পণ্য', item: `${SITE_URL}/all-products` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <AllProductsPage />
    </>
  );
}
