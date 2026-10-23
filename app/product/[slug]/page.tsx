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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const supabase = await createServerSupabase(country);
  const { data: product } = await supabase
    .from('products')
    .select('name_bn,name_en,slug,sku,short_description,description,regular_price,sale_price,image,images,is_active,is_ads_only,country_code,seo_title,meta_description')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .eq('is_ads_only', false)
    .maybeSingle();

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
  const rawDescription = localizedSeoText(
    product.meta_description || product.short_description || product.description,
    country,
    productName,
  );
  const description = cleanSeoDescription(rawDescription, productName);
  const image = Array.isArray(product.images) && product.images.length
    ? product.images[0]
    : product.image;

  return pageMetadata({
    title,
    description,
    image,
    path: canonicalPath,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default function ProductDetailPage() {
  return <ProductDetailClientPage />;
}
