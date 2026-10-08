import { supabase } from '@/lib/supabase/client';
import type { IndiaPaymentMethod } from '@/components/site/india-payment-method-selector';

type CashfreeCheckout = {
  checkout: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown> | unknown;
};
type CashfreeFactory = (options: { mode: 'production' | 'sandbox' }) => CashfreeCheckout;

async function loadCashfree() {
  if (window.Cashfree) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-cashfree-sdk="v3"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Cashfree checkout could not load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.dataset.cashfreeSdk = 'v3';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Cashfree checkout could not load'));
    document.head.appendChild(script);
  });
  if (!window.Cashfree) throw new Error('Cashfree checkout is unavailable');
}

export async function startIndiaCampaignPayment(input: {
  flow: 'ads' | 'animated' | 'combo';
  context: Record<string, unknown>;
  method: IndiaPaymentMethod;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  instructions?: string;
}) {
  const { data, error } = await supabase.functions.invoke('cashfree-campaign-payment', {
    body: {
      action: 'create',
      flow: input.flow,
      context: input.context,
      payment_method: input.method === 'cod' ? 'cod' : 'cashfree',
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      delivery_address: input.deliveryAddress,
      special_instructions: input.instructions || '',
    },
  });
  if (error) throw error;
  if (!data?.ok || !data.payment_session_id) throw new Error(data?.error || 'Cashfree payment session could not be created');
  await loadCashfree();
  const cashfreeFactory = window.Cashfree as unknown as CashfreeFactory | undefined;
  const cashfree = cashfreeFactory?.({ mode: 'production' });
  if (!cashfree) throw new Error('Cashfree checkout is unavailable');
  await cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_self' });
  return data;
}
