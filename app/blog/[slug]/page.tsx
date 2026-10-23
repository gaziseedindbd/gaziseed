import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { cleanSeoDescription, getSeoCountry, localizedSeoText, pageMetadata } from '@/lib/seo-metadata';
import BlogPostClientPage from './client-page';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const supabase = await createServerSupabase(country);
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title,slug,featured_image,content,seo_title,meta_description,is_published,publish_date')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  const canonicalPath = `/blog/${encodeURIComponent(slug)}`;
  if (!post) {
    return {
      title: 'Article unavailable | GAZI SEED',
      robots: { index: false, follow: true },
      alternates: { canonical: canonicalPath },
    };
  }

  const title = localizedSeoText(post.seo_title, country, post.title || 'GAZI SEED');
  const description = cleanSeoDescription(
    localizedSeoText(post.meta_description || post.content, country, title),
    title,
  );
  return pageMetadata({
    title,
    description,
    image: post.featured_image,
    path: canonicalPath,
    type: 'article',
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default function BlogPostPage() {
  return <BlogPostClientPage />;
}
