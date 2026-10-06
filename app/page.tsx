import { createServerSupabase } from '@/lib/supabase/server';
import Home from '@/components/site/home';
import { getImageProps } from 'next/image';
import type { Banner } from '@/lib/supabase/types';

export const revalidate = 60;

export default async function Page() {
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('display_order', { ascending: true });

  const initialBanners = (data || []) as Banner[];
  const firstBanner = initialBanners[0];
  const heroImage = firstBanner?.desktop_image ? {
    desktop: getImageProps({
      src: firstBanner.desktop_image,
      width: 1280,
      height: 533,
      quality: 75,
      alt: firstBanner.title || 'GAZI SEED',
    }).props,
    mobile: getImageProps({
      src: firstBanner.mobile_image || firstBanner.desktop_image,
      width: 800,
      height: 1200,
      quality: 75,
      alt: firstBanner.title || 'GAZI SEED',
    }).props,
  } : null;
  return <Home initialBanners={initialBanners} initialHeroImage={heroImage} />;
}
