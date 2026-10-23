import { getSeoCountry, pageMetadata } from '@/lib/seo-metadata';
import BlogIndexClientPage from './client-page';

export async function generateMetadata() {
  const country = await getSeoCountry();
  const isIndia = country === 'IN';
  return pageMetadata({
    title: isIndia ? 'Seed Growing Guides | GAZI SEED India' : 'বীজ ও বাগান করার গাইড | GAZI SEED',
    description: isIndia
      ? 'Read practical seed selection and growing guides for Indian gardens and farms.'
      : 'বীজ বপন, গাছের পরিচর্যা ও বাগান করার সহজ গাইড পড়ুন।',
    path: '/blog',
    locale: isIndia ? 'en_IN' : 'bn_BD',
  });
}

export default function BlogIndexPage() {
  return <BlogIndexClientPage />;
}
