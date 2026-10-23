import { getSeoCountry, pageMetadata } from '@/lib/seo-metadata';
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

export default function CategoriesPage() {
  return <CategoriesClientPage />;
}
