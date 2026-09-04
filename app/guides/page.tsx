import Link from 'next/link';

import { getActiveGuides } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

function excerpt(value: string | null | undefined, maxLength = 220) {
  const text = (value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export default async function GuidesPage() {
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getActiveGuides(country, 24);
  const guides = data ?? [];

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 rounded-3xl border bg-white p-8 md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI GUIDES</p>
          <h1 className="mt-3 text-4xl font-black md:text-6xl">Practical cultivation guides</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-600">
            Helpful seed-growing and cultivation guidance for the {country === 'IN' ? 'India' : 'Bangladesh'} market.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border bg-white p-6 text-red-600">Unable to load guides right now.</div>
        ) : guides.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <h2 className="text-xl font-bold">Guides are coming soon</h2>
            <p className="mt-2 text-gray-500">Published cultivation guides will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => (
              <Link
                key={guide.id}
                href={`/guides/${guide.slug}`}
                className="rounded-2xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <h2 className="text-xl font-black">{guide.title_en || guide.title_bn}</h2>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {excerpt(guide.content_en || guide.content_bn, 220)}
                </p>
                <span className="mt-5 inline-block font-bold text-[#1f6b3b]">Read guide →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
