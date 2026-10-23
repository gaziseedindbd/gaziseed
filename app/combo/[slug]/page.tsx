import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { cleanSeoDescription, getSeoCountry, localizedSeoText, pageMetadata } from '@/lib/seo-metadata';
import ComboClientPage from './client-page';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const supabase = await createServerSupabase(country);
  const { data: combo } = await supabase
    .from('combo_packs')
    .select('*')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('is_active', true)
    .maybeSingle();

  const canonicalPath = `/combo/${encodeURIComponent(slug)}`;
  if (!combo) {
    return {
      title: 'Combo unavailable | GAZI SEED',
      robots: { index: false, follow: true },
      alternates: { canonical: canonicalPath },
    };
  }
  const titleValue = combo.seo_title || (country === 'IN' ? combo.name_en : combo.name_bn) || combo.slug;
  const title = localizedSeoText(titleValue, country, combo.slug);
  const description = cleanSeoDescription(
    localizedSeoText(combo.meta_description || (country === 'IN' ? combo.description_en : combo.description_bn), country, title),
    title,
  );
  return pageMetadata({
    title,
    description,
    image: combo.og_image || combo.images?.[0],
    path: canonicalPath,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default function ComboPage() {
  return <ComboClientPage />;
}
