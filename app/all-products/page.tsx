import { getSeoCountry, pageMetadata } from '@/lib/seo-metadata';
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

export default function Page() {
  return <AllProductsPage />;
}
