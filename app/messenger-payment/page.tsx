'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';

type CashfreeClient = {
  checkout: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown>;
};

type CashfreeFactory = (options: { mode: 'production' | 'sandbox' }) => CashfreeClient;

function getCashfreeFactory(): CashfreeFactory | undefined {
  return (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
}

async function loadCashfreeSdk() {
  if (getCashfreeFactory()) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-cashfree-sdk="v3"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Cashfree SDK failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.dataset.cashfreeSdk = 'v3';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Cashfree SDK failed to load'));
    document.head.appendChild(script);
  });
}

export default function MessengerPaymentPage() {
  const [state, setState] = useState<'loading' | 'opening' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Payment details যাচাই করা হচ্ছে…');
  const [amount, setAmount] = useState(0);
  const [paymentOrderId, setPaymentOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  const startPayment = useCallback(async (currentOrderId: string, returned: boolean) => {
    try {
      setPaymentOrderId(currentOrderId);
      setState('loading');
      const response = await fetch('/api/messenger-payment-session?order_id=' + encodeURIComponent(currentOrderId), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Payment session unavailable');
      setAmount(Number(data.advance_amount || data.amount || 0));

      if (returned) {
        setMessage('Payment status যাচাই করা হচ্ছে…');
        const complete = await fetch('https://ufxsthshyebahkwbmioe.supabase.co/functions/v1/cashfree-complete-cod-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: data.payment_intent_id }),
        });
        const result = await complete.json();
        if (!complete.ok || !result?.completed) throw new Error(result?.error || 'Advance payment was not completed');
        setOrderNumber(typeof result.order_number === 'string' ? result.order_number : '');
        setState('success');
        setMessage('COD order successfully confirmed.');
        return;
      }

      await loadCashfreeSdk();
      const cashfreeFactory = getCashfreeFactory();
      if (!cashfreeFactory) throw new Error('Cashfree SDK unavailable');
      setState('opening');
      setMessage('Cashfree secure checkout খোলা হচ্ছে…');
      const cashfree = cashfreeFactory({ mode: 'production' });
      await cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_self' });
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Payment শুরু করা যায়নি।');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentOrderId = params.get('order_id')?.trim() || '';
    const returned = params.get('return') === '1';
    if (!currentOrderId) {
      setState('error');
      setMessage('Payment order পাওয়া যায়নি।');
      return;
    }

    void startPayment(currentOrderId, returned);
  }, [startPayment]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-[2rem] border border-border/70 bg-card p-7 text-center shadow-xl">
        {state === 'success' ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /> : state === 'error' ? <XCircle className="mx-auto h-14 w-14 text-destructive" /> : <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary" />}
        <h1 className="mt-5 text-2xl font-black">GAZI SEED</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        {amount > 0 && state !== 'success' && <p className="mt-5 text-3xl font-black text-primary">₹{amount.toFixed(0)}</p>}
        {state === 'success' && (
          <>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-700">
              <ShieldCheck className="h-4 w-4" /> COD advance paid
            </div>
            {orderNumber && (
              <>
                <p className="mt-4 text-sm font-bold">Order: {orderNumber}</p>
                <a
                  href="/track-order"
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
                >
                  📦 Track Order
                </a>
              </>
            )}
          </>
        )}
        {state === 'error' && paymentOrderId && (
          <button
            type="button"
            onClick={() => void startPayment(paymentOrderId, false)}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            🔄 Retry Payment
          </button>
        )}
      </section>
    </main>
  );
}
