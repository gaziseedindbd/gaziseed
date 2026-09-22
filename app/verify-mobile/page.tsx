'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { getVisitorCountry, supabase } from '@/lib/supabase/client';
import { useLang } from '@/components/site/language-provider';
import { toast } from '@/components/site/toast-provider';

async function getFunctionError(error: any) {
  if (error?.context?.json) {
    try {
      const body = await error.context.json();
      if (body?.error) return String(body.error);
    } catch {}
  }
  return error?.message || '';
}

export default function VerifyMobilePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useLang();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const next = params.get('next')?.startsWith('/') && !params.get('next')?.startsWith('//') ? params.get('next')! : '/account';

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (getVisitorCountry() !== 'IN') {
      router.replace(next);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return; }
      const existing = data.user.user_metadata?.phone || '';
      if (data.user.user_metadata?.phone_verified === true) {
        router.replace(next);
        return;
      }
      setPhone(existing);
      setLoading(false);
    });
  }, [next, router]);

  const sendOtp = async () => {
    if (resendIn > 0) return;
    setError('');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-india-registration-otp', {
        body: { phone, country_code: 'IN' },
      });
      if (error) {
        const message = await getFunctionError(error);
        throw new Error(message || 'Unable to send verification SMS');
      }
      if (!data?.sent) throw new Error(data?.error || 'Unable to send verification SMS');
      setSent(true);
      setResendIn(60);
      setError('');
      toast(t('ভেরিফিকেশন কোড পাঠানো হয়েছে', 'Verification code sent'));
    } catch (e: any) {
      setError(e.message || t('SMS পাঠানো যায়নি', 'Could not send SMS'));
    } finally { setSending(false); }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-india-registration-otp', {
        body: { phone, otp, country_code: 'IN' },
      });
      if (error) {
        const message = await getFunctionError(error);
        throw new Error(message || 'Verification failed');
      }
      if (!data?.verified) throw new Error(data?.error || 'Verification failed');
      await supabase.auth.refreshSession();
      toast(t('মোবাইল নম্বর সফলভাবে verified হয়েছে', 'Mobile number verified successfully'));
      router.replace(next);
    } catch (e: any) {
      setError(e.message || t('ভেরিফিকেশন ব্যর্থ হয়েছে', 'Verification failed'));
    } finally { setVerifying(false); }
  };

  if (loading) return <main className="min-h-[calc(100vh-160px)] flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></main>;

  return (
    <main className="min-h-[calc(100vh-160px)] bg-gradient-to-b from-primary/[0.06] via-background to-accent/[0.05] px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-7 w-7" /></div>
        <h1 className="mt-5 text-center text-2xl font-black">{t('মোবাইল নম্বর যাচাই করুন', 'Verify your mobile number')}</h1>
        <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">{t('আপনার India account সক্রিয় করতে মোবাইল নম্বরটি OTP দিয়ে verify করুন।', 'Verify your mobile number with an OTP to activate your India account.')}</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold">{t('মোবাইল নম্বর', 'Mobile number')}</label>
            <input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} disabled={sent} className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="10-digit mobile number" />
          </div>
          {!sent ? (
            <button type="button" onClick={sendOtp} disabled={sending || !phone.trim() || resendIn > 0} className="w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground disabled:opacity-50">
              {sending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('OTP পাঠান', 'Send OTP')}
            </button>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold">{t('৬ সংখ্যার OTP', '6-digit OTP')}</label>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-xl font-black tracking-[0.4em] outline-none focus:ring-2 focus:ring-primary/30" placeholder="••••••" />
              </div>
              {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={verifying || otp.length !== 6} className="w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground disabled:opacity-50">
                {verifying ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('Verify করুন', 'Verify mobile')}
              </button>
              <button type="button" disabled={resendIn > 0} onClick={()=>{setSent(false);setOtp('');setError('');}} className="mx-auto flex items-center gap-2 text-xs font-bold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                <RefreshCw className="h-3.5 w-3.5" />
                {resendIn > 0 ? t(`আবার OTP পাঠাতে ${resendIn}s অপেক্ষা করুন`, `Resend OTP in ${resendIn}s`) : t('অন্য নম্বর / আবার OTP', 'Change number / resend OTP')}
              </button>
            </form>
          )}
          {error && !sent && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </div>
      </section>
    </main>
  );
}
