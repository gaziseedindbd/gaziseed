import { createWhatsAppSupabase } from '@/lib/whatsapp/server';
import type { WhatsAppToolCountry, WhatsAppToolResult } from './types';

export interface TrackOrderArgs {
  orderNumber: string;
  customerPhone: string;
  country: WhatsAppToolCountry;
}

export async function trackOrder(args: TrackOrderArgs): Promise<WhatsAppToolResult<{
  order: Record<string, unknown>;
  items: Record<string, unknown>[];
}>> {
  const orderNumber = args.orderNumber.trim();
  const customerPhone = args.customerPhone.trim();

  if (!orderNumber || !customerPhone) {
    return { ok: false, error: 'Order number and customer phone are required.' };
  }

  const supabase = createWhatsAppSupabase(args.country);
  const { data, error } = await supabase.rpc('track_order', {
    p_order_number: orderNumber,
    p_customer_phone: customerPhone,
  });

  if (error) return { ok: false, error: `Order tracking failed: ${error.message}` };
  if (!data) return { ok: false, error: 'Order not found for the supplied order number and phone number.' };

  const payload = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      order: (payload.order || {}) as Record<string, unknown>,
      items: Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [],
    },
  };
}

export interface CustomerOrderHistoryArgs {
  customerPhone: string;
  country: WhatsAppToolCountry;
  limit?: number;
}

export async function getCustomerOrderHistory(args: CustomerOrderHistoryArgs): Promise<WhatsAppToolResult<{
  orders: Record<string, unknown>[];
}>> {
  const phone = args.customerPhone.trim();
  if (!phone) return { ok: false, error: 'Customer phone is required.' };

  const limit = Math.min(Math.max(Math.floor(args.limit ?? 5), 1), 10);
  const supabase = createWhatsAppSupabase(args.country);

  const { data, error } = await supabase
    .from('orders')
    .select('order_number,customer_name,customer_phone,subtotal,discount,grand_total,payment_method,status,order_status,payment_status,created_at,updated_at,country_code')
    .eq('country_code', args.country)
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false, error: `Customer order history lookup failed: ${error.message}` };

  return { ok: true, data: { orders: (data || []) as Record<string, unknown>[] } };
}
