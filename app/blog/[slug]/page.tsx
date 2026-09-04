import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { getPublishedBlogPost } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

function asHtml(value: string | null | undefined) {
  return value ?? '';
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const { data } = await getPublishedBlogPost(country, slug);

  if (!data) {
    return { title: 'Blog | SEED BARI' };
  }

  const title = data.title_en || data.title_bn;
  const description = data.excerpt || 'Seed growing tips, farming knowledge, and seasonal insights from SEED BARI.';

  return {
    title: `${title} | SEED BARI`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      ...(data.cover_image_url ? { images: [data.cover_image_url] } : {}),
    },
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getPublishedBlogPost(country, slug);

  if (error || !data) notFound();

  const title = data.title_en || data.title_bn;
  const content = data.content_en || data.content_bn || data.excerpt || '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gaziseed.vercel.app';
  const articleUrl = `${siteUrl}/blog/${data.slug}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: data.excerpt || undefined,
    url: articleUrl,
    datePublished: data.published_at || undefined,
    image: data.cover_image_url ? [data.cover_image_url] : undefined,
    publisher: { '@type': 'Organization', name: 'SEED BARI', url: siteUrl },
    inLanguage: country === 'BD' ? 'bn-BD' : 'en-IN',
  };

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-sm">
        {data.cover_image_url ? (
          <div className="aspect-[16/8] bg-[#edf5e9]">
            <img src={data.cover_image_url} alt={title} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="p-8 md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI BLOG</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">{title}</h1>
          {data.published_at ? (
            <p className="mt-4 text-sm text-gray-500">
              {new Date(data.published_at).toLocaleDateString(country === 'IN' ? 'en-IN' : 'en-BD')}
            </p>
          ) : null}
          {data.excerpt ? <p className="mt-6 text-lg leading-8 text-gray-600">{data.excerpt}</p> : null}
          <div className="prose prose-lg mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: asHtml(content) }} />
        </div>
      </article>
    </main>
  );
}
