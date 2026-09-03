import Link from 'next/link';
import { getActiveProducts } from '@/lib/products';
import { formatMoney } from '@/lib/country';

export default async function ShopPage() {
  const country = 'BD' as const;
  const { data, error } = await getActiveProducts(country);
  const products = data ?? [];
  return <main className="min-h-screen bg-[#f7f8f4] px-4 py-10"><div className="mx-auto max-w-7xl"><div className="mb-8"><p className="font-bold text-[#1f6b3b]">GAZI SEED SHOP</p><h1 className="text-4xl font-black">Seeds for every grower</h1><p className="mt-2 text-gray-600">Bangladesh catalog • Prices in ৳</p></div>{error ? <div className="rounded-2xl border bg-white p-6 text-red-600">Unable to load products right now.</div> : products.length === 0 ? <div className="rounded-2xl border bg-white p-10 text-center"><h2 className="text-xl font-bold">Products are coming soon</h2><p className="mt-2 text-gray-500">Add products from the GAZI SEED admin panel to publish them here.</p></div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((p: any) => <Link href={`/product/${p.slug}`} key={p.id} className="overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg"><div className="flex h-48 items-center justify-center bg-[#edf5e9] text-6xl">🌱</div><div className="p-4"><h2 className="font-bold">{p.name_en || p.name_bn}</h2><p className="mt-2 text-sm text-gray-500">{p.short_description || 'Premium quality seed variety'}</p><strong className="mt-4 block text-xl text-[#1f6b3b]">{formatMoney(Number(p.sale_price ?? p.regular_price ?? 0), country)}</strong></div></Link>)}</div>}</div></main>;
}
