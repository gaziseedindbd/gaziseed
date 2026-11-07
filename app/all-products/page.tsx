import { getSeoCountry, getSeoLanguage, getSeoLocale, pageMetadata, serializeJsonLd, SITE_URL } from '@/lib/seo-metadata';
import { AllProductsPage } from '@/components/site/all-products-page';

export async function generateMetadata() {
  const country = await getSeoCountry();
  const isIndia = country === 'IN';
  const language = await getSeoLanguage(country);
  const title = language === 'bn'
    ? (isIndia ? 'ভারতে বীজ ও বাগান পণ্য | GAZI SEED' : 'সকল বীজ ও বাগান পণ্য | GAZI SEED')
    : language === 'hi'
      ? (isIndia ? 'भारत में बीज और बागवानी उत्पाद | GAZI SEED' : 'बीज और बागवानी उत्पाद | GAZI SEED')
      : (isIndia ? 'Shop Seeds Online in India | GAZI SEED' : 'Seeds and Gardening Products | GAZI SEED');
  return pageMetadata({
    title,
    description: language === 'bn'
      ? (isIndia ? 'ভারতে পাওয়া সবজি, ফুল ও বাগানের বীজ দেখুন। চেকআউটে PIN কোড দিয়ে ডেলিভারি ও পেমেন্ট যাচাই করুন।' : 'বীজ, গাছ ও বাগান পণ্য দেখুন এবং ঘরে বসে অর্ডার করুন।')
      : language === 'hi'
        ? (isIndia ? 'भारत में उपलब्ध सब्ज़ियों, फूलों और बागवानी के बीज देखें। चेकआउट पर PIN कोड से डिलीवरी और भुगतान विकल्प जाँचें।' : 'बीज और बागवानी उत्पाद देखें और घर बैठे ऑर्डर करें।')
        : (isIndia ? 'Browse vegetable, flower and gardening seeds available for delivery across India.' : 'Browse seeds and gardening products available for delivery across Bangladesh.'),
    path: '/all-products',
    locale: getSeoLocale(language, country),
  });
}

export default async function Page() {
  const country = await getSeoCountry();
  const isIndia = country === 'IN';
  const language = await getSeoLanguage(country);
  const name = language === 'bn'
    ? (isIndia ? 'ভারতে বীজ ও বাগান পণ্য' : 'সকল বীজ ও বাগান পণ্য')
    : language === 'hi'
      ? (isIndia ? 'भारत में बीज और बागवानी उत्पाद' : 'बीज और बागवानी उत्पाद')
      : (isIndia ? 'Shop Seeds Online in India' : 'Seeds and Gardening Products');
  const description = language === 'bn'
    ? (isIndia ? 'ভারতে পাওয়া বীজ দেখুন এবং PIN কোড দিয়ে ডেলিভারি যাচাই করুন।' : 'বীজ, গাছ ও বাগান পণ্যের সংগ্রহ দেখুন এবং ঘরে বসে অর্ডার করুন।')
    : language === 'hi'
      ? (isIndia ? 'भारत में उपलब्ध बीज देखें और PIN कोड से डिलीवरी जाँचें।' : 'बीज और बागवानी उत्पाद देखें और घर बैठे ऑर्डर करें।')
      : (isIndia ? 'Browse seeds available for delivery across India.' : 'Browse seeds and gardening products available across Bangladesh.');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/all-products#webpage`,
        url: `${SITE_URL}/all-products`,
        name,
        description,
        inLanguage: `${language}-${country}`,
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: language === 'bn' ? 'হোম' : language === 'hi' ? 'होम' : 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: language === 'bn' ? 'পণ্য' : language === 'hi' ? 'उत्पाद' : 'Products', item: `${SITE_URL}/all-products` },
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
