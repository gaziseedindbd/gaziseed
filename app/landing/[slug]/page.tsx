import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getActiveLandingPage } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function getLandingMetadata(slug: string): Promise<{
  title: string;
  description: string;
  id?: string | null;
  slug: string;
} | null> {
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getActiveLandingPage(country, slug);

  if (error || !data) return null;

  const content = (data.content ?? {}) as Record<string, unknown>;
  const description = asText(content.description);

  return {
    title: data.title,
    description,
    id: data.id,
    slug: data.slug,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getLandingMetadata(slug);

  if (!data) {
    return {
      title: 'Campaign — SEED BARI',
      robots: { index: false, follow: false },
    };
  }

  const description = data.description || `Discover this SEED BARI campaign for ${data.title}.`;

  return {
    title: `${data.title} | SEED BARI`,
    description,
    alternates: { canonical: `/landing/${data.slug}` },
    openGraph: {
      title: `${data.title} | SEED BARI`,
      description,
      type: 'website',
      url: `/landing/${data.slug}`,
    },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getActiveLandingPage(country, slug);

  if (error || !data) notFound();

  const content = (data.content ?? {}) as Record<string, unknown>;
  const heading = asText(content.heading) || data.title;
  const description = asText(content.description);
  const ctaText = asText(content.cta_text) || 'Shop Now';
  const ctaLink = asText(content.cta_link) || '/shop';
  const imageUrl = asText(content.image_url);

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border bg-white shadow-sm">
        {imageUrl && (
          <div className="relative aspect-[16/7] w-full bg-[#edf5e9]">
            <img src={imageUrl} alt={data.title} className="h-full w-full object-cover" />
          </div>
        )}

        <section className="p-8 md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CAMPAIGN</p>
          <h1 className="mt-3 text-4xl font-black md:text-6xl">{heading}</h1>
          {description && <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={ctaLink} className="rounded-xl bg-[#1f6b3b] px-6 py-3 font-bold text-white">
              {ctaText}
            </Link>
            <Link href="/shop" className="rounded-xl border px-6 py-3 font-bold text-gray-800">
              Browse All Seeds
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
