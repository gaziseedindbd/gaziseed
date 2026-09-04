import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getActiveVideo } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

function youtubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const watchId = parsed.searchParams.get('v');
      if (watchId) return `https://www.youtube.com/embed/${watchId}`;

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
      if (parts[0] === 'shorts' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const { data } = await getActiveVideo(country, id);

  if (!data) return { title: 'Video not found — SEED BARI' };

  const description = data.description?.trim() || `Watch ${data.title} from SEED BARI.`;

  return {
    title: `${data.title} — SEED BARI`,
    description,
    openGraph: {
      title: `${data.title} — SEED BARI`,
      description,
      type: 'video.other',
      url: `/videos/${data.id}`,
    },
  };
}

export default async function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getActiveVideo(country, id);

  if (error || !data) notFound();

  const embedUrl = youtubeEmbedUrl(data.youtube_url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gaziseed.vercel.app';
  const videoUrl = `${siteUrl}/videos/${data.id}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: data.title,
    description: data.description?.trim() || `Watch ${data.title} from SEED BARI.`,
    contentUrl: data.youtube_url,
    embedUrl: embedUrl || undefined,
    url: videoUrl,
    publisher: { '@type': 'Organization', name: 'SEED BARI', url: siteUrl },
    inLanguage: country === 'BD' ? 'bn-BD' : 'en-IN',
  };

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="mx-auto max-w-5xl">
        <Link href="/videos" className="font-bold text-[#1f6b3b]">← Back to video gallery</Link>

        <article className="mt-8 overflow-hidden rounded-3xl border bg-white shadow-sm">
          {embedUrl ? (
            <div className="aspect-video bg-black">
              <iframe
                className="h-full w-full"
                src={embedUrl}
                title={data.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-[#edf5e9] p-6 text-center">
              <a href={data.youtube_url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#1f6b3b] px-6 py-3 font-bold text-white">
                Watch video on YouTube →
              </a>
            </div>
          )}

          <section className="p-8 md:p-12">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI VIDEO</p>
            <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">{data.title}</h1>
            {data.description ? (
              <p className="mt-5 whitespace-pre-line text-lg leading-8 text-gray-600">{data.description}</p>
            ) : null}
          </section>
        </article>
      </div>
    </main>
  );
}
