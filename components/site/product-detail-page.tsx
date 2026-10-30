import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import ProductDetailClient from '@/components/site/product-detail-client';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Product } from '@/lib/supabase/types';

type ProductCountry = 'BD' | 'IN';

const SITE_URL = 'https://www.gaziseed.com';

const getProductForRoute = cache(async (slug: string, country: ProductCountry): Promise<Product | null> => {
  const supabase = await createServerSupabase(country);
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data as Product | null;
});

function isSupabaseProductImage(source: string | undefined): boolean {
  if (!source) return false;
  try {
    const url = new URL(source, SITE_URL);
    return url.protocol === 'https:' &&
      url.hostname.endsWith('.supabase.co') &&
      url.pathname.includes('/storage/v1/object/public/product-images/');
  } catch {
    return false;
  }
}

function getAbsoluteImageUrl(source: string | undefined): string | undefined {
  if (!source) return undefined;
  try {
    const url = new URL(source, SITE_URL);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function firstText(...values: Array<string | null | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

export async function generateProductMetadata(slug: string, country: ProductCountry): Promise<Metadata> {
  const product = await getProductForRoute(slug, country);
  if (!product) return { robots: { index: false, follow: false } };

  // Social crawlers need deterministic metadata without relying on visitor cookies.
  const language = country === 'IN' ? 'en' : 'bn';
  const localized = product.translations?.[language] || {};
  const localizedName = firstText(
    localized.name,
    country === 'IN' ? product.name_en : product.name_bn,
    product.name_en,
    product.name_bn,
  ) || 'GAZI SEED';
  const title = firstText(localized.seo_title, localized.name, product.seo_title, localizedName) || localizedName;
  const description = firstText(
    localized.meta_description,
    localized.short_description,
    product.meta_description,
    product.short_description,
    localized.description,
    product.description,
  ) || title;
  const imageSource = firstText(...(Array.isArray(product.images) ? product.images : []), product.image);
  const generatedJpegImage = isSupabaseProductImage(imageSource);
  const imageUrl = imageSource
    ? generatedJpegImage
      ? new URL(`/api/product-share-image/${country.toLowerCase()}/${encodeURIComponent(slug)}`, SITE_URL).toString()
      : getAbsoluteImageUrl(imageSource)
    : undefined;
  const canonicalUrl = new URL(`/${country.toLowerCase()}/product/${encodeURIComponent(slug)}`, SITE_URL).toString();
  const imageAlt = firstText(
    localized.image_alt,
    country === 'IN' ? product.image_alt : product.image_alt_bn,
    product.image_alt,
    localizedName,
  ) || localizedName;
  const locale = country === 'IN' ? 'en_IN' : 'bn_BD';

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      siteName: 'GAZI SEED',
      title,
      description,
      url: canonicalUrl,
      locale,
      ...(imageUrl ? {
        images: [{
          url: imageUrl,
          alt: imageAlt,
          ...(generatedJpegImage ? { width: 1200, height: 630, type: 'image/jpeg' } : {}),
        }],
      } : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: imageAlt }] } : {}),
    },
  };
}

export default async function ProductDetailPage({
  slug,
  country,
}: {
  slug: string;
  country: ProductCountry;
}) {
  const product = await getProductForRoute(slug, country);
  if (!product) notFound();

  return <ProductDetailClient slug={slug} initialProduct={product} />;
}
