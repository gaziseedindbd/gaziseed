'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

function OrderSuccessInner() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('number');

  return (
    <div className="container-custom py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle className="mx-auto mb-4 h-20 w-20 text-green-500" />
        <h1 className="text-2xl font-bold">অর্ডার সফল হয়েছে!</h1>
        <p className="mt-2 text-muted-foreground">আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।</p>
        {orderNumber && (
          <div className="mt-4 rounded-xl bg-secondary/30 p-4">
            <p className="text-sm text-muted-foreground">আপনার অর্ডার নম্বর</p>
            <p className="text-lg font-bold text-primary">{orderNumber}</p>
          </div>
        )}
        <p className="mt-4 text-sm text-muted-foreground">আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/track-order" className="btn-primary">অর্ডার ট্র্যাক করুন</Link>
          <Link href="/all-products" className="text-sm font-medium text-primary hover:underline">আরও শপিং করুন</Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="container-custom py-12"><div className="h-64 animate-pulse rounded-2xl bg-secondary" /></div>}>
      <OrderSuccessInner />
    </Suspense>
  );
}
