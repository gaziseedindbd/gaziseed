'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, KeyRound, X, LockKeyhole } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { useLang } from '@/components/site/language-provider';

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.7 2.91-4.2 2.91-7.21Z"/><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.52A9.74 9.74 0 0 0 12 21.5Z"/><path fill="#FBBC05" d="M6.54 13.59A5.86 5.86 0 0 1 6.23 12c0-.55.11-1.09.31-1.59V7.89H3.3A9.73 9.73 0 0 0 2.5 12c0 1.57.38 3.06 1.03 4.41l3.01-2.82Z"/><path fill="#EA4335" d="M12 6.38c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.83 3.41 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.39l3.24 2.52C7.31 8.1 9.46 6.38 12 6.38Z"/></svg>;
}

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!showForgot) return;
    setResetEmail(form.email);
    setResetSent(false);
  }, [showForgot, form.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError(t('ইমেইল ও পাসওয়ার্ড দিন', 'Enter your email and password')); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) throw error;
      toast(t('লগইন সফল হয়েছে', 'Login successful'));
      router.push('/account');
    } catch (err: any) {
      setError(err.message || t('লগইন ব্যর্থ হয়েছে', 'Login failed'));
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/account`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'select_account' } },
      });
      if (error) throw error;
    } catch (err: any) {
      setGoogleLoading(false);
      setError(err.message || t('Google দিয়ে লগইন করা যায়নি', 'Google sign in failed'));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { setError(t('ইমেইল ঠিকানা দিন', 'Enter your email address')); return; }
    setResetLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo });
      if (error) throw error;
      setResetSent(true);
      toast(t('পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে', 'Password reset link sent'));
    } catch (err: any) {
      setError(err.message || t('পাসওয়ার্ড রিসেট অনুরোধ ব্যর্থ হয়েছে', 'Password reset request failed'));
    } finally { setResetLoading(false); }
  };

  return (
    <main className="neo-auth min-h-[calc(100vh-160px)] px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-[470px]">
        <section className="neo-card px-5 py-8 sm:px-10 sm:py-10">
          <div className="text-center">
            <div className="neo-icon mx-auto"><LockKeyhole className="h-8 w-8" strokeWidth={1.8} /></div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-slate-500">GAZI SEED</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-800 sm:text-4xl">{t('স্বাগতম', 'Welcome')}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{t('আপনার account-এ লগইন করুন', 'Sign in to your account')}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="neo-label">{t('ইমেইল', 'Email')}</label>
              <input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="neo-input" required />
            </div>
            <div>
              <label className="neo-label">{t('পাসওয়ার্ড', 'Password')}</label>
              <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="neo-input" required />
            </div>
            {error && !showForgot && <p role="alert" className="neo-error">{error}</p>}
            <div className="flex items-center justify-end">
              <button type="button" onClick={() => setShowForgot(true)} className="neo-link text-sm">{t('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot password?')}</button>
            </div>
            <button type="submit" disabled={loading || googleLoading} className="neo-button neo-button-primary">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('লগইন করুন', 'LOGIN')}
            </button>
          </form>

          <div className="my-7 flex items-center gap-3"><span className="neo-line" /><span className="text-xs font-bold text-slate-400">{t('অথবা', 'OR')}</span><span className="neo-line" /></div>

          <button type="button" onClick={handleGoogleLogin} disabled={googleLoading || loading} className="neo-button neo-button-secondary">
            {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}<span>{t('Google দিয়ে চালিয়ে যান', 'Continue with Google')}</span>
          </button>

          <div className="mt-7 text-center text-sm text-slate-500">
            {t('অ্যাকাউন্ট নেই?', "Don't have an account?")} <Link href="/register" className="neo-link font-black">{t('সাইন আপ করুন', 'Sign up')}</Link>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <div className="neo-mini" aria-hidden="true">G</div><div className="neo-mini" aria-hidden="true">A</div><div className="neo-mini" aria-hidden="true">Z</div><div className="neo-mini" aria-hidden="true">I</div>
          </div>
        </section>
      </div>

      {showForgot && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
        <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm" onClick={() => setShowForgot(false)} />
        <div className="neo-modal relative z-10 w-full max-w-md p-6 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-4"><h3 id="forgot-password-title" className="flex items-center gap-2 font-black text-slate-800"><KeyRound className="h-5 w-5 text-cyan-600" /> {t('পাসওয়ার্ড রিসেট', 'Reset password')}</h3><button type="button" onClick={() => setShowForgot(false)} aria-label={t('বন্ধ করুন', 'Close')} className="neo-close"><X className="h-5 w-5" /></button></div>
          {resetSent ? <div className="space-y-4"><p className="neo-success">{t('রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইমেইলের লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।', 'A reset link has been sent to your email. Click the link in the email to set a new password.')}</p><button type="button" onClick={() => setShowForgot(false)} className="neo-button neo-button-primary">{t('লগইনে ফিরুন', 'Back to login')}</button></div> : <form onSubmit={handleResetPassword} className="space-y-4"><p className="text-sm leading-6 text-slate-500">{t('আপনার account-এর ইমেইল দিন। আমরা একটি secure password reset link পাঠাব।', 'Enter your account email. We will send you a secure password reset link.')}</p><div><label className="neo-label">{t('ইমেইল', 'Email')}</label><input type="email" inputMode="email" autoComplete="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="neo-input" required /></div>{error && <p className="neo-error" role="alert">{error}</p>}<button type="submit" disabled={resetLoading} className="neo-button neo-button-primary">{resetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('রিসেট লিংক পাঠান', 'Send reset link')}</button></form>}
        </div>
      </div>}

      <style jsx>{`
        .neo-auth{background:linear-gradient(135deg,#eef3f7 0%,#f7f9fb 50%,#e8eef3 100%);display:flex;align-items:center;justify-content:center}
        .neo-card{border-radius:34px;background:#eef3f7;box-shadow:18px 18px 38px rgba(163,177,198,.42),-18px -18px 38px rgba(255,255,255,.95);border:1px solid rgba(255,255,255,.7)}
        .neo-icon{width:82px;height:82px;border-radius:28px;display:flex;align-items:center;justify-content:center;color:#0f8796;background:#eef3f7;box-shadow:inset 8px 8px 16px rgba(163,177,198,.42),inset -8px -8px 16px rgba(255,255,255,.95),10px 10px 20px rgba(163,177,198,.22),-8px -8px 18px rgba(255,255,255,.75)}
        .neo-label{display:block;margin:0 0 9px 4px;font-size:13px;font-weight:800;color:#566575}
        .neo-input{width:100%;height:54px;border:0;border-radius:17px;background:#eef3f7;color:#263746;padding:0 17px;outline:none;box-shadow:inset 6px 6px 13px rgba(163,177,198,.40),inset -6px -6px 13px rgba(255,255,255,.95);transition:box-shadow .2s,transform .2s}
        .neo-input::placeholder{color:#9aa7b4}.neo-input:focus{box-shadow:inset 5px 5px 11px rgba(163,177,198,.34),inset -5px -5px 11px rgba(255,255,255,.96),0 0 0 3px rgba(34,211,238,.16),0 0 18px rgba(34,211,238,.18)}
        .neo-button{width:100%;min-height:54px;border:0;border-radius:17px;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:900;transition:transform .2s,box-shadow .2s;box-shadow:8px 8px 16px rgba(163,177,198,.42),-8px -8px 16px rgba(255,255,255,.9)}
        .neo-button:hover:not(:disabled){transform:translateY(-1px)}.neo-button:active:not(:disabled){transform:translateY(1px);box-shadow:inset 5px 5px 11px rgba(163,177,198,.34),inset -5px -5px 11px rgba(255,255,255,.92)}.neo-button:disabled{opacity:.55;cursor:not-allowed}
        .neo-button-primary{color:#fff;background:linear-gradient(135deg,#16b7c7,#0797a9);box-shadow:8px 8px 17px rgba(128,151,170,.42),-8px -8px 17px rgba(255,255,255,.9),0 7px 20px rgba(14,165,183,.20)}
        .neo-button-secondary{color:#445565;background:#eef3f7}.neo-link{color:#078fa1;transition:color .2s}.neo-link:hover{color:#056b79;text-decoration:underline}.neo-line{height:1px;flex:1;background:linear-gradient(90deg,transparent,#c5ced7,transparent)}
        .neo-mini{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#657585;background:#eef3f7;box-shadow:6px 6px 12px rgba(163,177,198,.38),-6px -6px 12px rgba(255,255,255,.9)}
        .neo-error{border-radius:14px;padding:11px 13px;background:#fff0f0;color:#c53c3c;box-shadow:inset 3px 3px 7px rgba(200,120,120,.16),inset -3px -3px 7px rgba(255,255,255,.9);font-size:13px;line-height:1.5}.neo-success{border-radius:16px;padding:14px;background:#edfafa;color:#28757c;font-size:14px;line-height:1.6;box-shadow:inset 4px 4px 9px rgba(163,177,198,.22),inset -4px -4px 9px rgba(255,255,255,.9)}
        .neo-modal{border-radius:28px;background:#eef3f7;box-shadow:20px 20px 45px rgba(25,45,65,.28),-14px -14px 35px rgba(255,255,255,.95)}.neo-close{width:40px;height:40px;border:0;border-radius:13px;color:#6c7b88;background:#eef3f7;box-shadow:5px 5px 10px rgba(163,177,198,.35),-5px -5px 10px rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center}
        @media (prefers-reduced-motion:reduce){.neo-button,.neo-input,.neo-link{transition:none}}
      `}</style>
    </main>
  );
}
