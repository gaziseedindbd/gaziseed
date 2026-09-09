'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sprout } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { processReferralOnSignup } from '@/lib/referral';
import { useLang } from '@/components/site/language-provider';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { t } = useLang();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const finishOAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const errorDescription = params.get('error_description') || params.get('error');
      const nextParam = params.get('next') || '/account';
      const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account';
      const referralCode = params.get('ref');

      if (errorDescription) {
        if (active) setError(errorDescription);
        return;
      }

      if (!code) {
        if (active) setError(t('OAuth callback code পাওয়া যায়নি। আবার চেষ্টা করুন।', 'OAuth callback code was not found. Please try again.'));
        return;
      }

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        if (active) setError(exchangeError.message || t('Google লগইন সম্পন্ন করা যায়নি।', 'Could not complete Google sign in.'));
        return;
      }

      if (data.user) {
        await processReferralOnSignup(data.user.id, referralCode);
      }

      router.replace(next);
    };

    finishOAuth().catch((err: any) => {
      if (active) setError(err?.message || t('Google লগইন সম্পন্ন করা যায়নি।', 'Could not complete Google sign in.'));
    });

    return () => { active = false; };
  }, [router, t]);

  if (error) {
    return <main className="flex min-h-[calc(100vh-160px)] items-center justify-center bg-gradient-to-b from-primary/[0.06] via-background to-accent/[0.05] px-4 py-10"><div className="w-full max-w-md rounded-[2rem] border border-destructive/15 bg-card p-6 text-center shadow-xl sm:p-8"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sprout className="h-6 w-6" /></div><h1 className="mt-5 text-xl font-black">{t('Google লগইন ব্যর্থ হয়েছে', 'Google sign in failed')}</h1><p role="alert" className="mt-3 rounded-xl border border-destructive/15 bg-destructive/10 p-3 text-sm leading-6 text-destructive">{error}</p><button type="button" onClick={() => router.replace('/login')} className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">{t('লগইনে ফিরুন', 'Back to sign in')}</button></div></main>;
  }

  return <main className="flex min-h-[calc(100vh-160px)] items-center justify-center bg-gradient-to-b from-primary/[0.06] via-background to-accent/[0.05] px-4 py-10"><div className="text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Loader2 className="h-7 w-7 animate-spin" /></div><h1 className="mt-5 text-xl font-black">{t('Google লগইন সম্পন্ন হচ্ছে…', 'Completing Google sign in…')}</h1><p className="mt-2 text-sm text-muted-foreground">{t('একটু অপেক্ষা করুন', 'Please wait a moment')}</p></div></main>;
}