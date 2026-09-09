export const revalidate = 60;

import './globals.css';

import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { Hind } from 'next/font/google';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { AnnouncementBar } from '@/components/site/announcement-bar';
import { WhatsAppButton } from '@/components/site/whatsapp-button';
import { CartProvider } from '@/components/site/cart-provider';
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

const hind = Hind({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-hind', display: 'swap' });

const FAVICON_URL = '/favicon.svg?v=2';

export const metadata: Metadata = {
  title: 'GAZI SEED - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
  description: 'GAZI SEED - বীজ, গাছ, বাগান ও কৃষি পণ্যের অনলাইন স্টোর। ক্যাশ অন ডেলিভারি সারাদেশে।',
  metadataBase: new URL('https://www.gaziseed.com'),
  manifest: '/manifest.webmanifest',
  themeColor: '#047857',
  icons: {
    icon: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
    shortcut: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
    apple: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
  },
  openGraph: { title: 'GAZI SEED', description: 'বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = headers();
  const cookieOverride = cookies().get('gazi_country_override')?.value?.toUpperCase();
  const detectedCountry = (
    requestHeaders.get('x-vercel-ip-country') ||
    requestHeaders.get('cf-ipcountry') ||
    'BD'
  ).toUpperCase();
  const visitorCountry = cookieOverride === 'IN' || cookieOverride === 'BD'
    ? cookieOverride
    : detectedCountry === 'IN' ? 'IN' : 'BD';

  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
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
                <AuthSessionBridge />
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
