'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ConfirmationContent() {
  const q = useSearchParams();
  const [o, setO] = useState<any>(null);

  useEffect(() => {
    try {
      setO(JSON.parse(localStorage.getItem('gazi-last-order') || 'null'));
    } catch {}
  }, []);

  const number = q.get('order') || o?.order_number;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f4] p-4">
      <div className="max-w-lg rounded-3xl border bg-white p-10 text-center shadow-xl">
        <div className="text-6xl">✅</div>
        <h1 className="mt-5 text-3xl font-black">Order Confirmed</h1>
        <p className="mt-3 text-gray-600">Thank you for ordering from GAZI SEED.</p>
        <p className="mt-5 text-sm text-gray-500">Order number</p>
        <p className="text-2xl font-black text-[#1f6b3b]">{number || '—'}</p>
        {o?.guest_token && (
          <>
            <p className="mt-5 text-sm text-gray-500">Save this guest tracking token:</p>
            <code className="mt-1 block break-all rounded-xl bg-gray-100 p-3 text-xs">{o.guest_token}</code>
            <Link href={`/track?token=${o.guest_token}`} className="mt-4 inline-block font-bold text-[#1f6b3b]">
              Track this order
            </Link>
          </>
        )}
        <Link href="/shop" className="mt-6 block rounded-xl bg-[#1f6b3b] px-6 py-3 font-bold text-white">
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}

export default function Confirmation() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Loading…</main>}>
      <ConfirmationContent />
    </Suspense>
  );
}
