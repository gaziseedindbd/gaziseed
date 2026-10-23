import { cookies, headers } from 'next/headers';
import { readFileSync } from 'fs';
import path from 'path';
import Home from '@/components/site/home';
import HomeStyleRegistry from '@/components/site/home-style-registry';
import { getImageProps } from 'next/image';
import type { Banner } from '@/lib/supabase/types';
import { getSeoCountry, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

export const revalidate = 60;

export async function generateMetadata() {
  const country = await getSeoCountry();
  const isIndia = country === 'IN';
  return pageMetadata({
    title: isIndia
      ? 'Quality Seeds Online in India | GAZI SEED'
      : 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
    description: isIndia
      ? 'Shop vegetable, flower and gardening seeds online in India from GAZI SEED. Check payment methods and delivery availability for your PIN code at checkout.'
      : 'GAZI SEED - বীজ, গাছ, বাগান ও কৃষি পণ্যের অনলাইন স্টোর। আপনার এলাকায় ডেলিভারি ও পেমেন্টের সুবিধা চেক করুন।',
    path: '/',
    locale: isIndia ? 'en_IN' : 'bn_BD',
  });
}

export default async function Page() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const routeHeaderCountry = requestHeaders.get('x-gazi-route-country')?.toUpperCase();
  const routeCookieCountry = cookieStore.get('gazi_route_country')?.value?.toUpperCase();
  const cookieOverride = cookieStore.get('gazi_country_override')?.value?.toUpperCase();
  const detectedCountry = (requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry') || 'BD').toUpperCase();
  const visitorCountry: 'BD' | 'IN' = routeHeaderCountry === 'IN' || routeHeaderCountry === 'BD'
    ? routeHeaderCountry
    : routeCookieCountry === 'IN' || routeCookieCountry === 'BD'
      ? routeCookieCountry
      : cookieOverride === 'IN' || cookieOverride === 'BD'
        ? cookieOverride
        : detectedCountry === 'IN' ? 'IN' : 'BD';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
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
  const homeTitle = visitorCountry === 'IN'
    ? 'Quality Seeds Online in India | GAZI SEED'
    : 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর';
  const homeDescription = visitorCountry === 'IN'
    ? 'Shop quality vegetable, flower and gardening seeds online in India from GAZI SEED, with convenient delivery across India.'
    : 'GAZI SEED - বীজ, গাছ, বাগান ও কৃষি পণ্যের অনলাইন স্টোর। ক্যাশ অন ডেলিভারি সারাদেশে।';
  const homeLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': SITE_URL + '/#organization',
        name: 'GAZI SEED',
        url: SITE_URL + '/',
        logo: SITE_URL + '/favicon.svg',
      },
      {
        '@type': 'WebSite',
        '@id': SITE_URL + '/#website',
        url: SITE_URL + '/',
        name: 'GAZI SEED',
        publisher: { '@id': SITE_URL + '/#organization' },
        inLanguage: visitorCountry === 'IN' ? 'en-IN' : 'bn-BD',
      },
      {
        '@type': 'WebPage',
        '@id': SITE_URL + '/#webpage',
        url: SITE_URL + '/',
        name: homeTitle,
        description: homeDescription,
        isPartOf: { '@id': SITE_URL + '/#website' },
        about: { '@id': SITE_URL + '/#organization' },
        inLanguage: visitorCountry === 'IN' ? 'en-IN' : 'bn-BD',
      },
    ],
  };
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeLd) }} />
      <HomeStyleRegistry css={homeStyles} />
      <Home initialBanners={initialBanners} initialHeroImage={heroImage} initialVisitorCountry={visitorCountry} />
    </>
  );
}
