export const revalidate = 60;

import './globals.css';

import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Hind } from 'next/font/google';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { AnnouncementBar } from '@/components/site/announcement-bar';
import { WhatsAppButton } from '@/components/site/whatsapp-button';
import { CartProvider } from '@/components/site/cart-provider';
import FloatingCartDrawer from '@/components/site/floating-cart-drawer';
import { ToastProvider } from '@/components/site/toast-provider';
import { LanguageProvider } from '@/components/site/language-provider';
import { PromotionalPopup } from '@/components/site/promotional-popup';
import { BottomNav } from '@/components/site/bottom-nav';
import { ThemeSwitcher } from '@/components/site/theme-switcher';
import AccountPasswordLauncher from '@/components/site/account-password-launcher';
import { MarketingTracker } from '@/components/site/marketing-tracker';
import { FeatureProvider } from '@/components/site/feature-provider';
import { ReferralTracker } from '@/components/site/referral-tracker';
import HomeFloatingReviews from '@/components/site/home-floating-reviews';
import BrandNormalizer from '@/components/site/brand-normalizer';
import PageShare from '@/components/site/page-share';
import { AuthSessionBridge } from '@/components/site/auth-session-bridge';
import HomePromoSync from '@/components/site/home-promo-sync';
import IndiaHomeCountry from '@/components/site/india-home-country';

const hind = Hind({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-hind', display: 'swap' });

const FAVICON_URL = '/favicon.svg?v=3';
const SITE_URL = 'https://www.gaziseed.com';

export const viewport: Viewport = {
  themeColor: '#047857',
};

export const metadata: Metadata = {
  title: 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
  description: 'GAZI SEED - বীজ, গাছ, বাগান ও কৃষি পণ্যের অনলাইন স্টোর। ক্যাশ অন ডেলিভারি সারাদেশে।',
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: SITE_URL + '/' },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
    shortcut: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
    apple: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
    description: 'বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
    url: SITE_URL + '/',
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
  const cookieOverride = cookieStore.get('gazi_country_override')?.value?.toUpperCase();
  const detectedCountry = (
    requestHeaders.get('x-vercel-ip-country') ||
    requestHeaders.get('cf-ipcountry') ||
    'BD'
  ).toUpperCase();
  const visitorCountry = cookieOverride === 'IN' || cookieOverride === 'BD'
    ? cookieOverride
    : detectedCountry === 'IN' ? 'IN' : 'BD';

  const organizationLd = {
    '@type': 'Organization',
    '@id': SITE_URL + '/#organization',
    name: 'GAZI SEED',
    url: SITE_URL + '/',
    logo: SITE_URL + '/favicon.svg',
  };

  const websiteLd = {
    '@type': 'WebSite',
    '@id': SITE_URL + '/#website',
    url: SITE_URL + '/',
    name: 'GAZI SEED',
    publisher: { '@id': SITE_URL + '/#organization' },
    inLanguage: 'bn-BD',
  };

  const webpageLd = {
    '@type': 'WebPage',
    '@id': SITE_URL + '/#webpage',
    url: SITE_URL + '/',
    name: 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
    description: 'GAZI SEED - বীজ, গাছ, বাগান ও কৃষি পণ্যের অনলাইন স্টোর। ক্যাশ অন ডেলিভারি সারাদেশে।',
    isPartOf: { '@id': SITE_URL + '/#website' },
    about: { '@id': SITE_URL + '/#organization' },
    inLanguage: 'bn-BD',
  };

  const homeLd = {
    '@context': 'https://schema.org',
    '@graph': [organizationLd, websiteLd, webpageLd],
  };

  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/home-hero-responsive-standard-v1.css" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeLd) }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=window.location.pathname;var css=[];if(p==='/checkout')css.push('/checkout-premium-v1.css?v=2');if(p.indexOf('/combo/')===0)css.push('/combo-quick-checkout-v2.css?v=1');for(var i=0;i<css.length;i++){var l=document.createElement('link');l.rel='stylesheet';l.href=css[i];document.head.appendChild(l)}}catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){window.__GAZI_COUNTRY__='${visitorCountry}';})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{const theme=localStorage.getItem('admin_theme');if(theme==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')} }catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})}})()` }} />
      </head>
      <body className={hind.variable} suppressHydrationWarning>
        <FeatureProvider>
          <MarketingTracker />
          <ReferralTracker />
          <BrandNormalizer />
          <LanguageProvider>
            <ToastProvider>
              <CartProvider>
                <AnnouncementBar />
                <SiteHeader />
                <FloatingCartDrawer />
                <AuthSessionBridge />
                <HomePromoSync />
                <IndiaHomeCountry />
                <main className="min-h-screen">{children}</main>
                <SiteFooter />
                <WhatsAppButton />
                <PromotionalPopup location="main" />
                <BottomNav />
                <ThemeSwitcher />
                <AccountPasswordLauncher />
                <HomeFloatingReviews />
                <PageShare />
              </CartProvider>
            </ToastProvider>
          </LanguageProvider>
        </FeatureProvider>
      </body>
    </html>
  );
}
