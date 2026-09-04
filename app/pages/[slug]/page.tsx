import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPublishedContentPage } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';

type ContentPage = {
  id: string;
  country: string | null;
  page_type: string;
  slug: string;
  title_bn: string;
  title_en: string;
  content_bn: string;
  content_en: string;
  active: boolean;
};

async function loadPage(slug: string) {
  const country = await getStoreCountry();
  const { data, error } = await getPublishedContentPage(country, slug);
  if (error || !data) notFound();
  return { country, page: data as ContentPage };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { country, page } = await loadPage(slug);
  const title = country === 'BD' ? page.title_bn : page.title_en;
  const description = page.title_bn || page.title_en;

  return {
    title: `${title} — SEED BARI`,
    description,
    alternates: {
      canonical: `/pages/${page.slug}`,
    },
    openGraph: {
      title: `${title} — SEED BARI`,
      description,
      type: 'article',
      url: `/pages/${page.slug}`,
    },
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { country, page } = await loadPage((await params).slug);
  const isBangla = country === 'BD';
  const title = isBangla ? page.title_bn : page.title_en;
  const content = isBangla ? page.content_bn : page.content_en;

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <article className="mx-auto max-w-4xl rounded-3xl border bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-bold uppercase tracking-wide text-[#1f6b3b]">SEED BARI</p>
        <h1 className="mt-2 text-3xl font-black md:text-4xl">{title}</h1>
        <div className="prose prose-gray mt-8 max-w-none whitespace-pre-wrap leading-7">
          {content || 'Content will be available soon.'}
        </div>
      </article>
    </main>
  );
}
