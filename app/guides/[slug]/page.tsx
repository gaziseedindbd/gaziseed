import { notFound } from 'next/navigation';

import { getActiveGuide } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

function asHtml(value: string | null | undefined) {
  return value ?? '';
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getActiveGuide(country, slug);

  if (error || !data) notFound();

  const title = data.title_en || data.title_bn;
  const content = data.content_en || data.content_bn || '';

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="p-8 md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI GUIDE</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">{title}</h1>
          <div className="prose prose-lg mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: asHtml(content) }} />
        </div>
      </article>
    </main>
  );
}
