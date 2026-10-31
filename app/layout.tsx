export const revalidate = 60;

import './globals.css';

import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Hind } from 'next/font/google';
import Script from 'next/script';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { AnnouncementBar } from '@/components/site/announcement-bar';
import { WhatsAppButton } from '@/components/site/whatsapp-button';
import { CartProvider } from '@/components/site/cart-provider';
import FloatingCartDrawer from '@/components/site/floating-cart-drawer';
import { ToastProvider } from '@/components/site/toast-provider';
import { LanguageProvider } from '@/components/site/language-provider';
import { BottomNav } from '@/components/site/bottom-nav';
import { ThemeSwitcher } from '@/components/site/theme-switcher';
import { MarketingTracker, type MarketingSettings } from '@/components/site/marketing-tracker';
import { ReferralTracker } from '@/components/site/referral-tracker';
import BrandNormalizer from '@/components/site/brand-normalizer';
import { AuthSessionBridge } from '@/components/site/auth-session-bridge';
import HomePromoSync from '@/components/site/home-promo-sync';
import IndiaHomeCountry from '@/components/site/india-home-country';
import DeferredHomeWidgets from '@/components/site/deferred-home-widgets';
import { createServerSupabase } from '@/lib/supabase/server';
import { normalizeVisitorCountry, resolveVisitorCountry } from '@/lib/visitor-country';

const hind = Hind({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-hind', display: 'swap' });

const FAVICON_URL = '/favicon.svg?v=3';
const SITE_URL = 'https://www.gaziseed.com';

export const viewport: Viewport = {
  themeColor: '#047857',
};

export const metadata: Metadata = {
  title: 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
  description: 'GAZI SEED - বীজ, গাছ, বাগান ও কৃষি পণ্যের অনলাইন স্টোর। আপনার এলাকায় ডেলিভারি ও পেমেন্টের সুবিধা চেক করুন.',
  metadataBase: new URL(SITE_URL),
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
    shortcut: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
    apple: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
    description: 'বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
    siteName: 'GAZI SEED',
    type: 'website',
    locale: 'bn_BD',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
    description: 'বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const visitorCountry = normalizeVisitorCountry(requestHeaders.get('x-gazi-route-country')) || resolveVisitorCountry({
    pathname: '/',
    manualOverride: cookieStore.get('gazi_country_override')?.value,
    vercelCountry: requestHeaders.get('x-vercel-ip-country'),
    cloudflareCountry: requestHeaders.get('cf-ipcountry'),
  });

  const savedLanguage = cookieStore.get('gazi_lang')?.value;
  const initialLang = savedLanguage === 'bn' || savedLanguage === 'hi' || savedLanguage === 'en'
    ? savedLanguage
    : visitorCountry === 'IN' ? 'en' : 'bn';
  const htmlLanguage = initialLang + '-' + (initialLang === 'hi' ? 'IN' : visitorCountry);

  const serverSupabase = await createServerSupabase(visitorCountry);
  const { data: marketingSettings } = await serverSupabase
    .from('marketing_settings')
    .select('meta_pixel_id, ga4_measurement_id, gtm_id, tiktok_pixel_id')
    .eq('id', 1)
    .eq('country_code', visitorCountry)
    .maybeSingle();

  const marketingSettingsForClient: MarketingSettings = {
    meta_pixel_id: marketingSettings?.meta_pixel_id ?? null,
    ga4_measurement_id: marketingSettings?.ga4_measurement_id ?? null,
    gtm_id: marketingSettings?.gtm_id ?? null,
    tiktok_pixel_id: marketingSettings?.tiktok_pixel_id ?? null,
  };

  const ga4MeasurementId = marketingSettings?.ga4_measurement_id?.trim()
    || process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()
    || 'G-6RKL3GB80V';

  return (
    <html lang={htmlLanguage} className={hind.variable} suppressHydrationWarning>
      <head>
        {/* Homepage styles are inlined in app/page.tsx to keep them off the initial render-blocking request path. */}
        {ga4MeasurementId ? (
          <>
            <Script
              id="seed-bari-ga4"
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4MeasurementId)}`}
              strategy="lazyOnload"
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(ga4MeasurementId)});
window.__GAZI_GA4_BOOTSTRAPPED__ = ${JSON.stringify(ga4MeasurementId)};
`,
              }}
            />
          </>
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=window.location.pathname;var css=[];if(p==='/checkout')css.push('/checkout-premium-v1.css?v=2');if(p.indexOf('/combo/')===0)css.push('/combo-quick-checkout-v2.css?v=1');for(var i=0;i<css.length;i++){var l=document.createElement('link');l.rel='stylesheet';l.href=css[i];document.head.appendChild(l)}}catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){window.__GAZI_COUNTRY__='${visitorCountry}';})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{const theme=localStorage.getItem('admin_theme');if(theme==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')} }catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}})();` }} />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <MarketingTracker initialSettings={marketingSettingsForClient} />
        <ReferralTracker />
        <BrandNormalizer />
        <LanguageProvider initialLang={initialLang} initialCountry={visitorCountry as 'BD' | 'IN'}>
          <ToastProvider>
            <CartProvider>
              <AnnouncementBar />
              <SiteHeader initialCountry={visitorCountry} />
              <FloatingCartDrawer />
              <AuthSessionBridge />
              <HomePromoSync />
              <IndiaHomeCountry />
              <main className="min-h-screen">{children}</main>
              <SiteFooter initialCountry={visitorCountry} />
              <WhatsAppButton />
              <BottomNav initialCountry={visitorCountry} />
              <ThemeSwitcher />
              <DeferredHomeWidgets />
            </CartProvider>
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
