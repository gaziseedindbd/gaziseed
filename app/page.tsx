import Link from 'next/link';
import { getActiveProducts } from '@/lib/products';
import { formatMoney } from '@/lib/country';

export default async function HomePage() {
  const country = 'BD' as const;
  const { data, error } = await getActiveProducts(country);
  const products = (data ?? []).slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-3xl border bg-white p-8 md:p-12">
          <p className="font-bold text-[#1f6b3b]">GAZI SEED</p>
          <h1 className="mt-2 text-4xl font-black md:text-6xl">Quality seeds for every grower</h1>
          <p className="mt-4 max-w-2xl text-gray-600">Shop our Bangladesh catalog and order genuine seed varieties with convenient delivery.</p>
          <Link href="/shop" className="mt-6 inline-block rounded-xl bg-[#1f6b3b] px-6 py-3 font-bold text-white">Shop All Products</Link>
        </section>

        <section className="mt-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="font-bold text-[#1f6b3b]">FEATURED PRODUCTS</p>
              <h2 className="text-3xl font-black">Shop our latest seeds</h2>
            </div>
            <Link href="/shop" className="font-bold text-[#1f6b3b]">View all →</Link>
          </div>

          {error ? (
            <div className="rounded-2xl border bg-white p-6 text-red-600">Unable to load products right now.</div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border bg-white p-10 text-center">
              <h3 className="text-xl font-bold">Products are coming soon</h3>
              <p className="mt-2 text-gray-500">Add active products from the GAZI SEED admin panel to publish them here.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((p: any) => (
                <Link href={`/product/${p.slug}`} key={p.id} className="overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex h-48 items-center justify-center bg-[#edf5e9] text-6xl">
                    {p.product_images?.length ? (
                      <img src={p.product_images.slice().sort((a: any, b: any) => a.sort_order - b.sort_order)[0]?.optimized_url || p.product_images[0]?.source_url} alt={p.name_en || p.name_bn} className="h-full w-full object-contain" />
                    ) : '🌱'}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold">{p.name_en || p.name_bn}</h3>
                    <p className="mt-2 text-sm text-gray-500">{p.short_description || 'Premium quality seed variety'}</p>
                    <strong className="mt-4 block text-xl text-[#1f6b3b]">{formatMoney(Number(p.sale_price ?? p.regular_price ?? 0), country)}</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
