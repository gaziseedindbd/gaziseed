import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

const BASE_URL = 'https://www.gaziseed.com';
const FALLBACK_SUPABASE_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_vCaz5OGrHocUTgpOXmE9xg_QVsuUJc0';
type IndiaCategory = {
  id: string;
  name_en: string;
  name_bn: string;
  slug: string;
  description: string | null;
  image: string | null;
  display_order: number;
};

type IndiaProduct = {
  id: string;
  name_en: string;
  name_bn: string;
  slug: string;
  image: string | null;
  regular_price: number;
  sale_price: number | null;
  short_description: string | null;
};

function getEnglishText(value: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return value;
  try {
    const parsed = JSON.parse(trimmed) as { en?: string; bn?: string; hi?: string };
    return parsed.en || parsed.bn || parsed.hi || value;
  } catch {
    return value;
  }
}

export const metadata: Metadata = {
  title: 'Premium Seeds Online in India | GAZI SEED India',
  description:
    'Shop quality vegetable, chilli, flower and gardening seeds online in India from GAZI SEED. Explore India-focused seed collections, cultivation guides and convenient delivery.',
  alternates: {
    canonical: BASE_URL + '/india',
  },
  openGraph: {
    title: 'Premium Seeds Online in India | GAZI SEED India',
    description:
      'India-focused seed shopping, cultivation guides and quality seeds from GAZI SEED.',
    url: BASE_URL + '/india',
    siteName: 'GAZI SEED',
    type: 'website',
    locale: 'en_IN',
  },
  robots: {
    index: true,
    follow: true,
  },
};

async function fetchIndiaRows<T>(table: 'categories' | 'products', query: URLSearchParams): Promise<T[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.search = query.toString();

  const request = (key: string) => fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'x-gazi-country': 'IN',
    },
    cache: 'no-store',
  });

  let response = await request(configuredKey || FALLBACK_SUPABASE_KEY);

  if (!response.ok && [401, 403].includes(response.status) && configuredKey !== FALLBACK_SUPABASE_KEY) {
    response = await request(FALLBACK_SUPABASE_KEY);
  }

  if (!response.ok) return [];
  return (await response.json()) as T[];
}

export default async function IndiaLandingPage() {
  const [categories, products] = await Promise.all([
    fetchIndiaRows<IndiaCategory>(
      'categories',
      new URLSearchParams({
        select: 'id,name_en,name_bn,slug,description,image,display_order',
        is_active: 'eq.true',
        country_code: 'eq.IN',
        order: 'display_order.asc',
        limit: '8',
      }),
    ),
    fetchIndiaRows<IndiaProduct>(
      'products',
      new URLSearchParams({
        select: 'id,name_en,name_bn,slug,image,regular_price,sale_price,short_description',
        is_active: 'eq.true',
        country_code: 'eq.IN',
        is_ads_only: 'eq.false',
        order: 'is_featured.desc,created_at.desc',
        limit: '8',
      }),
    ),
  ]);

  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': BASE_URL + '/#organization',
    name: 'GAZI SEED',
    url: BASE_URL + '/',
  };

  const pageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': BASE_URL + '/india#webpage',
    url: BASE_URL + '/india',
    name: 'Premium Seeds Online in India | GAZI SEED India',
    description:
      'India-focused seed shopping and cultivation resources from GAZI SEED.',
    isPartOf: { '@id': BASE_URL + '/#website' },
    about: { '@id': BASE_URL + '/#organization' },
    inLanguage: 'en-IN',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationLd, pageLd]),
        }}
      />

      <main className="min-h-screen bg-[hsl(var(--background))]">
        <section className="border-b border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 text-white">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
            <nav aria-label="Breadcrumb" className="mb-6 text-sm text-emerald-100/80">
              <Link href="/" className="hover:text-white">Home</Link>
              <span className="mx-2">/</span>
              <span>India</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em]">
                GAZI SEED INDIA
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                Premium Seeds Online in India
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
                Explore quality seeds for Indian home gardens, terraces and farming.
                Shop India-focused seed collections with secure payment options and
                dependable pan-India delivery.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/all-products"
                  className="rounded-full bg-white px-5 py-3 text-sm font-black text-emerald-900 shadow-lg transition hover:-translate-y-0.5"
                >
                  Shop Seeds in India
                </Link>
                <Link
                  href="/blog"
                  className="rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Read Growing Guides
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-black text-emerald-950 sm:text-3xl">
              Shop Seeds by Category
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Discover India-available seed categories selected for home gardening,
              terrace growing and practical cultivation.
            </p>
          </div>

          {categories.length > 0 ? (
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="group overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_14px_35px_-28px_rgba(4,62,40,.6)] transition hover:-translate-y-1 hover:border-emerald-300"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-emerald-50">
                    {category.image ? (
                      <Image
                        src={category.image}
                        alt={category.name_en || category.name_bn}
                        width={400}
                        height={300}
                        sizes="(max-width: 640px) 50vw, 25vw"
                        quality={60}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">🌱</div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-black text-emerald-950">
                      {category.name_en || category.name_bn}
                    </h3>
                    {category.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {getEnglishText(category.description)}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 text-sm text-slate-600">
              India seed categories are being updated. Browse all available seeds to continue.
            </div>
          )}
        </section>

        <section className="border-y border-emerald-100 bg-emerald-50/50">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-black text-emerald-950 sm:text-3xl">
                  Popular Seeds Available in India
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  India-available products shown from the live catalog.
                </p>
              </div>
              <Link
                href="/all-products"
                className="text-sm font-black text-emerald-800 hover:text-emerald-950"
              >
                View all seeds →
              </Link>
            </div>

            {products.length > 0 ? (
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {products.map((product) => {
                  const price =
                    product.sale_price && product.sale_price > 0
                      ? product.sale_price
                      : product.regular_price;
                  return (
                    <Link
                      key={product.id}
                      href={`/product/${product.slug}`}
                      className="group overflow-hidden rounded-2xl border border-white bg-white shadow-[0_14px_35px_-28px_rgba(4,62,40,.7)] transition hover:-translate-y-1"
                    >
                      <div className="aspect-square overflow-hidden bg-slate-50">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.name_en || product.name_bn}
                            width={500}
                            height={500}
                            sizes="(max-width: 640px) 50vw, 25vw"
                            quality={60}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">🌱</div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-800">
                          {product.name_en || product.name_bn}
                        </h3>
                        <p className="mt-1 text-sm font-black text-emerald-700">
                          ₹ {Number(price).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-emerald-100 bg-white p-6 text-sm text-slate-600">
                India products are being synced. Use the full seed catalog to continue shopping.
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-emerald-100 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-black text-emerald-950 sm:text-3xl">
                  India Seed & Gardening Guides
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Practical resources for Indian growers, suitable for home gardens, terraces,
                  containers and small growing spaces.
                </p>
              </div>
              <Link
                href="/india/guides"
                className="text-sm font-black text-emerald-800 hover:text-emerald-950"
              >
                View all guides →
              </Link>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {[
                ['Naga Bombay Chili Growing Guide', '/india/guides/naga-bombay-chili-growing-guide'],
                ['Best Seeds for Terrace Gardening in India', '/india/guides/terrace-gardening-seeds-india'],
                ['Red Rose Seed Growing Guide for India', '/india/guides/rose-seeds-india-growing-guide'],
              ].map(([title, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300"
                >
                  <h3 className="font-black text-emerald-950">{title}</h3>
                  <span className="mt-3 inline-flex text-xs font-black text-emerald-800">
                    Read guide →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Quality Seeds', 'Selected seed products with practical cultivation information.'],
              ['India-Friendly Checkout', 'Secure payments including UPI, cards and COD where available.'],
              ['Pan-India Delivery', 'Convenient delivery support for customers across India.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-[0_14px_35px_-28px_rgba(4,62,40,.55)]">
                <h2 className="text-lg font-black text-emerald-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-emerald-100 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 text-center sm:px-8 sm:py-16">
            <h2 className="text-2xl font-black text-emerald-950">
              Grow Better with GAZI SEED India
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Find seeds, explore cultivation guides and choose products for your next garden or crop.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/all-products"
                className="rounded-full bg-emerald-800 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-900"
              >
                Browse India Seed Catalog
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-900"
              >
                Contact GAZI SEED
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
