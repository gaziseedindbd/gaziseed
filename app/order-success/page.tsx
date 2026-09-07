'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, PackageCheck, ShieldCheck } from 'lucide-react';

function OrderSuccessInner() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('number');

  return (
    <main className="min-h-[70vh] bg-gradient-to-b from-primary/[0.04] via-background to-background px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-[0_24px_70px_-30px_hsl(var(--primary)/0.35)]">
          <div className="relative px-5 pb-8 pt-10 text-center sm:px-10 sm:pb-10 sm:pt-14">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/[0.04] sm:h-24 sm:w-24">
              <CheckCircle2 className="h-12 w-12 text-primary sm:h-14 sm:w-14" strokeWidth={1.8} />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Order confirmed</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">অর্ডার সফল হয়েছে!</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। আমাদের টিম খুব শীঘ্রই আপনার সাথে যোগাযোগ করবে।
            </p>

            {orderNumber && (
              <div className="mx-auto mt-7 max-w-md rounded-2xl border border-primary/15 bg-primary/[0.045] p-5 text-left sm:p-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">আপনার অর্ডার নম্বর</p>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="break-all text-xl font-bold tracking-wide text-primary sm:text-2xl">{orderNumber}</p>
                  <PackageCheck className="h-7 w-7 shrink-0 text-primary/70" />
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2"><PackageCheck className="h-5 w-5 text-primary" /></div>
                  <div><p className="text-sm font-semibold">অর্ডার ট্র্যাক করুন</p><p className="text-xs text-muted-foreground">ডেলিভারির অগ্রগতি দেখুন</p></div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2"><ShieldCheck className="h-5 w-5 text-primary" /></div>
                  <div><p className="text-sm font-semibold">নিরাপদ অর্ডার</p><p className="text-xs text-muted-foreground">আপনার তথ্য সুরক্ষিতভাবে ব্যবস্থাপনা করা হয়</p></div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/track-order" className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm font-semibold">
                অর্ডার ট্র্যাক করুন <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/all-products" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-background px-6 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-primary/[0.04]">
                আরও শপিং করুন
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="container-custom py-12"><div className="mx-auto h-80 max-w-3xl animate-pulse rounded-[2rem] bg-secondary" /></div>}>
      <OrderSuccessInner />
    </Suspense>
  );
}
