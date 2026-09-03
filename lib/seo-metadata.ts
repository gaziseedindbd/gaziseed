import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';

export const SITE_URL = 'https://www.seedbari.com';
export const FALLBACK_IMAGE = `${SITE_URL}/favicon.svg`;

function absoluteUrl(value?: string | null) {
  if (!value) return FALLBACK_IMAGE;
  const url = /^https?:\/\//i.test(value)
    ? value
    : `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;

  // Facebook/Meta link previews are more reliable with a JPEG/PNG OG asset.
  // Site uploads are commonly WebP, so convert only the social-preview request
  // through a public image proxy. The actual site image URL is left untouched.
  if (/\.webp(?:$|[?#])/i.test(url)) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1200&h=630&fit=contain&cbg=ffffff&output=jpg&q=88`;
  }

  return url;
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
  const cleanTitle = title.trim() || 'SUPER KING SEED';
  const cleanDescription = (description || 'SUPER KING SEED — বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর।').trim();
  const url = `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const ogImage = absoluteUrl(image);
  const isJpegPreview = ogImage.startsWith('https://wsrv.nl/');

  return {
    title: cleanTitle,
    description: cleanDescription,
    alternates: { canonical: url },
    openGraph: {
      title: cleanTitle,
      description: cleanDescription,
      url,
      siteName: 'SUPER KING SEED',
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
