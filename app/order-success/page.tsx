'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, PackageCheck, ShieldCheck, CreditCard, Banknote } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';
import { formatPrice } from '@/lib/data';

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
  const amount = searchParams.get('amount');
  const paymentStatus = searchParams.get('payment_status');
  const dueAmount = searchParams.get('due_amount');
  const isPaid = paymentStatus === 'paid';
  const isCod = paymentStatus === 'cod';

  return (
    <main className="relative min-h-[75vh] overflow-hidden bg-[#fbfdf9] px-4 py-7 sm:py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_50%_15%,hsl(var(--primary)/0.10),transparent_52%),radial-gradient(circle_at_8%_28%,hsl(var(--primary)/0.06),transparent_25%),radial-gradient(circle_at_92%_32%,hsl(var(--primary)/0.06),transparent_25%)]" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-7"><OrderJourney current="confirmation" /></div>

        <section className="overflow-hidden rounded-[28px] border border-primary/10 bg-white shadow-[0_24px_80px_-42px_hsl(var(--primary)/0.45)]">
          <div className="border-b border-primary/10 bg-primary/[0.035] px-5 py-9 text-center sm:px-10 sm:py-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/[0.035] sm:h-[72px] sm:w-[72px]">
              {isCod ? <Banknote className="h-8 w-8 text-primary sm:h-9 sm:w-9" strokeWidth={1.8} /> : <CheckCircle2 className="h-9 w-9 text-primary sm:h-10 sm:w-10" strokeWidth={1.8} />}
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary sm:text-xs">
              {isCod ? t('COD অর্ডার নিশ্চিত হয়েছে', 'COD ORDER CONFIRMED') : t('অর্ডার নিশ্চিত হয়েছে', 'ORDER CONFIRMED')}
            </p>
            <h1 className="mt-2 text-[30px] font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
              {t('ধন্যবাদ! আপনার অর্ডার সফল হয়েছে।', 'Thank you! Your order was placed successfully.')}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              {isCod
                ? t('আপনার অর্ডারটি প্রস্তুত করা হচ্ছে। বাকি টাকা ডেলিভারির সময় পরিশোধ করবেন।', 'Your order is being prepared. The remaining balance will be collected on delivery.')
                : t('আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। আমাদের টিম খুব শীঘ্রই আপনার সাথে যোগাযোগ করবে।', 'Your order has been received successfully. Our team will contact you shortly.')}
            </p>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t('আপনার অর্ডার নম্বর', 'YOUR ORDER NUMBER')}</p>
                  <p className="mt-1 break-all text-xl font-bold tracking-tight text-foreground sm:text-2xl">{orderNumber || '—'}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><PackageCheck className="h-5 w-5 text-primary" /></div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {amount && (
                  <div className="rounded-xl border border-border/60 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/[0.08]"><CreditCard className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isCod ? t('অগ্রিম পরিশোধ', 'COD ADVANCE PAID') : t('পরিশোধের পরিমাণ', 'PAID AMOUNT')}</p>
                        <p className="mt-0.5 text-base font-bold text-foreground">{formatPrice(Number(amount))}</p>
                      </div>
                    </div>
                  </div>
                )}
                {(isPaid || isCod) && (
                  <div className="rounded-xl border border-primary/10 bg-primary/[0.045] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {isCod && dueAmount ? t('ডেলিভারিতে পরিশোধযোগ্য', 'COD DUE ON DELIVERY') : t('পেমেন্ট স্ট্যাটাস', 'PAYMENT STATUS')}
                    </p>
                    <p className="mt-0.5 text-base font-bold text-primary">
                      {isCod && dueAmount ? formatPrice(Number(dueAmount)) : isCod ? t('COD · আংশিক পরিশোধিত', 'COD · PARTIALLY PAID') : t('পরিশোধিত', 'PAID')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/10 bg-primary/[0.045] p-5 sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm"><ShieldCheck className="h-5 w-5 text-primary" /></div>
              <h2 className="mt-4 text-base font-bold text-foreground">{t('নিরাপদ অর্ডার', 'Secure order')}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('আপনার অর্ডারের তথ্য নিরাপদভাবে ব্যবস্থাপনা করা হচ্ছে।', 'Your order information is handled securely.')}</p>
              {isCod && (
                <div className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{t('COD বাকি টাকা', 'COD BALANCE')}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-amber-900/80">
                    {dueAmount
                      ? t('ডেলিভারির সময় ' + formatPrice(Number(dueAmount)) + ' কুরিয়ারকে পরিশোধ করবেন।', 'Please pay ' + formatPrice(Number(dueAmount)) + ' to the courier on delivery.')
                      : t('অবশিষ্ট টাকা ডেলিভারির সময় কুরিয়ারকে পরিশোধ করবেন।', 'Please pay the remaining balance to the courier on delivery.')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="rounded-2xl border border-border/70 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Truck className="h-5 w-5 text-primary" /></div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{t('এখন কী হবে?', 'What happens next?')}</h2>
                  <p className="text-xs text-muted-foreground">{t('আপনার অর্ডারের পরবর্তী ধাপগুলো', 'Your order journey from here')}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                {[
                  [t('অর্ডার গ্রহণ', 'Order received'), t('আপনার অর্ডার নিশ্চিত হয়েছে।', 'Your order is confirmed.')],
                  [t('প্রস্তুত করা হবে', 'Being prepared'), t('আমরা আপনার প্যাকেট প্রস্তুত করব।', 'We will prepare your package.')],
                  [t('ডেলিভারিতে যাবে', 'Out for delivery'), t('কুরিয়ার আপনার প্যাকেট নিয়ে যাবে।', 'The courier will deliver your package.')],
                ].map(([title, description], index) => (
                  <div key={title} className="flex gap-3">
                    <span className={\`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold \${index === 0 ? 'bg-primary text-primary-foreground' : 'border border-primary/20 bg-primary/[0.05] text-primary'}\`}>{index + 1}</span>
                    <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-5 sm:flex-row sm:justify-center sm:px-6">
            <Link href="/track-order" className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-7 text-sm font-semibold shadow-[0_12px_28px_-16px_hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
              <PackageCheck className="h-4 w-4" />{t('অর্ডার ট্র্যাক করুন', 'Track your order')}<ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/all-products" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-7 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
              <ShoppingBag className="h-4 w-4 text-primary" />{t('আরও বীজ কিনুন', 'Continue shopping')}
            </Link>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>{t('বিশ্বস্ত বীজ · নিরাপদ অর্ডার · যত্নসহকারে ডেলিভারি', 'Trusted seeds · Secure orders · Careful delivery')}</span>
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
