import type { Metadata } from 'next';
import { getServerRow, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getServerRow('pages', 'slug', slug);

  if (!page || page.is_published === false) return {};

  const title = page.seo_title?.trim() || page.title || 'GAZI SEED';
  const description = page.meta_description?.trim() || page.content?.slice(0, 160) || 'GAZI SEED — বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর।';

  return pageMetadata({
    title: `${title} | GAZI SEED`,
    description: description.slice(0, 160),
    path: `/page/${slug}`,
  });
}

export default async function PageSlugLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const { slug } = await params;
  const page = await getServerRow('pages', 'slug', slug);

  if (!page || page.is_published === false) return <>{children}</>;

  const title = page.seo_title?.trim() || page.title || 'GAZI SEED';
  const description = (page.meta_description?.trim() || page.content?.slice(0, 160) || title).slice(0, 500);
  const url = `${SITE_URL}/page/${encodeURIComponent(slug)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    isPartOf: { '@type': 'WebSite', name: 'GAZI SEED', url: SITE_URL },
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
