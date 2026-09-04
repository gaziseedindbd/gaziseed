import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getActiveProducts } from '@/lib/products';
import { formatMoney } from '@/lib/country';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

const catalogCopy: Record<CountryCode, { eyebrow: string; title: string; description: string; emptyTitle: string; emptyText: string; currencyLabel: string; seoDescription: string }> = {
  BD: {
    eyebrow: 'SEED BARI SHOP',
    title: 'Every seed you need to grow better',
    description: 'Bangladesh catalog with prices in ৳.',
    emptyTitle: 'Products are coming soon',
    emptyText: 'Add active Bangladesh products from the admin panel to publish them here.',
    currencyLabel: 'BDT',
    seoDescription: 'Shop quality seeds from SEED BARI for growers in Bangladesh. Browse active varieties and prices in Bangladeshi Taka.',
  },
  IN: {
    eyebrow: 'SEED BARI INDIA',
    title: 'Quality seeds for every grower',
    description: 'India catalog with prices in ₹.',
    emptyTitle: 'Products are coming soon',
    emptyText: 'Add active India products from the admin panel to publish them here.',
    currencyLabel: 'INR',
    seoDescription: 'Shop quality seeds from SEED BARI for growers in India. Browse active varieties and prices in Indian Rupees.',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const country = await getStoreCountry('BD');
  const copy = catalogCopy[country];

  return {
    title: `${copy.eyebrow} | SEED BARI`,
    description: copy.seoDescription,
    alternates: {
      canonical: '/shop',
    },
    openGraph: {
      title: `${copy.eyebrow} | SEED BARI`,
      description: copy.seoDescription,
      type: 'website',
    },
  };
}

export default async function ShopPage() {
  const country = await getStoreCountry('BD');
  const copy = catalogCopy[country];
  const { data, error } = await getActiveProducts(country);
  const products = data ?? [];

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="font-bold text-[#1f6b3b]">{copy.eyebrow}</p>
          <h1 className="text-4xl font-black">{copy.title}</h1>
          <p className="mt-2 text-gray-600">{copy.description} · {copy.currencyLabel}</p>
        </div>

        {error ? (
          <div className="rounded-2xl border bg-white p-6 text-red-600">Unable to load products right now.</div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <h2 className="text-xl font-bold">{copy.emptyTitle}</h2>
            <p className="mt-2 text-gray-500">{copy.emptyText}</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p: any) => {
              const image = p.product_images?.[0];
              const imageUrl = image?.optimized_url || image?.source_url;
              const price = Number(p.sale_price ?? p.regular_price ?? 0);
              const regularPrice = Number(p.regular_price ?? 0);
              const hasDiscount = regularPrice > price;

              return (
                <Link
                  href={`/product/${p.slug}`}
                  key={p.id}
                  className="group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative flex h-56 items-center justify-center bg-[#edf5e9]">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={p.name_en || p.name_bn || 'SEED BARI seed product'}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-contain p-4 transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-6xl" aria-hidden="true">🌱</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold">{p.name_en || p.name_bn}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                      {p.short_description || 'Premium quality seed variety'}
                    </p>
                    <div className="mt-4 flex items-baseline gap-2">
                      <strong className="text-xl text-[#1f6b3b]">{formatMoney(price, country)}</strong>
                      {hasDiscount ? (
                        <span className="text-sm text-gray-400 line-through">{formatMoney(regularPrice, country)}</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
