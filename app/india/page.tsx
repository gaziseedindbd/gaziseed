import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getSeoLanguage } from '@/lib/seo-metadata';

const BASE_URL = 'https://www.gaziseed.com';
const INDIA_SOCIAL_IMAGE = `https://wsrv.nl/?url=${encodeURIComponent(`${BASE_URL}/gazi-seed-official-logo-web.svg`)}&w=1200&h=630&fit=cover&cbg=ffffff&output=jpg&q=88`;
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

function getLocalizedText(value: string | null, language: 'bn' | 'en' | 'hi'): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return value;
  try {
    const parsed = JSON.parse(trimmed) as { en?: string; bn?: string; hi?: string };
    return parsed[language] || parsed.en || parsed.bn || parsed.hi || value;
  } catch {
    return value;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const language = await getSeoLanguage('IN');
  const localizedMetadata = {
    en: {
      title: 'Premium Seeds Online in India | GAZI SEED India',
      description: 'Shop vegetable, chilli, flower and gardening seeds online in India from GAZI SEED. Explore seed collections and growing guides. Check delivery and payment availability for your PIN code at checkout.',
    },
    bn: {
      title: 'ভারতে অনলাইনে উন্নত মানের বীজ | GAZI SEED India',
      description: 'GAZI SEED থেকে ভারতে সবজি, মরিচ, ফুল ও বাগানের বীজ কিনুন। চাষের গাইড দেখুন এবং চেকআউটে PIN কোড দিয়ে ডেলিভারি ও পেমেন্ট যাচাই করুন।',
    },
    hi: {
      title: 'भारत में ऑनलाइन प्रीमियम बीज | GAZI SEED India',
      description: 'GAZI SEED से भारत में सब्ज़ियों, मिर्च, फूलों और बागवानी के बीज खरीदें। चेकआउट पर PIN कोड से डिलीवरी और भुगतान विकल्प देखें।',
    },
  }[language];
  return {
    title: localizedMetadata.title,
    description: localizedMetadata.description,
    alternates: {
      canonical: BASE_URL + '/india',
      languages: {
        'en-IN': BASE_URL + '/india',
        'bn-BD': BASE_URL + '/',
        'x-default': BASE_URL + '/',
      },
    },
    openGraph: {
      title: localizedMetadata.title,
      description: localizedMetadata.description,
      url: BASE_URL + '/india',
      siteName: 'GAZI SEED',
      type: 'website',
      locale: `${language}_IN`,
      images: [{
        url: INDIA_SOCIAL_IMAGE,
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: 'GAZI SEED official logo',
      }],
    },
    robots: { index: true, follow: true },
  };
}

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
  const language = await getSeoLanguage('IN');
  const tx = (en: string, bn: string, hi = en) => language === 'bn' ? bn : language === 'hi' ? hi : en;
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
    name: tx('Premium Seeds Online in India | GAZI SEED India', 'ভারতে অনলাইনে উন্নত মানের বীজ | GAZI SEED India', 'भारत में ऑनलाइन प्रीमियम बीज | GAZI SEED India'),
    description: tx('India-focused seed shopping and cultivation resources from GAZI SEED.', 'GAZI SEED থেকে ভারতে বীজ কিনুন এবং চাষের গাইড দেখুন।', 'GAZI SEED से भारत में बीज खरीदें और खेती के उपयोगी गाइड देखें।'),
    isPartOf: { '@id': BASE_URL + '/#website' },
    about: { '@id': BASE_URL + '/#organization' },
    inLanguage: `${language}-IN`,
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
              <Link href="/" className="hover:text-white">{tx('Home', 'হোম', 'होम')}</Link>
              <span className="mx-2">/</span>
              <span>India</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em]">
                GAZI SEED INDIA
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                {tx('Premium Seeds Online in India', 'ভারতে উন্নত মানের বীজ অনলাইনে', 'भारत में प्रीमियम बीज ऑनलाइन')}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
                {tx('Explore quality seeds for Indian home gardens, terraces and farming. Explore India-focused seed collections and cultivation guides. Check payment methods and delivery availability for your PIN code at checkout.', 'ভারতের বাড়ির বাগান, ছাদ ও খামারের জন্য মানসম্মত বীজ দেখুন। চাষের গাইড পড়ুন এবং চেকআউটে PIN কোড দিয়ে ডেলিভারি ও পেমেন্ট যাচাই করুন।', 'भारत के घरों, छतों और खेतों के लिए अच्छे बीज देखें। खेती के गाइड पढ़ें और चेकआउट पर PIN कोड से डिलीवरी व भुगतान विकल्प जाँचें।')}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/all-products"
                  className="rounded-full bg-white px-5 py-3 text-sm font-black text-emerald-900 shadow-lg transition hover:-translate-y-0.5"
                >
                  {tx('Shop Seeds in India', 'ভারতের বীজ দেখুন', 'भारत के बीज देखें')}
                </Link>
                <Link
                  href="/blog"
                  className="rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  {tx('Read Growing Guides', 'চাষের গাইড পড়ুন', 'खेती के गाइड पढ़ें')}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-black text-emerald-950 sm:text-3xl">
              {tx('Shop Seeds by Category', 'ক্যাটাগরি অনুযায়ী বীজ দেখুন', 'श्रेणी के अनुसार बीज देखें')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              {tx('Discover India-available seed categories selected for home gardening, terrace growing and practical cultivation.', 'বাড়ির বাগান, ছাদে চাষ ও ব্যবহারিক চাষের জন্য ভারতে পাওয়া যায় এমন বীজের ক্যাটাগরি দেখুন।', 'घर, छत और खेती के लिए भारत में उपलब्ध बीजों की श्रेणियाँ देखें।')}
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
                        alt={language === 'bn' ? category.name_bn || category.name_en : category.name_en || category.name_bn}
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
                      {language === 'bn' ? category.name_bn || category.name_en : category.name_en || category.name_bn}
                    </h3>
                    {category.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {getLocalizedText(category.description, language)}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 text-sm text-slate-600">
              {tx('India seed categories are being updated. Browse all available seeds to continue.', 'ভারতের বীজের ক্যাটাগরি আপডেট হচ্ছে। আপাতত সব বীজ দেখুন।', 'भारत की बीज श्रेणियाँ अपडेट हो रही हैं। अभी सभी बीज देखें।')}
            </div>
          )}
        </section>

        <section className="border-y border-emerald-100 bg-emerald-50/50">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-black text-emerald-950 sm:text-3xl">
                  {tx('Popular Seeds Available in India', 'ভারতে পাওয়া জনপ্রিয় বীজ', 'भारत में उपलब्ध लोकप्रिय बीज')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {tx('India-available products shown from the live catalog.', 'লাইভ ক্যাটালগে থাকা ভারতের পণ্যগুলো এখানে দেখানো হয়েছে।', 'लाइव कैटलॉग में उपलब्ध भारत के उत्पाद यहाँ दिखाए गए हैं।')}
                </p>
              </div>
              <Link
                href="/all-products"
                className="text-sm font-black text-emerald-800 hover:text-emerald-950"
              >
                {tx('View all seeds →', 'সব বীজ দেখুন →', 'सभी बीज देखें →')}
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
                      href={`/in/product/${product.slug}`}
                      className="group overflow-hidden rounded-2xl border border-white bg-white shadow-[0_14px_35px_-28px_rgba(4,62,40,.7)] transition hover:-translate-y-1"
                    >
                      <div className="aspect-square overflow-hidden bg-slate-50">
                        {product.image ? (
                          <Image
                            src={product.image}
                          alt={language === 'bn' ? product.name_bn || product.name_en : product.name_en || product.name_bn}
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
                          {language === 'bn' ? product.name_bn || product.name_en : product.name_en || product.name_bn}
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
                {tx('India products are being synced. Use the full seed catalog to continue shopping.', 'ভারতের পণ্য সিঙ্ক হচ্ছে। সব বীজের ক্যাটালগে গিয়ে কেনাকাটা চালিয়ে যান।', 'भारत के उत्पाद सिंक हो रहे हैं। खरीदारी के लिए पूरा बीज कैटलॉग देखें।')}
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-emerald-100 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-black text-emerald-950 sm:text-3xl">
                  {tx('India Seed & Gardening Guides', 'ভারতের বীজ ও বাগান গাইড', 'भारत के बीज और बागवानी गाइड')}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  {tx('Practical resources for Indian growers, suitable for home gardens, terraces, containers and small growing spaces.', 'বাড়ির বাগান, ছাদ, টব ও ছোট পরিসরে চাষের জন্য ভারতের চাষিদের ব্যবহারিক গাইড।', 'घर, छत, गमलों और छोटे स्थानों में खेती के लिए भारतीय उत्पादकों के उपयोगी गाइड।')}
                </p>
              </div>
              <Link
                href="/india/guides"
                className="text-sm font-black text-emerald-800 hover:text-emerald-950"
              >
                {tx('View all guides →', 'সব গাইড দেখুন →', 'सभी गाइड देखें →')}
              </Link>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {[
                [tx('Naga Bombay Chili Growing Guide', 'নাগা বোম্বে মরিচ চাষের গাইড', 'नागा बॉम्बे मिर्च उगाने की गाइड'), '/india/guides/naga-bombay-chili-growing-guide'],
                [tx('Best Seeds for Terrace Gardening in India', 'ভারতে ছাদবাগানের জন্য সেরা বীজ', 'भारत में छत पर बागवानी के लिए अच्छे बीज'), '/india/guides/terrace-gardening-seeds-india'],
                [tx('Red Rose Seed Growing Guide for India', 'ভারতে লাল গোলাপের বীজ চাষের গাইড', 'भारत में लाल गुलाब के बीज उगाने की गाइड'), '/india/guides/rose-seeds-india-growing-guide'],
              ].map(([title, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300"
                >
                  <h3 className="font-black text-emerald-950">{title}</h3>
                  <span className="mt-3 inline-flex text-xs font-black text-emerald-800">
                    {tx('Read guide →', 'গাইড পড়ুন →', 'गाइड पढ़ें →')}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [tx('Quality Seeds', 'মানসম্মত বীজ', 'अच्छे बीज'), tx('Selected seed products with practical cultivation information.', 'চাষের ব্যবহারিক তথ্যসহ বাছাই করা বীজ।', 'खेती की उपयोगी जानकारी के साथ चुने गए बीज।')],
              [tx('Payment Options', 'পেমেন্টের বিকল্প', 'भुगतान विकल्प'), tx('See available payment methods, including COD where offered, at checkout.', 'চেকআউটে উপলভ্য পেমেন্ট পদ্ধতি দেখুন; যেখানে আছে COD-ও থাকবে।', 'चेकआउट पर उपलब्ध भुगतान विकल्प देखें; जहाँ उपलब्ध हो वहाँ COD भी।')],
              [tx('Delivery Availability', 'ডেলিভারি সুবিধা', 'डिलीवरी उपलब्धता'), tx('Check delivery availability and estimated timing for your PIN code at checkout.', 'চেকআউটে আপনার PIN কোডের ডেলিভারি সুবিধা ও আনুমানিক সময় দেখুন।', 'चेकआउट पर अपने PIN कोड के लिए डिलीवरी उपलब्धता और अनुमानित समय देखें।')],
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
              {tx('Grow Better with GAZI SEED India', 'GAZI SEED India-এর সঙ্গে আরও ভালো চাষ করুন', 'GAZI SEED India के साथ बेहतर उगाएँ')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {tx('Find seeds, explore cultivation guides and choose products for your next garden or crop.', 'বীজ খুঁজুন, চাষের গাইড দেখুন এবং পরের বাগান বা ফসলের জন্য পণ্য বেছে নিন।', 'बीज खोजें, खेती के गाइड देखें और अपने अगले बगीचे या फसल के लिए उत्पाद चुनें।')}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/all-products"
                className="rounded-full bg-emerald-800 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-900"
              >
                {tx('Browse India Seed Catalog', 'ভারতের বীজের ক্যাটালগ দেখুন', 'भारत का बीज कैटलॉग देखें')}
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-900"
              >
                {tx('Contact GAZI SEED', 'GAZI SEED-এ যোগাযোগ করুন', 'GAZI SEED से संपर्क करें')}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
