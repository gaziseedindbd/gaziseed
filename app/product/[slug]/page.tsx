import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { formatMoney } from '@/lib/country';
import AddToCart from '@/components/AddToCart';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const s = await createClient();
  const { data: p } = await s
    .from('products')
    .select('name_en,name_bn,short_description,product_images(optimized_url,source_url,sort_order)')
    .eq('slug', slug)
    .eq('country', country)
    .eq('active', true)
    .maybeSingle();

  if (!p) return { title: 'Product | SEED BARI' };

  const title = p.name_en || p.name_bn;
  const description = p.short_description || 'Premium quality seeds from SEED BARI.';
  const images = (p.product_images ?? [])
    .slice()
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((image: any) => image.optimized_url || image.source_url)
    .filter(Boolean);

  return {
    title: `${title} | SEED BARI`,
    description,
    openGraph: {
      title,
      description,
      ...(images[0] ? { images: [images[0]] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country: CountryCode = await getStoreCountry('BD');
  const s = await createClient();
  const { data: p } = await s
    .from('products')
    .select('id,name_en,name_bn,slug,sku,regular_price,sale_price,stock,short_description,description_bn,description_en,product_images(id,optimized_url,source_url,sort_order),product_variants(id,name,price,sale_price,stock,sku,active)')
    .eq('slug', slug)
    .eq('country', country)
    .eq('active', true)
    .maybeSingle();

  if (!p) notFound();

  const price = Number(p.sale_price ?? p.regular_price ?? 0);
  const regularPrice = Number(p.regular_price ?? 0);
  const hasDiscount = regularPrice > price;
  const images = (p.product_images ?? [])
    .slice()
    .sort((a: any, b: any) => a.sort_order - b.sort_order);
  const image = images[0]?.optimized_url || images[0]?.source_url;
  const isBangladesh = country === 'BD';
  const variants = (p.product_variants ?? [])
    .filter((variant: any) => variant.active !== false)
    .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name_en || p.name_bn || 'SEED BARI Product',
    sku: p.sku || undefined,
    description: p.short_description || undefined,
    image: image ? [image] : undefined,
    brand: {
      '@type': 'Brand',
      name: 'SEED BARI',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: country === 'BD' ? 'BDT' : 'INR',
      price: price.toFixed(2),
      availability:
        variants.length > 0
          ? variants.some((variant: any) => Number(variant.stock ?? 0) > 0)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock'
          : p.stock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <div className="mx-auto grid max-w-6xl gap-8 rounded-3xl border bg-white p-6 md:grid-cols-2 md:p-10">
        <div className="relative flex min-h-96 items-center justify-center overflow-hidden rounded-2xl bg-[#edf5e9]">
          {image ? (
            <Image
              src={image}
              alt={p.name_en || p.name_bn || 'SEED BARI seed product'}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain p-6"
            />
          ) : (
            <span className="text-8xl" aria-hidden="true">🌱</span>
          )}
        </div>

        <div>
          <p className="font-bold text-[#1f6b3b]">{isBangladesh ? 'SEED BARI BANGLADESH' : 'SEED BARI INDIA'}</p>
          <h1 className="mt-2 text-4xl font-black">{p.name_en || p.name_bn}</h1>
          <p className="mt-3 text-gray-600">{p.short_description}</p>

          <div className="mt-6 flex items-baseline gap-3">
            <div className="text-3xl font-black text-[#1f6b3b]">{formatMoney(price, country)}</div>
            {hasDiscount ? (
              <div className="text-lg text-gray-400 line-through">{formatMoney(regularPrice, country)}</div>
            ) : null}
          </div>

          <p className="mt-2 text-sm">Stock: {p.stock > 0 ? `${p.stock} available` : 'Out of stock'}</p>

          {variants.length ? (
            <div className="mt-6 space-y-3">
              <h2 className="text-lg font-bold">Choose a variant</h2>
              {variants.map((variant: any) => {
                const variantPrice = Number(variant.sale_price ?? variant.price ?? 0);
                const variantStock = Number(variant.stock ?? 0);
                return (
                  <div key={variant.id} className="flex items-center justify-between gap-4 rounded-2xl border p-4">
                    <div>
                      <p className="font-bold">{variant.name || 'Variant'}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {formatMoney(variantPrice, country)} · {variantStock > 0 ? `${variantStock} available` : 'Out of stock'}
                      </p>
                    </div>
                    {variantStock > 0 ? (
                      <AddToCart productId={p.id} variantId={variant.id} />
                    ) : (
                      <span className="rounded-xl border px-4 py-2 text-sm font-bold text-gray-400">Out of stock</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : p.stock > 0 ? (
            <div className="mt-6">
              <AddToCart productId={p.id} />
            </div>
          ) : (
            <div className="mt-6">
              <span className="inline-block rounded-xl border px-5 py-3 font-bold text-gray-400">Out of stock</span>
            </div>
          )}

          <div className="prose mt-8 max-w-none">
            <p>{isBangladesh ? p.description_bn || p.description_en : p.description_en || p.description_bn}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
