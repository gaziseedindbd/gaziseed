import { cache } from 'react';
import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  cleanSeoDescription,
  getSeoCountry,
  localizedSeoText,
  pageMetadata,
  SITE_URL,
} from '@/lib/seo-metadata';
import ProductDetailClientPage from './client-page';

type PageProps = { params: Promise<{ slug: string }> };
type SeoProduct = {
  name_bn: string | null;
  name_en: string | null;
  slug: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  regular_price: number | null;
  sale_price: number | null;
  image: string | null;
  images: string[] | null;
  stock: number | null;
  brand: string | null;
  seo_title: string | null;
  meta_description: string | null;
};
type SeoVariant = {
  regular_price: number | null;
  sale_price: number | null;
  stock: number | null;
};

const getProductSeoData = cache(async (slug: string, country: 'BD' | 'IN') => {
  const supabase = await createServerSupabase(country);
  const { data: product } = await supabase
    .from('products')
    .select('name_bn,name_en,slug,sku,short_description,description,regular_price,sale_price,image,images,stock,brand,is_active,is_ads_only,country_code,seo_title,meta_description')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .eq('is_ads_only', false)
    .maybeSingle();

  if (!product) return { product: null, variant: null as SeoVariant | null };
  const { data: variant } = await supabase
    .from('product_variants')
    .select('regular_price,sale_price,stock')
    .eq('product_id', product.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  return { product: product as SeoProduct, variant: variant as SeoVariant | null };
});

function absoluteImageUrl(value?: string | null) {
  if (!value) return undefined;
  return /^https?:\/\//i.test(value)
    ? value
    : `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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

  const productName = country === 'IN'
    ? product.name_en || product.name_bn || 'Seeds'
    : product.name_bn || product.name_en || 'বীজ';
  const title = localizedSeoText(product.seo_title, country, productName);
  const description = cleanSeoDescription(
    localizedSeoText(product.meta_description || product.short_description || product.description, country, productName),
    productName,
  );
  const image = Array.isArray(product.images) && product.images.length ? product.images[0] : product.image;

  return pageMetadata({
    title,
    description,
    image,
    path: canonicalPath,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const country = await getSeoCountry();
  const { product, variant } = await getProductSeoData(slug, country);

  if (!product) return <ProductDetailClientPage />;

  const regularPrice = Number(variant?.regular_price ?? product.regular_price ?? 0);
  const salePrice = Number(variant?.sale_price ?? product.sale_price ?? 0);
  const price = salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
  const stock = Number(variant?.stock ?? product.stock ?? 0);
  const imageValues = Array.isArray(product.images) && product.images.length
    ? product.images
    : product.image ? [product.image] : [];
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: country === 'IN' ? product.name_en || product.name_bn : product.name_bn || product.name_en,
    image: imageValues.map(absoluteImageUrl).filter(Boolean),
    description: cleanSeoDescription(
      localizedSeoText(product.meta_description || product.short_description || product.description, country, product.name_en || product.name_bn || ''),
      product.name_en || product.name_bn || '',
      500,
    ),
    ...(product.sku ? { sku: product.sku } : {}),
    offers: price > 0 ? {
      '@type': 'Offer',
      url: `${SITE_URL}/product/${encodeURIComponent(slug)}`,
      price: price.toFixed(2),
      priceCurrency: country === 'IN' ? 'INR' : 'BDT',
      availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <ProductDetailClientPage />
    </>
  );
}
