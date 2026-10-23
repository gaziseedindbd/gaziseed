import { cache } from 'react';
import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { cleanSeoDescription, getSeoCountry, localizedSeoText, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

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
  sku?: string | null;
  regular_price?: number | null;
  sale_price?: number | null;
  stock?: number | null;
  is_active?: boolean | null;
  brand?: string | null;
};
type ProductVariantSeo = {
  regular_price?: number | null;
  sale_price?: number | null;
  stock?: number | null;
};

const getProductSeoData = cache(async (slug: string, country: 'BD' | 'IN') => {
  const supabase = await createServerSupabase(country);
  const { data: product } = await supabase
    .from('products')
    .select('id,name_bn,name_en,name,slug,description,short_description,seo_title,meta_description,image,images,sku,regular_price,sale_price,stock,is_active,brand,country_code')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  if (!product) return { product: null, variant: null as ProductVariantSeo | null };
  const { data: variant } = await supabase
    .from('product_variants')
    .select('regular_price,sale_price,stock')
    .eq('product_id', product.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  return { product: product as ProductSeo, variant: variant as ProductVariantSeo | null };
});

function absoluteImage(value: string) {
  return /^https?:\/\//i.test(value) ? value : `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const { product } = await getProductSeoData(slug, country);
  const canonicalPath = `/product/${encodeURIComponent(slug)}`;

  if (!product) {
    return {
      title: 'Product unavailable | GAZI SEED',
      robots: { index: false, follow: true },
      alternates: { canonical: canonicalPath },
    };
  }

  const name = country === 'IN'
    ? product.name_en || product.name_bn || product.name || 'Seeds'
    : product.name_bn || product.name_en || product.name || 'বীজ';
  const title = localizedSeoText(product.seo_title, country, name);
  const description = cleanSeoDescription(
    localizedSeoText(product.meta_description || product.short_description || product.description, country, name),
    name,
  );
  const image = product.image || product.images?.[0] || null;

  return pageMetadata({
    title,
    description,
    image,
    path: canonicalPath,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default async function ProductSeoLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const { product, variant } = await getProductSeoData(slug, country);
  if (!product) return <>{children}</>;

  const name = country === 'IN'
    ? product.name_en || product.name_bn || product.name || 'Seeds'
    : product.name_bn || product.name_en || product.name || 'বীজ';
  const description = cleanSeoDescription(
    localizedSeoText(product.meta_description || product.short_description || product.description, country, name),
    name,
    500,
  );
  const imageValues = product.images?.length ? product.images : product.image ? [product.image] : [];
  const url = `${SITE_URL}/product/${encodeURIComponent(product.slug)}`;
  const regular = Number(variant?.regular_price ?? product.regular_price ?? 0);
  const possibleSale = Number(variant?.sale_price ?? product.sale_price ?? 0);
  const price = possibleSale > 0 && possibleSale < regular ? possibleSale : regular;
  const stock = Number(variant?.stock ?? product.stock ?? 0);
  const priceCurrency = country === 'IN' ? 'INR' : 'BDT';

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: country === 'IN' ? 'Home' : 'হোম', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: country === 'IN' ? 'Products' : 'পণ্য', item: `${SITE_URL}/all-products` },
      { '@type': 'ListItem', position: 3, name, item: url },
    ],
  };

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    image: imageValues.map(absoluteImage),
    url,
    inLanguage: country === 'IN' ? 'en-IN' : 'bn-BD',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(price > 0 ? {
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency,
        price: price.toFixed(2),
        availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@type': 'Organization', name: 'GAZI SEED', url: SITE_URL },
      },
    } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {children}
    </>
  );
}
