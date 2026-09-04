import Link from 'next/link';
import { getActiveProducts } from '@/lib/products';
import { formatMoney } from '@/lib/country';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

const catalogCopy: Record<CountryCode, { eyebrow: string; title: string; description: string; emptyTitle: string; emptyText: string; currencyLabel: string }> = {
  BD: {
    eyebrow: 'SEED BARI SHOP',
    title: 'Every seed you need to grow better',
    description: 'Bangladesh catalog with prices in ৳.',
    emptyTitle: 'Products are coming soon',
    emptyText: 'Add active Bangladesh products from the admin panel to publish them here.',
    currencyLabel: 'BDT',
  },
  IN: {
    eyebrow: 'SEED BARI INDIA',
    title: 'Quality seeds for every grower',
    description: 'India catalog with prices in ₹.',
    emptyTitle: 'Products are coming soon',
    emptyText: 'Add active India products from the admin panel to publish them here.',
    currencyLabel: 'INR',
  },
};

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
              const image = p.product_images?.[0]?.optimized_url || p.product_images?.[0]?.source_url;
              const displayName = country === 'BD' ? p.name_bn || p.name_en : p.name_en || p.name_bn;

              return (
                <Link
                  href={`/product/${p.slug}`}
                  key={p.id}
                  className="group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex h-56 items-center justify-center overflow-hidden bg-[#edf5e9]">
                    {image ? (
                      <img
                        src={image}
                        alt={displayName}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-6xl" aria-hidden="true">🌱</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold text-gray-900">{displayName}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                      {p.short_description || 'Premium quality seed variety'}
                    </p>
                    <strong className="mt-4 block text-xl text-[#1f6b3b]">
                      {formatMoney(Number(p.sale_price ?? p.regular_price ?? 0), country)}
                    </strong>
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
