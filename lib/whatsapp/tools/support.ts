import { createWhatsAppSupabase } from '@/lib/whatsapp/server';
import type { WhatsAppToolCountry, WhatsAppToolResult } from './types';

export interface RequestHumanSupportArgs {
  customerName?: string | null;
  customerPhone: string;
  subject: string;
  message: string;
  country: WhatsAppToolCountry;
  orderId?: string | null;
}

export async function requestHumanSupport(args: RequestHumanSupportArgs): Promise<WhatsAppToolResult<{
  ticket_id: string;
  status: string;
}>> {
  const phone = args.customerPhone.trim();
  const subject = args.subject.trim();
  const message = args.message.trim();

  if (!phone || !subject || !message) {
    return { ok: false, error: 'Customer phone, subject, and message are required.' };
  }

  const supabase = createWhatsAppSupabase(args.country);
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      customer_name: args.customerName?.trim() || null,
      customer_phone: phone,
      subject,
      message,
      order_id: args.orderId || null,
      status: 'open',
      country_code: args.country,
    })
    .select('id,status')
    .single();

  if (error || !data) {
    return { ok: false, error: `Human support request failed: ${error?.message || 'unknown error'}` };
  }

  return {
    ok: true,
    data: {
      ticket_id: String(data.id),
      status: String(data.status),
    },
  };
}
