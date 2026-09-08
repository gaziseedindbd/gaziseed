'use client';

import { supabase } from './supabase/client';
import type { Product } from './supabase/types';
import { trackMarketingEvent } from './marketing';

export type CartItem = {
  product_id: string;
  name: string;
  slug: string;
  image: string;
  unit_price: number;
  regular_price: number;
  quantity: number;
  variant_id?: string;
  variant_name?: string;
  bundle_id?: string;
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

export function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('cart-updated'));
}

export function addToCart(product: Product, quantity: number = 1, overrides?: Partial<Pick<CartItem, 'name' | 'unit_price' | 'variant_id' | 'variant_name' | 'bundle_id'>>) {
  const cart = getCart();
  const existing = cart.find((item) =>
    item.product_id === product.id &&
    normalizeOptionId(item.variant_id) === normalizeOptionId(overrides?.variant_id) &&
    normalizeOptionId(item.bundle_id) === normalizeOptionId(overrides?.bundle_id)
  );
  const price = overrides?.unit_price ?? (product.sale_price && product.sale_price > 0 && product.sale_price < product.regular_price
    ? product.sale_price
    : product.regular_price);
  const itemName = overrides?.name || product.name_bn || product.name_en;

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      product_id: product.id,
      name: itemName,
      slug: product.slug,
      image: product.image,
      unit_price: price,
      regular_price: product.regular_price,
      quantity,
      variant_id: overrides?.variant_id,
      variant_name: overrides?.variant_name,
      bundle_id: overrides?.bundle_id,
    });
  }
  saveCart(cart);

  trackMarketingEvent('add_to_cart', {
    currency: 'BDT',
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
