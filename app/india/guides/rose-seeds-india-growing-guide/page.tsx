import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = 'https://www.gaziseed.com';

export const metadata: Metadata = {
  title: 'Red Rose Seed Growing Guide for India | GAZI SEED',
  description:
    'Beginner-friendly red rose seed growing guide for Indian home gardens, balconies, rooftops and containers.',
  alternates: { canonical: BASE_URL + '/india/guides/rose-seeds-india-growing-guide' },
  openGraph: {
    title: 'Red Rose Seed Growing Guide for India',
    description: 'Beginner-friendly guidance for growing red roses from seed in India.',
    url: BASE_URL + '/india/guides/rose-seeds-india-growing-guide',
    siteName: 'GAZI SEED',
    type: 'article',
    locale: 'en_IN',
  },
  robots: { index: true, follow: true },
};

export default function RoseSeedsIndiaGuide() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Red Rose Seed Growing Guide for India',
    mainEntityOfPage: BASE_URL + '/india/guides/rose-seeds-india-growing-guide',
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
          <span>Red Rose</span>
        </nav>
        <span className="inline-flex rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-rose-700">
          Flower Seed Guide
        </span>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-emerald-950 sm:text-5xl">
          Red Rose Seed Growing Guide for India
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
          A simple introduction to starting red rose seeds in home gardens, pots and terrace spaces.
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-slate-700">
          <section>
            <h2 className="text-2xl font-black text-emerald-950">Choose the right container and medium</h2>
            <p className="mt-3">
              Use a clean container with drainage holes and a loose, well-drained medium. Avoid
              compacted soil that stays saturated after watering.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">Be patient with rose seeds</h2>
            <p className="mt-3">
              Rose seeds can take longer to establish than many common vegetable seeds. Consistent care,
              suitable moisture and a stable growing environment are more useful than repeated disturbance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">Choose a bright location</h2>
            <p className="mt-3">
              A bright balcony, terrace or outdoor garden location is usually preferable to a dark corner.
              Adjust the position through the year according to heat and available sunlight.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">Move young plants carefully</h2>
            <p className="mt-3">
              Once seedlings are established and strong enough to handle, transplant them carefully.
              Avoid damaging the young root system and keep moisture steady during the transition.
            </p>
          </section>

          <section className="rounded-2xl border border-rose-100 bg-rose-50/60 p-6">
            <h2 className="text-xl font-black text-emerald-950">Red Rose Flower Seeds</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              The GAZI SEED India catalog currently includes red rose flower seeds for home, pot,
              balcony and terrace gardening.
            </p>
            <Link href="/product/lal-golap-fuler-bij" className="mt-4 inline-flex rounded-full bg-emerald-800 px-4 py-2.5 text-xs font-black text-white">
              View Red Rose Seeds
            </Link>
          </section>
        </div>
      </article>
    </main>
  );
}
