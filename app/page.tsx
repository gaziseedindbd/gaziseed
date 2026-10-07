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
  const visitorCountry: 'BD' | 'IN' = cookieOverride === 'IN' || cookieOverride === 'BD' ? cookieOverride : detectedCountry === 'IN' ? 'IN' : 'BD';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const now = new Date().toISOString();
  const bannerQuery = new URL('/rest/v1/banners', supabaseUrl || 'https://ufxsthshyebahkwbmioe.supabase.co');
  bannerQuery.searchParams.set('select', '*');
  bannerQuery.searchParams.set('is_active', 'eq.true');
  bannerQuery.searchParams.set('country_code', `eq.${visitorCountry}`);
  bannerQuery.searchParams.set('and', `(or(start_date.is.null,start_date.lte.${now}),or(end_date.is.null,end_date.gte.${now}))`);
  bannerQuery.searchParams.set('order', 'display_order.asc');

  let initialBanners: Banner[] = [];

  // The homepage must never wait for an upstream data service long enough to
  // hit Vercel's function timeout. The CSS hero fallback is intentionally
  // independent of Supabase so a slow/unavailable banner query degrades
  // gracefully instead of returning a 504.
  if (supabaseUrl && supabaseAnonKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      const bannerResponse = await fetch(bannerQuery.toString(), {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'x-gazi-country': visitorCountry,
        },
        next: { revalidate: 60 },
        signal: controller.signal,
      });

      if (bannerResponse.ok) {
        try {
          initialBanners = (await bannerResponse.json()) as Banner[];
        } catch {
          initialBanners = [];
        }
      }
    } catch {
      initialBanners = [];
    } finally {
      clearTimeout(timeoutId);
    }
  }
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
      <HomeStyleRegistry css={homeStyles} />
      <Home initialBanners={initialBanners} initialHeroImage={heroImage} initialVisitorCountry={visitorCountry} />
    </>
  );
}
