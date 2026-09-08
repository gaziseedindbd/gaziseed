'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, PackageCheck, ShieldCheck } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';

function OrderJourney({ current }: { current: 'cart' | 'checkout' | 'confirmation' | 'tracking' }) {
  const { t } = useLang();
  const steps = [
    ['cart', t('কার্ট', 'Cart')],
    ['checkout', t('চেকআউট', 'Checkout')],
    ['confirmation', t('কনফার্মেশন', 'Confirmation')],
    ['tracking', t('ট্র্যাকিং', 'Tracking')],
  ] as const;

  return (
    <div className="mx-auto mb-7 grid max-w-2xl grid-cols-4 gap-2 sm:gap-3" aria-label={t('অর্ডারের ধাপ', 'Order journey')}>
      {steps.map(([key, label], index) => {
        const currentIndex = steps.findIndex(([value]) => value === current);
        const active = index <= currentIndex;
        return (
          <div key={key} className="flex items-center gap-2">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-muted-foreground'}`}>
              {index + 1}
            </div>
            <div className={`hidden text-left text-[11px] font-bold sm:block ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</div>
            {index < steps.length - 1 && <div className={`hidden h-px flex-1 sm:block ${index < currentIndex ? 'bg-primary/50' : 'bg-border'}`} />}
          </div>
        );
      })}
    </div>
  );
}

function OrderSuccessInner() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('number');

  return (
    <main className="min-h-[70vh] bg-gradient-to-b from-primary/[0.04] via-background to-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary sm:text-xs">
          <span>GAZI SEED</span><span className="h-1 w-1 rounded-full bg-primary/50" /><span>{t('অর্ডার জার্নি', 'Order Journey')}</span>
        </div>
        <OrderJourney current="confirmation" />
        <div className="overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-[0_24px_70px_-30px_hsl(var(--primary)/0.35)]">
          <div className="relative px-5 pb-8 pt-10 text-center sm:px-10 sm:pb-10 sm:pt-14">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/[0.04] sm:h-24 sm:w-24">
              <CheckCircle2 className="h-12 w-12 text-primary sm:h-14 sm:w-14" strokeWidth={1.8} />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-primary">{t('অর্ডার নিশ্চিত হয়েছে', 'Order confirmed')}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t('অর্ডার সফল হয়েছে!', 'Order placed successfully!')}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t('আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। আমাদের টিম খুব শীঘ্রই আপনার সাথে যোগাযোগ করবে।', 'Your order has been received successfully. Our team will contact you shortly.')}
            </p>

            {orderNumber && (
              <div className="mx-auto mt-7 max-w-md rounded-2xl border border-primary/15 bg-primary/[0.045] p-5 text-left sm:p-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('আপনার অর্ডার নম্বর', 'Your order number')}</p>
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
                  <div><p className="text-sm font-semibold">{t('অর্ডার ট্র্যাক করুন', 'Track your order')}</p><p className="text-xs text-muted-foreground">{t('ডেলিভারির অগ্রগতি দেখুন', 'View delivery progress')}</p></div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2"><ShieldCheck className="h-5 w-5 text-primary' /></div>
                  <div><p className="text-sm font-semibold">{t('নিরাপদ অর্ডার', 'Secure order')}</p><p className="text-xs text-muted-foreground">{t('আপনার তথ্য সুরক্ষিতভাবে ব্যবস্থাপনা করা হয়', 'Your information is handled securely')}</p></div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/track-order" className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
                {t('অর্ডার ট্র্যাক করুন', 'Track your order')} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/all-products" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-background px-6 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
                {t('আরও শপিং করুন', 'Continue shopping')}
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
