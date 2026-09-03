'use server';

import { createClient } from '@/lib/supabase/server';

export type CheckoutItem = { productId: string; variantId?: string | null; quantity: number };
export type CheckoutInput = { country: 'BD' | 'IN'; items: CheckoutItem[]; customer: { name: string; phone: string; email?: string; address: string; district?: string; area?: string }; couponCode?: string; shippingFee?: number; paymentMethod?: 'cod' | 'online' };

export async function createOrder(input: CheckoutInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_checkout_order', { p_country: input.country, p_items: input.items, p_customer: input.customer, p_coupon_code: input.couponCode ?? null, p_shipping_fee: input.shippingFee ?? 0, p_payment_method: input.paymentMethod ?? 'cod' });
  if (error) throw error;
  return data;
}
