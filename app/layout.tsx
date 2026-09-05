export const revalidate = 60;

import './globals.css';

import type { Metadata } from 'next';
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

const hind = Hind({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-hind', display: 'swap' });

const FAVICON_URL = '/favicon.svg?v=2';

export const metadata: Metadata = {
  title: 'SEED BARI - বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর',
  description: 'SEED BARI - বীজ, গাছ, বাগান ও কৃষি পণ্যের অনলাইন স্টোর। ক্যাশ অন ডেলিভারি সারাদেশে।',
  metadataBase: new URL('https://www.gaziseed.com'),
  manifest: '/manifest.webmanifest',
  themeColor: '#047857',
  icons: {
    icon: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
    shortcut: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
    apple: [{ url: FAVICON_URL, type: 'image/svg+xml' }],
  },
  openGraph: { title: 'SEED BARI', description: 'বীজ, গাছ ও কৃষি পণ্যের অনলাইন স্টোর', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href={FAVICON_URL} type="image/svg+xml" />
        <link rel="shortcut icon" href={FAVICON_URL} type="image/svg+xml" />
        <meta name="theme-color" content="#047857" />
        <link rel="apple-touch-icon" href={FAVICON_URL} />
        <link rel="stylesheet" href="/home-premium-v3.css" />
        <link rel="stylesheet" href="/home-banner-overlay.css" />
        <link rel="stylesheet" href="/product-detail-premium.css" />
        <link rel="stylesheet" href="/home-category-cards-fix.css" />
        <link rel="stylesheet" href="/home-category-labels-premium.css" />
        <link rel="stylesheet" href="/home-banner-final-fix.css" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{const theme=localStorage.getItem('admin_theme');if(theme==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})()` }} />
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
