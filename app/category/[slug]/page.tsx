import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { cleanSeoDescription, getSeoCountry, localizedSeoText, pageMetadata } from '@/lib/seo-metadata';
import CategoryClientPage from './client-page';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const supabase = await createServerSupabase(country);
  const { data: category } = await supabase
    .from('categories')
    .select('name_bn,name_en,slug,description,image,is_active,country_code,seo_title,meta_description')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  const canonicalPath = `/category/${encodeURIComponent(slug)}`;
  if (!category) {
    return {
      title: 'Category unavailable | GAZI SEED',
      robots: { index: false, follow: true },
      alternates: { canonical: canonicalPath },
    };
  }

  const name = country === 'IN'
    ? category.name_en || category.name_bn || 'Seeds'
    : category.name_bn || category.name_en || 'বীজ';
  const title = localizedSeoText(category.seo_title, country, name);
  const description = cleanSeoDescription(
    localizedSeoText(category.meta_description || category.description, country, name),
    name,
  );
  return pageMetadata({
    title,
    description,
    image: category.image,
    path: canonicalPath,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default function CategoryPage() {
  return <CategoryClientPage />;
}
