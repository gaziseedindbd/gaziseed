'use client';

import { supabase } from './supabase/client';
import type { Product } from './supabase/types';
import { trackMarketingEvent } from './marketing';

export type CartBulkTier = {
  min_quantity: number;
  unit_price: number;
};

export type CartItem = {
  product_id: string;
  name: string;
  slug: string;
  image: string;
  unit_price: number;
  regular_price: number;
  base_unit_price?: number;
  quantity: number;
  variant_id?: string;
  variant_name?: string;
  bundle_id?: string;
  bulk_tiers?: CartBulkTier[];
};

const CART_KEY = 'gazi_cart';

const normalizeOptionId = (value?: string) => value || '';

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CART_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function getValidatedCart(country: 'BD' | 'IN'): Promise<CartItem[]> {
  const cart = getCart();
  if (cart.length === 0) return [];
  const productIds = Array.from(new Set(cart.map((item) => item.product_id).filter(Boolean)));
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('country_code', country)
    .eq('is_active', true)
    .in('id', productIds);
  if (error) return cart;
  const activeIds = new Set((data || []).map((row) => row.id));
  const validCart = cart.filter((item) => activeIds.has(item.product_id));
  if (validCart.length !== cart.length) saveCart(validCart);
  return validCart;
}

// Read fresh inventory before creating an order. The order API remains authoritative.
export async function isCartAvailable(cart: CartItem[], country: 'BD' | 'IN'): Promise<boolean> {
  if (!cart.length) return false;
  const ids = Array.from(new Set(cart.map((item) => item.product_id)));
  const variantIds = Array.from(new Set(cart.flatMap((item) => item.variant_id ? [item.variant_id] : [])));
  const [products, variants] = await Promise.all([
    supabase.from('products').select('id,stock,min_order_qty,max_order_qty').eq('country_code', country).eq('is_active', true).in('id', ids),
    variantIds.length
      ? supabase.from('product_variants').select('id,product_id,stock').eq('is_active', true).in('id', variantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (products.error || variants.error) throw new Error('Inventory check failed');
  const totals = new Map<string, number>();
  return cart.every((item) => {
    const product = products.data?.find((row) => row.id === item.product_id);
    const variant = item.variant_id ? variants.data?.find((row) => row.id === item.variant_id && row.product_id === item.product_id) : null;
    if (!product || (item.variant_id && !variant) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return false;
    if (product.min_order_qty && item.quantity < product.min_order_qty) return false;
    const key = item.variant_id || item.product_id;
    const total = (totals.get(key) || 0) + item.quantity;
    totals.set(key, total);
    return total <= (variant?.stock ?? product.stock) && (!product.max_order_qty || total <= product.max_order_qty);
  });
}

export function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('cart-updated'));
}

const getBulkUnitPrice = (quantity: number, baseUnitPrice: number, tiers?: CartBulkTier[]) => {
  const applicable = (tiers || [])
    .filter((tier) => tier.min_quantity <= quantity && tier.unit_price > 0)
    .sort((a, b) => b.min_quantity - a.min_quantity)[0];
  return applicable?.unit_price ?? baseUnitPrice;
};

export function addToCart(product: Product, quantity: number = 1, overrides?: Partial<Pick<CartItem, 'name' | 'unit_price' | 'base_unit_price' | 'variant_id' | 'variant_name' | 'bundle_id' | 'bulk_tiers'>>) {
  const cart = getCart();
  const existing = cart.find((item) =>
    item.product_id === product.id &&
    normalizeOptionId(item.variant_id) === normalizeOptionId(overrides?.variant_id) &&
    normalizeOptionId(item.bundle_id) === normalizeOptionId(overrides?.bundle_id)
  );
  const baseUnitPrice = overrides?.base_unit_price ?? (product.sale_price && product.sale_price > 0 && product.sale_price < product.regular_price
    ? product.sale_price
    : product.regular_price);
  const price = overrides?.unit_price ?? getBulkUnitPrice(quantity, baseUnitPrice, overrides?.bulk_tiers);
  const itemName = overrides?.name || product.name_bn || product.name_en;

  if (existing) {
    existing.quantity += quantity;
    if (overrides?.bulk_tiers) existing.bulk_tiers = overrides.bulk_tiers;
    if (overrides?.base_unit_price) existing.base_unit_price = overrides.base_unit_price;
    const recalcBase = existing.base_unit_price ?? baseUnitPrice;
    existing.unit_price = getBulkUnitPrice(existing.quantity, recalcBase, existing.bulk_tiers);
  } else {
    cart.push({
      product_id: product.id,
      name: itemName,
      slug: product.slug,
      image: product.image,
      unit_price: price,
      regular_price: product.regular_price,
      base_unit_price: baseUnitPrice,
      quantity,
      variant_id: overrides?.variant_id,
      variant_name: overrides?.variant_name,
      bundle_id: overrides?.bundle_id,
      bulk_tiers: overrides?.bulk_tiers,
    });
  }
  saveCart(cart);

  const countryCode = (window as Window & { __GAZI_COUNTRY__?: 'BD' | 'IN' }).__GAZI_COUNTRY__ === 'IN' ? 'IN' : 'BD';
  const currency = countryCode === 'IN' ? 'INR' : 'BDT';
  trackMarketingEvent('add_to_cart', {
    currency,
    value: price * quantity,
    items: [{
      item_id: product.sku || product.id,
      item_name: itemName,
      price,
      quantity,
      item_variant: overrides?.variant_name,
    }],
    content_ids: [product.id],
    content_type: 'product',
    content_name: itemName,
    content_id: product.id,
    quantity,
  });
}

export function updateCartQuantity(productId: string, quantity: number, variantId?: string, bundleId?: string) {
  const cart = getCart();
  const item = cart.find((i) =>
    i.product_id === productId &&
    normalizeOptionId(i.variant_id) === normalizeOptionId(variantId) &&
    normalizeOptionId(i.bundle_id) === normalizeOptionId(bundleId)
  );
  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId, variantId, bundleId);
    } else {
      item.quantity = quantity;
      if (item.bulk_tiers?.length) {
        item.unit_price = getBulkUnitPrice(
          quantity,
          item.base_unit_price ?? item.regular_price,
          item.bulk_tiers
        );
      }
      saveCart(cart);
    }
  }
}

export function removeFromCart(productId: string, variantId?: string, bundleId?: string) {
  const variant = normalizeOptionId(variantId);
  const bundle = normalizeOptionId(bundleId);
  const cart = getCart().filter((item) => !(
    item.product_id === productId &&
    normalizeOptionId(item.variant_id) === variant &&
    normalizeOptionId(item.bundle_id) === bundle
  ));
  saveCart(cart);
}

export function clearCart() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('cart-updated'));
}

export function getCartTotal(): number {
  return getCart().reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

export function getCartCount(): number {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}
