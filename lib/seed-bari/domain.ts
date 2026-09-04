type ProductPriceFields = {
  regular_price: number | null;
  sale_price: number | null;
};

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

export function getProductUnitPrice(product: ProductPriceFields): number {
  const sale = Number(product.sale_price ?? 0);
  const regular = Number(product.regular_price ?? 0);
  return sale > 0 && sale < regular ? sale : regular;
}

export type CatalogProduct = ProductPriceFields & {
  id: string;
  name_bn: string;
  name_en: string;
  slug: string;
  sku: string;
  short_description: string | null;
  category_id: string | null;
  featured: boolean;
  bestseller: boolean;
  is_new: boolean;
  seasonal: boolean;
  created_at: string;
  product_images: Array<{
    id: string;
    optimized_url: string | null;
    source_url: string | null;
    sort_order: number;
  }>;
  product_variants: Array<{
    id: string;
    name: string;
    price: number;
    sale_price: number | null;
    stock: number;
    sku: string | null;
    active: boolean;
  }>;
};
