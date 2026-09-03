export type CountryCode = 'IN' | 'BD';

export const COUNTRY_CONFIG: Record<CountryCode, { name: string; currency: string; symbol: string; locale: string }> = {
  IN: { name: 'India', currency: 'INR', symbol: '₹', locale: 'en-IN' },
  BD: { name: 'Bangladesh', currency: 'BDT', symbol: '৳', locale: 'bn-BD' },
};

export function formatMoney(amount: number, country: CountryCode) {
  const c = COUNTRY_CONFIG[country];
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, maximumFractionDigits: 0 }).format(amount);
}
