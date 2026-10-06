import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = 'https://www.gaziseed.com';

export const metadata: Metadata = {
  title: 'Naga Bombay Chili Growing Guide for India | GAZI SEED',
  description:
    'Practical Naga Bombay chili growing guide for Indian home gardens, rooftops, pots and grow bags, with seed-starting and care basics.',
  alternates: { canonical: BASE_URL + '/india/guides/naga-bombay-chili-growing-guide' },
  openGraph: {
    title: 'Naga Bombay Chili Growing Guide for India',
    description: 'Practical seed-starting and care basics for Indian growers.',
    url: BASE_URL + '/india/guides/naga-bombay-chili-growing-guide',
    siteName: 'GAZI SEED',
    type: 'article',
    locale: 'en_IN',
  },
  robots: { index: true, follow: true },
};

export default function NagaBombayChiliGuide() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Naga Bombay Chili Growing Guide for India',
    description: 'Practical seed-starting and care basics for Indian growers.',
    mainEntityOfPage: BASE_URL + '/india/guides/naga-bombay-chili-growing-guide',
    author: { '@type': 'Organization', name: 'GAZI SEED' },
    publisher: { '@type': 'Organization', name: 'GAZI SEED', url: BASE_URL },
  };

  return (
    <main className="min-h-screen bg-[hsl(var(--background))]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
          <Link href="/india" className="text-emerald-800 hover:text-emerald-950">GAZI SEED India</Link>
          <span className="mx-2">/</span>
          <Link href="/india/guides" className="text-emerald-800 hover:text-emerald-950">Guides</Link>
          <span className="mx-2">/</span>
          <span>Naga Bombay Chili</span>
        </nav>

        <header>
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-emerald-800">
            India Chili Guide
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-emerald-950 sm:text-5xl">
            Naga Bombay Chili Growing Guide for India
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
            A practical starting guide for growers using pots, grow bags, rooftops and home gardens.
          </p>
        </header>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-slate-700">
          <section>
            <h2 className="text-2xl font-black text-emerald-950">1. Start with good seed and a suitable container</h2>
            <p className="mt-3">
              Naga Bombay chili is listed in the GAZI SEED India catalog as a hot chili variety.
              For a home setup, begin with a clean seed tray or a small container, then move healthy
              seedlings into a larger pot or grow bag once they are established.
            </p>
            <p className="mt-3">
              See the <Link href="/product/naga-bombay-chili-seeds" className="font-black text-emerald-800 underline decoration-emerald-300 underline-offset-4">
                Naga Bombay Chili Seeds
              </Link> product page for current India availability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">2. Use well-drained growing media</h2>
            <p className="mt-3">
              Use a loose growing medium that drains excess water quickly. Avoid keeping the seed
              bed waterlogged. Gentle, even moisture is more useful during germination than repeated heavy watering.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">3. Give the plants strong sunlight</h2>
            <p className="mt-3">
              Chili plants generally perform best when they receive plenty of light. A bright
              rooftop, balcony or open garden spot is usually more suitable than a dark indoor corner.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">4. Keep moisture consistent</h2>
            <p className="mt-3">
              Water according to the container, weather and soil condition. Let excess water drain out
              rather than leaving roots sitting in standing water.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-emerald-950">5. Move seedlings carefully</h2>
            <p className="mt-3">
              When seedlings have developed several true leaves and are strong enough to handle,
              transplant them into their final container. Water after transplanting and protect newly
              moved plants from sudden stress.
            </p>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
            <h2 className="text-xl font-black text-emerald-950">Explore more India seed resources</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/india/guides/terrace-gardening-seeds-india" className="rounded-full bg-white px-4 py-2.5 text-xs font-black text-emerald-900 border border-emerald-200">
                Terrace Gardening Seeds
              </Link>
              <Link href="/india/guides/rose-seeds-india-growing-guide" className="rounded-full bg-white px-4 py-2.5 text-xs font-black text-emerald-900 border border-emerald-200">
                Rose Seed Guide
              </Link>
              <Link href="/india" className="rounded-full bg-emerald-800 px-4 py-2.5 text-xs font-black text-white">
                GAZI SEED India
              </Link>
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
