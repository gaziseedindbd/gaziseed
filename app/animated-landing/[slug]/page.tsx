import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { cleanSeoDescription, getSeoCountry, localizedSeoText, pageMetadata } from '@/lib/seo-metadata';
import AnimatedLandingClientPage from './client-page';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const country = await getSeoCountry();
  const supabase = await createServerSupabase(country);
  const { data: landing } = await supabase
    .from('animated_landing_pages')
    .select('*')
    .eq('slug', slug)
    .eq('country_code', country)
    .eq('status', 'active')
    .maybeSingle();

  const canonicalPath = `/animated-landing/${encodeURIComponent(slug)}`;
  if (!landing) {
    return {
      title: 'Offer page unavailable | GAZI SEED',
      robots: { index: false, follow: true },
      alternates: { canonical: canonicalPath },
    };
  }

  const titleValue = landing.seo_title || landing.title_en || landing.title_bn || landing.hero_title_en || landing.hero_title || landing.landing_name || landing.slug;
  const title = localizedSeoText(titleValue, country, landing.slug);
  const descriptionValue = landing.meta_description || landing.description_en || landing.description_bn || landing.hero_subtitle_en || landing.hero_subtitle || title;
  const description = cleanSeoDescription(localizedSeoText(descriptionValue, country, title), title);
  const image = landing.og_image || landing.hero_image || landing.image || (Array.isArray(landing.images) ? landing.images[0] : null);

  return pageMetadata({
    title,
    description,
    image,
    path: canonicalPath,
    locale: country === 'IN' ? 'en_IN' : 'bn_BD',
  });
}

export default function AnimatedLandingPage() {
  return <AnimatedLandingClientPage />;
}
