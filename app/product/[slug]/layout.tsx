import type { Metadata } from 'next';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufxsthshyebahkwbmioe.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_vCaz5OGrHocUTgpOXmE9xg_QVsuUJc0';

type ProductSeo = {
  id: string;
  name_bn?: string | null;
  name_en?: string | null;
  name?: string | null;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  image?: string | null;
  images?: string[] | null;
  image_alt?: string | null;
  image_alt_bn?: string | null;
  sku?: string | null;
  regular_price?: number | null;
  sale_price?: number | null;
  price?: number | null;
  offer_price?: number | null;
  stock?: number | null;
  is_active?: boolean | null;
  brand?: string | null;
  category_id?: string | null;
};

async function getProduct(slug: string): Promise<ProductSeo | null> {
  const url = new URL('/rest/v1/products', SUPABASE_URL);
  url.searchParams.set('select', 'id,name_bn,name_en,name,slug,description,short_description,seo_title,meta_description,image,images,image_alt,image_alt_bn,sku,regular_price,sale_price,price,offer_price,stock,is_active,brand,category_id');
  url.searchParams.set('slug', `eq.${slug}`);
  url.searchParams.set('is_active', 'eq.true');
  url.searchParams.set('limit', '1');

  try {
    const res = await fetch(url.toString(), {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as ProductSeo[];
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};

  const name = product.name_bn || product.name_en || product.name || 'GAZI SEED Product';
  const title = product.seo_title?.trim() || `${name} | GAZI SEED`;
  const description = product.meta_description?.trim() || product.short_description?.trim() || product.description?.trim() || `${name} - GAZI SEED থেকে বীজ ও কৃষি পণ্য অর্ডার করুন।`;
  const image = product.image || product.images?.[0] || '/favicon.svg?v=3';
  const url = `https://www.gaziseed.com/product/${encodeURIComponent(product.slug)}`;

  return {
    title,
    description: description.slice(0, 160),
    alternates: { canonical: url },
    robots: product.is_active ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'website',
      url,
      title,
      description: description.slice(0, 160),
      siteName: 'GAZI SEED',
      images: [{ url: image, alt: product.image_alt_bn || product.image_alt || name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description.slice(0, 160),
      images: [image],
    },
  };
}

export default async function ProductSeoLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const product = await getProduct(slug);

  if (!product) return <>{children}</>;

  const name = product.name_bn || product.name_en || product.name || 'GAZI SEED Product';
  const description = (product.meta_description || product.short_description || product.description || `${name} - GAZI SEED`).slice(0, 160);
  const image = product.image || product.images?.[0] || '/favicon.svg?v=3';
  const url = `https://www.gaziseed.com/product/${encodeURIComponent(product.slug)}`;
  const regular = Number(product.regular_price || product.price || 0);
  const sale = Number(product.sale_price || product.offer_price || regular);
  const price = sale > 0 ? sale : regular;
  const availability = Number(product.stock || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    sku: product.sku || undefined,
    brand: { '@type': 'Brand', name: product.brand || 'GAZI SEED' },
    image: product.images?.length ? product.images : [image],
    url,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'BDT',
      price: price > 0 ? price.toFixed(2) : undefined,
      availability,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'GAZI SEED', url: 'https://www.gaziseed.com' },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
