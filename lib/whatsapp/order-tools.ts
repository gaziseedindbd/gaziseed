import { createWhatsAppSupabase } from './server';
import { validateOrderDraft, type WhatsAppOrderDraft } from './order-draft';

export async function createWhatsAppOrder(
  input: unknown,
  country: 'BD' | 'IN',
) {
  const draft = validateOrderDraft(input);

  if (!draft.confirmed) {
    throw new Error('Explicit customer confirmation is required before creating an order');
  }

  if (!draft.customer_name || !draft.customer_phone || !draft.delivery_address) {
    throw new Error('Customer name, phone, and delivery address are required');
  }

  const supabase = createWhatsAppSupabase();

  const { data, error } = await supabase.rpc('create_order', {
    p_customer_name: draft.customer_name,
    p_customer_phone: draft.customer_phone,
    p_delivery_address: draft.delivery_address,
    p_items: draft.items,
    p_coupon_code: null,
    p_delivery_zone_id: null,
    p_order_source: 'whatsapp_ai',
    p_special_instructions: draft.special_instructions || null,
    p_user_id: null,
  });

  if (error) throw new Error(`Order creation failed: ${error.message}`);

  if (!data) throw new Error('Order creation returned no result');

  const result = data as Record<string, unknown>;
  return {
    country,
    order: result,
  };
}
