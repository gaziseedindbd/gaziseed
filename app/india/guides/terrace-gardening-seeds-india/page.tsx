import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = 'https://www.gaziseed.com';

export const metadata: Metadata = {
  title: 'Best Seeds for Terrace Gardening in India | GAZI SEED',
  description:
    'A practical guide to choosing seeds for Indian terrace gardens, balconies, containers and grow bags.',
  alternates: { canonical: BASE_URL + '/india/guides/terrace-gardening-seeds-india' },
  openGraph: {
    title: 'Best Seeds for Terrace Gardening in India',
    description: 'How to choose seed types for Indian rooftops, balconies and containers.',
    url: BASE_URL + '/india/guides/terrace-gardening-seeds-india',
    siteName: 'GAZI SEED',
    type: 'article',
    locale: 'en_IN',
  },
  robots: { index: true, follow: true },
};

export default function TerraceGardeningSeedsIndia() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Best Seeds for Terrace Gardening in India',
    mainEntityOfPage: BASE_URL + '/india/guides/terrace-gardening-seeds-india',
    author: { '@type': 'Organization', name: 'GAZI SEED' },
    publisher: { '@type': 'Organization', name: 'GAZI SEED', url: BASE_URL },
  };

  return (
    <main className="min-h-screen bg-[hsl(var(--background))]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
          <Link href="/india/guides" className="font-black text-emerald-800">India Guides</Link>
          <span className="mx-2">/</span>
          <span>Terrace Gardening</span>
        </nav>
        <h1 className="text-4xl font-black tracking-tight text-emerald-950 sm:text-5xl">
          Best Seeds for Terrace Gardening in India
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
          Choose seeds by sunlight, container size, watering routine and the amount of space available on your terrace.
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-slate-700">
          <section>
            <h2 className="text-2xl font-black text-emerald-950">Start with your growing space</h2>
            <p className="mt-3">
              A terrace garden can support vegetables, chillies, flowers and herbs, but the right
              seed choice depends on the container, available sunlight and how often you can water.
              Compact crops are often easier to manage in containers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">Good categories to consider</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['Chilli', 'Chili varieties are useful for sunny balconies and rooftops when containers are suitable.'],
                ['Tomato', 'Cherry and compact tomato types can work well in containers with support.'],
                ['Flowers', 'Rose, cosmos, zinnia and daisy seeds can add colour to terrace gardens.'],
                ['Leafy herbs', 'Coriander and mint are convenient choices for small home growing setups.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_14px_35px_-28px_rgba(4,62,40,.5)]">
                  <h3 className="font-black text-emerald-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">Plan for sunlight and drainage</h2>
            <p className="mt-3">
              Before sowing, check where the sun falls across your terrace and choose containers that
              drain excess water. Keep enough walking space around containers so maintenance remains practical.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">Make the seed choice match your routine</h2>
            <p className="mt-3">
              Choose fewer varieties first, especially when starting out. A smaller garden that receives
              regular care is easier to manage than too many containers that cannot be monitored consistently.
            </p>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
            <h2 className="text-xl font-black text-emerald-950">Browse the India catalog</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Explore live India products and compare categories before choosing what to grow next.
            </p>
            <Link href="/all-products" className="mt-4 inline-flex rounded-full bg-emerald-800 px-4 py-2.5 text-xs font-black text-white">
              Browse Seeds
            </Link>
          </section>
        </div>
      </article>
    </main>
  );
}
