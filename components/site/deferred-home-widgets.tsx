'use client';

import dynamic from 'next/dynamic';

const PromotionalPopup = dynamic(
  () => import('@/components/site/promotional-popup').then((m) => m.PromotionalPopup),
  { ssr: false }
);
const AccountPasswordLauncher = dynamic(
  () => import('@/components/site/account-password-launcher').then((m) => m.default),
  { ssr: false }
);
const HomeFloatingReviews = dynamic(
  () => import('@/components/site/home-floating-reviews').then((m) => m.default),
  { ssr: false }
);
const PageShare = dynamic(
  () => import('@/components/site/page-share').then((m) => m.default),
  { ssr: false }
);

export default function DeferredHomeWidgets() {
  return (
    <>
      <PromotionalPopup location="main" />
      <AccountPasswordLauncher />
      <HomeFloatingReviews />
      <PageShare />
    </>
  );
}
