import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { cleanSeoDescription, getSeoCountry, localizedSeoText, pageMetadata } from '@/lib/seo-metadata';
import CmsPageClient from './client-page';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const supabase = await createServerSupabase(country);
  const { data: page } = await supabase
    .from('pages')
    .select('title,slug,content,seo_title,meta_description,is_published')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  const canonicalPath = `/page/${encodeURIComponent(slug)}`;
  if (!page) {
    return {
      title: 'Page unavailable | GAZI SEED',
      robots: { index: false, follow: true },
      alternates: { canonical: canonicalPath },
    };
  }
  const title = localizedSeoText(page.seo_title, country, page.title || 'GAZI SEED');
  const description = cleanSeoDescription(
    localizedSeoText(page.meta_description || page.content, country, title),
    title,
  );
  return pageMetadata({
    title,
    description,
    path: canonicalPath,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default function CmsPage() {
  return <CmsPageClient />;
}
