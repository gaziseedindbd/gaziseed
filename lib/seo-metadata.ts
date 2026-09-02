import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';

export const SITE_URL = 'https://www.seedbari.com';
export const FALLBACK_IMAGE = `${SITE_URL}/favicon.svg`;

function absoluteUrl(value?: string | null) {
  if (!value) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
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
      images: [{ url: ogImage, width: 1200, height: 630, alt: cleanTitle }],
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
