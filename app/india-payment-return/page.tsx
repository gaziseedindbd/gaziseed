'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

function IndiaPaymentReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intentId = searchParams.get('payment_intent_id') || '';
  const [message, setMessage] = useState('Cashfree payment যাচাই করা হচ্ছে…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(intentId)) {
        setFailed(true);
        setMessage('Payment reference পাওয়া যায়নি। আবার checkout page থেকে চেষ্টা করুন।');
        return;
      }
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data, error } = await supabase.functions.invoke('cashfree-campaign-payment', {
          body: { action: 'complete', payment_intent_id: intentId },
        });
        if (!active) return;
        if (data?.completed && data?.order_number) {
          const status = Number(data.due_amount || 0) > 0 ? 'cod' : 'paid';
          const params = new URLSearchParams({
            number: String(data.order_number),
            amount: String(data.amount ?? ''),
            payment_status: status,
            due_amount: String(data.due_amount ?? ''),
            advance_amount: String(data.advance_amount ?? ''),
          });
          router.replace(`/order-success?${params.toString()}`);
          return;
        }
        if (data?.processing && attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        if (!error && data?.ok && data?.paid === false) {
          const providerStatus = String(data?.order_status || 'PENDING').toUpperCase();
          if (['FAILED', 'USER_DROPPED', 'EXPIRED', 'TERMINATED'].includes(providerStatus)) {
            setFailed(true);
            setMessage('Payment সম্পন্ন হয়নি। আবার checkout page থেকে চেষ্টা করুন।');
            return;
          }
          if (attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            continue;
          }
          setFailed(true);
          setMessage('Cashfree এখনো payment নিশ্চিত করেনি। কিছুক্ষণ পরে order status দেখুন বা support-এ যোগাযোগ করুন।');
          return;
        }
        if (error || !data?.ok) {
          setFailed(true);
          setMessage('পেমেন্টের ফলাফল নিশ্চিত করা যায়নি। টাকা কেটে থাকলে আবার পেমেন্ট করবেন না—support-এ যোগাযোগ করুন।');
          return;
        }
        if (attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
      }
      if (active) {
        setFailed(true);
        setMessage('Payment যাচাই চলছে। কিছুক্ষণ পরে order status দেখুন বা support-এ যোগাযোগ করুন।');
      }
    };
    void verify();
    return () => { active = false; };
  }, [intentId, router]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-emerald-50 px-4 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl">
        {failed ? <TriangleAlert className="mx-auto h-12 w-12 text-amber-600" /> : <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-700" />}
        {!failed && <CheckCircle2 className="mx-auto mt-3 h-5 w-5 text-emerald-600" />}
        <h1 className="mt-4 text-xl font-black text-slate-900">{failed ? 'Payment status' : 'পেমেন্ট যাচাই হচ্ছে'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        {failed && <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white">হোমে ফিরুন</Link>}
      </div>
    </main>
  );
}

export default function IndiaPaymentReturnPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[70vh] items-center justify-center bg-emerald-50 px-4 py-16"><Loader2 className="h-12 w-12 animate-spin text-emerald-700" /></main>}>
      <IndiaPaymentReturnContent />
    </Suspense>
  );
}
