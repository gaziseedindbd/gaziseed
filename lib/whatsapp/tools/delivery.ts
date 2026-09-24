import { createWhatsAppSupabase } from '@/lib/whatsapp/server';
import type { DeliveryChargeArgs, WhatsAppToolResult } from './types';

export async function getDeliveryCharge(args: DeliveryChargeArgs): Promise<WhatsAppToolResult<{
  order_value: number;
  delivery_charge: number;
  currency: 'BDT' | 'INR';
  country: 'BD' | 'IN';
  free_delivery: boolean;
}>> {
  if (!Number.isFinite(args.orderValue) || args.orderValue < 0) {
    return { ok: false, error: 'Order value must be a non-negative number.' };
  }

  const supabase = createWhatsAppSupabase(args.country);
  const { data, error } = await supabase.rpc('calculate_delivery_charge', {
    p_order_value: args.orderValue,
    p_free_delivery: Boolean(args.freeDelivery),
  });

  if (error) return { ok: false, error: `Delivery charge calculation failed: ${error.message}` };

  const charge = Number(data);
  if (!Number.isFinite(charge)) return { ok: false, error: 'Delivery charge returned an invalid value.' };

  return {
    ok: true,
    data: {
      order_value: args.orderValue,
      delivery_charge: charge,
      currency: args.country === 'BD' ? 'BDT' : 'INR',
      country: args.country,
      free_delivery: Boolean(args.freeDelivery),
    },
  };
}
