'use server';

import { createClient } from '@/lib/supabase/server';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

export type CheckoutItem = {
  productId: string;
  variantId?: string | null;
  comboId?: string | null;
  quantity: number;
};

export type CheckoutInput = {
  country?: CountryCode;
  items: CheckoutItem[];
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    state?: string;
    district?: string;
    area?: string;
  };
  couponCode?: string;
  shippingFee?: number;
  paymentMethod?: 'cod' | 'online';
};

export async function createOrder(input: CheckoutInput) {
  const country: CountryCode = input.country ?? await getStoreCountry('BD');

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Cart is empty');
  }

  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
      throw new Error('Invalid item quantity');
    }
    if (!item.comboId && !item.productId) {
      throw new Error('Invalid cart item');
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_checkout_order', {
    p_country: country,
    p_items: input.items,
    p_customer: input.customer,
    p_coupon_code: input.couponCode?.trim() || null,
    p_shipping_fee: input.shippingFee ?? 0,
    p_payment_method: input.paymentMethod ?? 'cod',
  });

  if (error) throw error;
  return data;
}
