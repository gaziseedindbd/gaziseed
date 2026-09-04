import type { Product } from '@/lib/supabase/types';

export type CountryCode = 'BD' | 'IN';

export const COUNTRY_CURRENCY: Record<CountryCode, { code: 'BDT' | 'INR'; symbol: '৳' | '₹'; locale: string }> = {
  BD: { code: 'BDT', symbol: '৳', locale: 'bn-BD' },
  IN: { code: 'INR', symbol: '₹', locale: 'en-IN' },
};

export function isCountryCode(value: string | null | undefined): value is CountryCode {
  return value === 'BD' || value === 'IN';
}

export function formatCountryMoney(amount: number, country: CountryCode): string {
  const currency = COUNTRY_CURRENCY[country];
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getProductUnitPrice(product: Pick<Product, 'regular_price' | 'sale_price'>): number {
  const sale = Number(product.sale_price ?? 0);
  const regular = Number(product.regular_price ?? 0);
  return sale > 0 && sale < regular ? sale : regular;
}

export type CatalogProduct = Pick<
  Product,
  'id' | 'name_bn' | 'name_en' | 'slug' | 'sku' | 'regular_price' | 'sale_price' | 'short_description' | 'category_id' | 'featured' | 'bestseller' | 'is_new' | 'seasonal' | 'created_at'
> & {
  product_images: Array<{ id: string; optimized_url: string | null; source_url: string | null; sort_order: number }>;
  product_variants: Array<{ id: string; name: string; price: number; sale_price: number | null; stock: number; sku: string | null; active: boolean }>;
};
