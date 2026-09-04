import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getActiveGuide } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

function asHtml(value: string | null | undefined) {
  return value ?? '';
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const { data } = await getActiveGuide(country, slug);

  if (!data) return { title: 'SEED BARI Guide' };

  const title = data.title_en || data.title_bn;
  const description = (data.content_en || data.content_bn || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const market = country === 'IN' ? 'India' : 'Bangladesh';
  const fullTitle = `${title} | SEED BARI`;
  const fullDescription = description || `Practical cultivation guide from SEED BARI for ${market}.`;

  return {
    title: fullTitle,
    description: fullDescription,
    alternates: {
      canonical: `/guides/${data.slug}`,
    },
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      type: 'article',
      url: `/guides/${data.slug}`,
    },
  };
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getActiveGuide(country, slug);

  if (error || !data) notFound();

  const title = data.title_en || data.title_bn;
  const content = data.content_en || data.content_bn || '';
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gaziseed.vercel.app').replace(/\/$/, '');
  const guideUrl = `${siteUrl}/guides/${data.slug}`;
  const plainTextDescription = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: plainTextDescription || undefined,
    url: guideUrl,
    publisher: { '@type': 'Organization', name: 'SEED BARI', url: siteUrl },
    inLanguage: country === 'BD' ? 'bn-BD' : 'en-IN',
  };

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/guides" className="font-bold text-[#1f6b3b]">← Back to guides</Link>
        <article className="mt-8 overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="p-8 md:p-12">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI GUIDE</p>
            <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">{title}</h1>
            <div className="prose prose-lg mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: asHtml(content) }} />
          </div>
        </article>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </main>
  );
}
