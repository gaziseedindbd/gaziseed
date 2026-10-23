import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';

export type SeoCountry = 'BD' | 'IN';

export async function getSeoCountry(): Promise<SeoCountry> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const override = cookieStore.get('gazi_country_override')?.value?.toUpperCase();
  if (override === 'IN' || override === 'BD') return override;
  const detected = (requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry') || 'BD').toUpperCase();
  return detected === 'IN' ? 'IN' : 'BD';
}

export function localizedSeoText(value: unknown, country: SeoCountry, fallback = ''): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const raw = value.trim();
  if (raw.startsWith('{')) {
    try {
      const translations = JSON.parse(raw) as Record<string, unknown>;
      for (const language of country === 'IN' ? ['en', 'hi', 'bn'] : ['bn', 'en', 'hi']) {
        const candidate = translations[language];
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
    } catch {
      // Keep the original text when it only resembles JSON.
    }
  }
  return raw;
}

export function cleanSeoDescription(value: unknown, fallback: string, maxLength = 160): string {
  const text = (typeof value === 'string' ? value : fallback).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const result = text || fallback;
  return result.length > maxLength ? result.slice(0, maxLength - 1).trimEnd() + '…' : result;
}

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
export const SITE_URL = configuredSiteUrl
  ? configuredSiteUrl.replace(/\/$/, '')
  : 'https://www.gaziseed.com';

export const FALLBACK_IMAGE = `${SITE_URL}/favicon.svg`;

function absoluteUrl(value?: string | null) {
  if (!value) return FALLBACK_IMAGE;
  const url = /^https?:\/\//i.test(value)
    ? value
    : `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;

  // Facebook/Meta previews are more reliable with a JPEG/PNG asset.
  // Keep the actual site image untouched and transcode WebP only for social crawlers.
  if (/\.webp(?:$|[?#])/i.test(url)) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1200&h=630&fit=cover&cbg=ffffff&output=jpg&q=88`;
  }

  return url;
}

function normalizeBrand(value: string) {
  return value.replace(/SUPER KING SEED/gi, 'GAZI SEED');
}

export function pageMetadata({
  title,
  description,
  image,
  path,
  type = 'website',
  locale = 'bn_BD',
}: {
  title: string;
  description?: string;
  image?: string | null;
  path: string;
  type?: 'website' | 'article';
  locale?: string;
}): Metadata {
  const cleanTitle = normalizeBrand(title.trim() || 'GAZI SEED');
  const cleanDescription = normalizeBrand((description || 'GAZI SEED — বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর।').trim());
  const url = `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const ogImage = absoluteUrl(image);
  const isJpegPreview = ogImage.startsWith('https://wsrv.nl/');

  return {
    title: cleanTitle,
    description: cleanDescription,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      title: cleanTitle,
      description: cleanDescription,
      url,
      siteName: 'GAZI SEED',
      type,
      locale,
      images: [{
        url: ogImage,
        width: 1200,
        height: 630,
        alt: cleanTitle,
        ...(isJpegPreview ? { type: 'image/jpeg' } : {}),
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: cleanTitle,
      description: cleanDescription,
      images: [ogImage],
    },
  };
}

export async function getServerRow(table: string, slugColumn: string, slug: string, country?: 'BD' | 'IN') {
  const supabase = await createServerSupabase(country);
  const { data } = await supabase.from(table).select('*').eq(slugColumn, slug).maybeSingle();
  return data as any;
}

export async function getServerProductById(id?: string | null) {
  if (!id) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  return data as any;
}
