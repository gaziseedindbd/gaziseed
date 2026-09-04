import Link from 'next/link';
import type { Metadata } from 'next';

import { getPublishedContentPages } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

const pageSeo: Record<CountryCode, { title: string; description: string }> = {
  BD: {
    title: 'SEED BARI Information & Policies Bangladesh',
    description: 'Important information, customer policies, and helpful pages for SEED BARI customers in Bangladesh.',
  },
  IN: {
    title: 'SEED BARI Information & Policies India',
    description: 'Important information, customer policies, and helpful pages for SEED BARI customers in India.',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const country = await getStoreCountry('BD');
  const seo = pageSeo[country];

  return {
    title: seo.title,
    description: seo.description,
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: 'website',
    },
  };
}

export default async function ContentPagesIndex() {
  const country = await getStoreCountry();
  const { data, error } = await getPublishedContentPages(country);
  const pages = data ?? [];

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="font-bold text-[#1f6b3b]">SEED BARI</p>
          <h1 className="mt-2 text-4xl font-black">Information & Policies</h1>
          <p className="mt-2 text-gray-600">
            Helpful information, policies and important pages for our {country === 'IN' ? 'India' : 'Bangladesh'} customers.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border bg-white p-6 text-red-600">Unable to load pages right now.</div>
        ) : pages.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <h2 className="text-xl font-bold">No published pages yet</h2>
            <p className="mt-2 text-gray-500">Content pages published from the CMS will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={`/pages/${page.slug}`}
                className="rounded-2xl border bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-[#1f6b3b]">{page.page_type}</p>
                <h2 className="mt-2 text-xl font-black">{country === 'BD' ? page.title_bn : page.title_en}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                  {country === 'BD' ? page.content_bn : page.content_en}
                </p>
                <span className="mt-4 inline-block font-bold text-[#1f6b3b]">Read page →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
