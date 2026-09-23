import type { Metadata } from 'next';
import { getServerRow, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country = slug.endsWith('-india') ? 'IN' : 'BD';
  const category = await getServerRow('categories', 'slug', slug, country);
  const title = category?.name_bn || category?.name_en || slug.replace(/-/g, ' ');
  const description = category?.description || `বীজ ও কৃষি পণ্যের ${title} ক্যাটাগরি — GAZI SEED`;
  const image = category?.banner || category?.image || null;
  return pageMetadata({ title: `${title} | GAZI SEED`, description, image, path: `/category/${slug}` });
}

export default async function CategorySlugLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const country = slug.endsWith('-india') ? 'IN' : 'BD';
  const category = await getServerRow('categories', 'slug', slug, country);
  if (!category || category.is_active === false) return <>{children}</>;

  const name = category.name_bn || category.name_en || slug.replace(/-/g, ' ');
  const description = (category.description || `বীজ ও কৃষি পণ্যের ${name} ক্যাটাগরি — GAZI SEED`).slice(0, 500);
  const url = `${SITE_URL}/category/${encodeURIComponent(slug)}`;
  const image = category.banner || category.image || undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name,
        description,
        url,
        image,
        isPartOf: { '@type': 'WebSite', name: 'GAZI SEED', url: SITE_URL },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE_URL}/categories` },
          { '@type': 'ListItem', position: 3, name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
