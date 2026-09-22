import type { Metadata } from 'next';
import { getServerRow, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getServerRow('blog_posts', 'slug', slug);

  if (!post || post.is_published === false) return {};

  const title = post.seo_title?.trim() || post.title || 'GAZI SEED Garden Guide';
  const description = post.meta_description?.trim() || post.content?.slice(0, 160) || 'GAZI SEED gardening and seed guide.';
  const image = post.featured_image || null;

  return pageMetadata({
    title: `${title} | GAZI SEED`,
    description: description.slice(0, 160),
    image,
    path: `/blog/${slug}`,
    type: 'article',
  });
}

export default async function BlogSlugLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const { slug } = await params;
  const post = await getServerRow('blog_posts', 'slug', slug);

  if (!post || post.is_published === false) return <>{children}</>;

  const title = post.seo_title?.trim() || post.title || 'GAZI SEED Garden Guide';
  const description = (post.meta_description?.trim() || post.content?.slice(0, 160) || title).slice(0, 500);
  const url = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
  const image = post.featured_image || undefined;
  const published = post.publish_date || post.created_at;
  const modified = post.updated_at || published;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: image ? [image] : undefined,
    datePublished: published || undefined,
    dateModified: modified || undefined,
    articleSection: post.category || 'Gardening',
    author: { '@type': 'Organization', name: 'GAZI SEED', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'GAZI SEED', url: SITE_URL },
    inLanguage: 'bn-BD',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
