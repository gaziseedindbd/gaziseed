import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = 'https://www.gaziseed.com';

export const metadata: Metadata = {
  title: 'India Seed Growing Guides | GAZI SEED',
  description:
    'Practical seed and home-gardening guides for India from GAZI SEED, covering chilli, terrace gardening and flower seed growing.',
  alternates: { canonical: BASE_URL + '/india/guides' },
  openGraph: {
    title: 'India Seed Growing Guides | GAZI SEED',
    description: 'Practical seed and gardening guides for Indian growers.',
    url: BASE_URL + '/india/guides',
    siteName: 'GAZI SEED',
    type: 'website',
    locale: 'en_IN',
  },
  robots: { index: true, follow: true },
};

const guides = [
  {
    slug: 'naga-bombay-chili-growing-guide',
    title: 'Naga Bombay Chili Growing Guide',
    description: 'A practical guide to starting Naga Bombay chili seeds in pots, grow bags, rooftops and home gardens.',
    anchor: 'Naga Bombay chili seeds',
  },
  {
    slug: 'terrace-gardening-seeds-india',
    title: 'Best Seeds for Terrace Gardening in India',
    description: 'How to choose seed types for Indian balconies, rooftops, containers and kitchen gardens.',
    anchor: 'terrace gardening seeds in India',
  },
  {
    slug: 'rose-seeds-india-growing-guide',
    title: 'Red Rose Seed Growing Guide for India',
    description: 'A beginner-friendly guide to growing red rose plants from seed in Indian home gardens and containers.',
    anchor: 'red rose flower seeds',
  },
];

export default function IndiaGuidesPage() {
  return (
    <main className="min-h-screen bg-[hsl(var(--background))]">
      <section className="border-b border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 text-white">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <nav aria-label="Breadcrumb" className="mb-5 text-sm text-emerald-100/80">
            <Link href="/india" className="hover:text-white">GAZI SEED India</Link>
            <span className="mx-2">/</span>
            <span>Guides</span>
          </nav>
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em]">
            INDIA GROWING GUIDES
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Seed & Gardening Guides for India
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
            Useful, practical resources that Indian growers can reference when choosing
            seeds and planning home, terrace or garden cultivation.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {guides.map((guide) => (
            <article key={guide.slug} className="flex h-full flex-col rounded-2xl border border-emerald-100 bg-white p-6 shadow-[0_14px_35px_-28px_rgba(4,62,40,.55)]">
              <h2 className="text-xl font-black text-emerald-950">{guide.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{guide.description}</p>
              <Link
                href={`/india/guides/${guide.slug}`}
                className="mt-5 inline-flex w-fit rounded-full bg-emerald-800 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-900"
              >
                Read guide
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
          <h2 className="text-lg font-black text-amber-950">Looking for seeds?</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/80">
            Browse the live India catalog and choose products that match your growing space and season.
          </p>
          <Link
            href="/all-products"
            className="mt-4 inline-flex rounded-full border border-amber-300 bg-white px-4 py-2.5 text-xs font-black text-amber-950"
          >
            Browse India Seed Catalog
          </Link>
        </div>
      </section>
    </main>
  );
}
