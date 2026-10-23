import type { Metadata } from 'next';
import { getSeoCountry, getServerRow, localizedSeoText, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const post = await getServerRow('blog_posts', 'slug', slug, country);

  if (!post || post.is_published === false) return {};

  const title = localizedSeoText(post.seo_title, country, post.title || 'GAZI SEED Garden Guide');
  const description = localizedSeoText(post.meta_description || post.content, country, 'GAZI SEED gardening and seed guide.');
  const image = post.featured_image || null;

  return pageMetadata({
    title: `${title} | GAZI SEED`,
    description: description.slice(0, 160),
    image,
    path: `/blog/${slug}`,
    type: 'article',
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
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
  const country = await getSeoCountry();
  const post = await getServerRow('blog_posts', 'slug', slug, country);

  if (!post || post.is_published === false) return <>{children}</>;

  const title = localizedSeoText(post.seo_title, country, post.title || 'GAZI SEED Garden Guide');
  const description = localizedSeoText(post.meta_description || post.content, country, title).slice(0, 500);
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
    inLanguage: country === 'IN' ? 'en-IN' : 'bn-BD',
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
