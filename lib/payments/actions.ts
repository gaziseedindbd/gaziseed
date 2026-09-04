'use server';

import { createClient } from '@/lib/supabase/server';

export async function createPaymentTransaction(input: {
  orderId: string;
  provider: string;
  amount: number;
  currency?: string;
  guestToken?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_payment_transaction', {
    p_order_id: input.orderId,
    p_provider: input.provider,
    p_amount: input.amount,
    p_currency: input.currency ?? 'BDT',
    p_metadata: input.metadata ?? {},
    p_guest_token: input.guestToken ?? null,
  });
  if (error) throw error;
  return data as string;
}
