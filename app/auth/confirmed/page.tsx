'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useLang } from '@/components/site/language-provider';

export default function AuthConfirmedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLang();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const finishConfirmation = async () => {
      const nextParam = searchParams.get('next') || '/account';
      const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account';
      const verified = searchParams.get('verified') === '1';
      const target = verified
        ? `${next}?verified=1`
        : next;
      const code = searchParams.get('code');

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        if (active) setError(sessionError.message);
        return;
      }

      if (!data.session) {
        // Supabase's browser client may still be processing the auth callback/hash.
        await new Promise((resolve) => setTimeout(resolve, 250));
        const retry = await supabase.auth.getSession();

        if (!retry.data.session) {
          if (active) {
            setError(
              t(
                'ইমেইল verification সম্পন্ন হয়েছে, কিন্তু session তৈরি করা যায়নি। আবার Login করুন।',
                'Your email was verified, but we could not create a session. Please sign in again.'
              )
            );
          }
          return;
        }
      }

      router.replace(target);
    };

    finishConfirmation().catch((err: any) => {
      if (active) {
        setError(
          err?.message ||
            t(
              'ইমেইল verification সম্পন্ন করা যায়নি।',
              'Could not complete email verification.'
            )
        );
      }
    });

    return () => {
      active = false;
    };
  }, [router, searchParams, t]);

  if (error) {
    return (
      <main className="flex min-h-[calc(100vh-160px)] items-center justify-center bg-gradient-to-b from-primary/[0.06] via-background to-accent/[0.05] px-4 py-10">
        <div className="w-full max-w-md rounded-[2rem] border border-destructive/15 bg-card p-6 text-center shadow-xl sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-black text-foreground">
            {t('Verification সম্পন্ন করা যায়নি', 'Verification could not be completed')}
          </h1>
          <p role="alert" className="mt-3 rounded-xl border border-destructive/15 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
            {error}
          </p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground"
          >
            {t('লগইনে যান', 'Go to sign in')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-160px)] items-center justify-center bg-gradient-to-b from-primary/[0.06] via-background to-accent/[0.05] px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-7 text-center shadow-xl sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-foreground">
          {t('ইমেইল verification সম্পন্ন হচ্ছে…', 'Finishing email verification…')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t('আপনাকে আপনার account dashboard-এ নিয়ে যাচ্ছি।', 'Taking you to your account dashboard.')}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('একটু অপেক্ষা করুন', 'Please wait')}
        </div>
      </div>
    </main>
  );
}
