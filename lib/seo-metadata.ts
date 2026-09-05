import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelSiteUrl = process.env.VERCEL_URL?.trim();
export const SITE_URL = configuredSiteUrl
  ? configuredSiteUrl.replace(/\/$/, '')
  : vercelSiteUrl
    ? `https://${vercelSiteUrl}`
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
}: {
  title: string;
  description?: string;
  image?: string | null;
  path: string;
  type?: 'website' | 'article';
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
      locale: 'bn_BD',
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

export async function getServerRow(table: string, slugColumn: string, slug: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from(table).select('*').eq(slugColumn, slug).maybeSingle();
  return data as any;
}

export async function getServerProductById(id?: string | null) {
  if (!id) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  return data as any;
}
