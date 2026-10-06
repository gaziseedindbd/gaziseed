import { cookies, headers } from 'next/headers';
import { readFileSync } from 'fs';
import path from 'path';
import Home from '@/components/site/home';
import HomeStyleRegistry from '@/components/site/home-style-registry';
import { getImageProps } from 'next/image';
import type { Banner } from '@/lib/supabase/types';

export const revalidate = 60;

export default async function Page() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const cookieOverride = cookieStore.get('gazi_country_override')?.value?.toUpperCase();
  const detectedCountry = (requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry') || 'BD').toUpperCase();
  const visitorCountry: 'BD' | 'IN' = cookieOverride === 'IN' || detectedCountry === 'IN' ? 'IN' : 'BD';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const now = new Date().toISOString();
  const bannerQuery = new URL('/rest/v1/banners', supabaseUrl || 'https://ufxsthshyebahkwbmioe.supabase.co');
  bannerQuery.searchParams.set('select', '*');
  bannerQuery.searchParams.set('is_active', 'eq.true');
  bannerQuery.searchParams.set('country_code', `eq.${visitorCountry}`);
  bannerQuery.searchParams.set('and', `(or(start_date.is.null,start_date.lte.${now}),or(end_date.is.null,end_date.gte.${now}))`);
  bannerQuery.searchParams.set('order', 'display_order.asc');

  const bannerResponse = await fetch(bannerQuery.toString(), {
    headers: {
      apikey: supabaseAnonKey || '',
      Authorization: `Bearer ${supabaseAnonKey || ''}`,
      'x-gazi-country': visitorCountry,
    },
    next: { revalidate: 60 },
  }).catch(() => null);

  const initialBanners = bannerResponse?.ok ? ((await bannerResponse.json()) as Banner[]) : [];
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
  const homeStyles = readFileSync(path.join(process.cwd(), 'public/home-styles-v1.css'), 'utf8');

  return (
    <>
      {heroImage?.desktop?.src && (
        <link
          rel="preload"
          as="image"
          href={String(heroImage.desktop.src)}
          imageSrcSet={heroImage.desktop.srcSet}
          imageSizes="100vw"
          media="(min-width: 768px)"
          fetchPriority="high"
        />
      )}
      {heroImage?.mobile?.src && (
        <link
          rel="preload"
          as="image"
          href={String(heroImage.mobile.src)}
          imageSrcSet={heroImage.mobile.srcSet}
          imageSizes="100vw"
          media="(max-width: 767px)"
          fetchPriority="high"
        />
      )}
      <HomeStyleRegistry css={homeStyles} />
      <Home initialBanners={initialBanners} initialHeroImage={heroImage} initialVisitorCountry={visitorCountry} />
    </>
  );
}
