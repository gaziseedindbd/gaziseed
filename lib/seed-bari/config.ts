export type StoreCountry = 'BD' | 'IN';

export const SEED_BARI_BRAND = {
  name: 'SEED BARI',
  shortName: 'SEED BARI',
  tagline: 'Quality seeds for every grower',
} as const;

export const STORE_COUNTRIES: Record<StoreCountry, {
  name: string;
  currency: 'BDT' | 'INR';
  symbol: '৳' | '₹';
  locale: 'bn-BD' | 'en-IN';
}> = {
  BD: { name: 'Bangladesh', currency: 'BDT', symbol: '৳', locale: 'bn-BD' },
  IN: { name: 'India', currency: 'INR', symbol: '₹', locale: 'en-IN' },
};

export const SEED_BARI_MODULES = [
  'storefront',
  'products',
  'variants',
  'cart',
  'checkout',
  'orders',
  'inventory',
  'combos',
  'coupons',
  'campaigns',
  'referrals',
  'rewards',
  'reviews',
  'support',
  'cms',
  'payments',
  'analytics',
  'ai',
  'master-admin',
] as const;

export function formatStoreMoney(amount: number, country: StoreCountry): string {
  const config = STORE_COUNTRIES[country];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
