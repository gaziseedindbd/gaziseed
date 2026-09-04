import Link from 'next/link';
import type { Metadata } from 'next';

import { getActiveVideos } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

const videoSeo: Record<CountryCode, { title: string; description: string }> = {
  BD: {
    title: 'SEED BARI Videos Bangladesh | Seed & Cultivation Tips',
    description: 'Practical seed, farming, and cultivation videos for growers in Bangladesh from SEED BARI.',
  },
  IN: {
    title: 'SEED BARI Videos India | Seed & Cultivation Tips',
    description: 'Practical seed, farming, and cultivation videos for growers in India from SEED BARI.',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const country = await getStoreCountry('BD');
  const seo = videoSeo[country];

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

export default async function VideosPage() {
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getActiveVideos(country, 24);
  const videos = data ?? [];

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="font-bold text-[#1f6b3b]">← SEED BARI home</Link>
        <header className="mt-8">
          <p className="text-sm font-bold tracking-[0.2em] text-[#1f6b3b]">VIDEO GALLERY</p>
          <h1 className="mt-2 text-4xl font-black md:text-5xl">Learn from SEED BARI</h1>
          <p className="mt-4 max-w-2xl text-gray-600">Practical seed and cultivation videos selected for the current market.</p>
        </header>

        {error ? (
          <div className="mt-10 rounded-2xl border bg-white p-6 text-red-600">Unable to load videos right now.</div>
        ) : videos.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-white p-10 text-center text-gray-500">No videos are published yet.</div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <Link key={video.id} href={`/videos/${video.id}`} className="rounded-2xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex h-40 items-center justify-center rounded-xl bg-[#edf5e9] text-5xl">▶</div>
                <h2 className="mt-4 text-lg font-black">{video.title}</h2>
                {video.description && <p className="mt-2 text-sm leading-6 text-gray-600">{video.description}</p>}
                <span className="mt-4 inline-block font-bold text-[#1f6b3b]">Watch video →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
