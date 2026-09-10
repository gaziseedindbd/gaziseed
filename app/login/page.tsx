'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, KeyRound, X, Sprout, ShieldCheck } from 'lucide-react';
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
    <main className="electric-auth relative min-h-[calc(100vh-160px)] overflow-hidden px-4 py-8 sm:py-14">
      <div className="electric-orb electric-orb-one" aria-hidden="true" />
      <div className="electric-orb electric-orb-two" aria-hidden="true" />
      <div className="electric-grid" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="electric-frame">
          <div className="electric-panel hidden lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="electric-logo"><Sprout className="h-7 w-7" /></div>
              <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">GAZI SEED</p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-white">{t('আপনার বাগান ও চাষের সঙ্গী', 'Your partner for gardening & farming')}</h2>
              <p className="mt-5 text-sm leading-7 text-slate-300">{t('আপনার অর্ডার, wishlist এবং account details এক জায়গা থেকে পরিচালনা করুন।', 'Manage your orders, wishlist, and account details in one place.')}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><ShieldCheck className="h-4 w-4 text-cyan-300" /> {t('নিরাপদ customer account', 'Secure customer account')}</div>
          </div>

          <div className="electric-content">
            <div className="mx-auto max-w-md">
              <div className="mb-6 text-center lg:hidden">
                <div className="electric-logo mx-auto"><Sprout className="h-7 w-7" /></div>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.3em] text-cyan-400">GAZI SEED</p>
              </div>
              <div className="text-center">
                <span className="electric-kicker">SECURE ACCESS</span>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{t('স্বাগতম', 'Welcome')}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">{t('আপনার GAZI SEED account-এ নিরাপদে লগইন করুন', 'Sign in securely to your GAZI SEED account')}</p>
              </div>

              <button type="button" onClick={handleGoogleLogin} disabled={googleLoading || loading} className="electric-button electric-button-secondary mt-7">
                {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}<span>{t('Google দিয়ে চালিয়ে যান', 'Continue with Google')}</span>
              </button>

              <div className="my-6 flex items-center gap-3 text-xs font-bold tracking-widest text-slate-500"><span className="h-px flex-1 bg-white/10" /><span>{t('অথবা', 'OR')}</span><span className="h-px flex-1 bg-white/10" /></div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div><label className="electric-label">{t('ইমেইল', 'Email')}</label><input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="electric-input" required /></div>
                <div><label className="electric-label">{t('পাসওয়ার্ড', 'Password')}</label><input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="electric-input" required /></div>
                {error && !showForgot && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm font-medium leading-5 text-red-300">{error}</p>}
                <button type="submit" disabled={loading || googleLoading} className="electric-button electric-button-primary">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('লগইন করুন', 'Sign in')}
                </button>
                <div className="flex flex-col gap-3 text-center text-sm">
                  <Link href="/register" className="electric-link">{t('নতুন অ্যাকাউন্ট তৈরি করুন', 'Create a new account')}</Link>
                  <button type="button" onClick={() => setShowForgot(true)} className="electric-forgot"><KeyRound className="h-3.5 w-3.5" /> {t('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot your password?')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showForgot && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowForgot(false)} />
        <div className="electric-modal relative z-10 w-full max-w-md p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4"><h3 id="forgot-password-title" className="flex items-center gap-2 font-black text-white"><KeyRound className="h-5 w-5 text-cyan-300" /> {t('পাসওয়ার্ড রিসেট', 'Reset password')}</h3><button type="button" onClick={() => setShowForgot(false)} aria-label={t('বন্ধ করুন', 'Close')} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button></div>
          {resetSent ? <div className="space-y-4"><p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-6 text-slate-300">{t('রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইমেইলের লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।', 'A reset link has been sent to your email. Click the link in the email to set a new password.')}</p><button type="button" onClick={() => setShowForgot(false)} className="electric-button electric-button-primary">{t('লগইনে ফিরুন', 'Back to sign in')}</button></div> : <form onSubmit={handleResetPassword} className="space-y-4"><p className="text-sm leading-6 text-slate-400">{t('আপনার account-এর ইমেইল দিন। আমরা একটি secure password reset link পাঠাব।', 'Enter your account email. We will send you a secure password reset link.')}</p><div><label className="electric-label">{t('ইমেইল', 'Email')}</label><input type="email" inputMode="email" autoComplete="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="electric-input" required /></div>{error && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm font-medium leading-5 text-red-300">{error}</p>}<button type="submit" disabled={resetLoading} className="electric-button electric-button-primary">{resetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('রিসেট লিংক পাঠান', 'Send reset link')}</button></form>}
        </div>
      </div>}

      <style jsx>{`
        .electric-auth { background: radial-gradient(circle at 50% 0%, rgba(0, 229, 255, .10), transparent 38%), linear-gradient(135deg, #050812 0%, #08111d 48%, #04070d 100%); }
        .electric-grid { position:absolute; inset:0; opacity:.20; background-image:linear-gradient(rgba(0,229,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.08) 1px,transparent 1px); background-size:42px 42px; mask-image:linear-gradient(to bottom,black,transparent 85%); }
        .electric-orb { position:absolute; width:320px; height:320px; border-radius:999px; filter:blur(90px); opacity:.20; pointer-events:none; animation:float 8s ease-in-out infinite; }
        .electric-orb-one { background:#00e5ff; top:-120px; left:8%; } .electric-orb-two { background:#2563eb; right:5%; bottom:-160px; animation-delay:-4s; }
        .electric-frame { position:relative; display:grid; overflow:hidden; border-radius:32px; border:1px solid rgba(0,229,255,.35); background:rgba(8,14,25,.82); box-shadow:0 0 0 1px rgba(255,255,255,.03) inset,0 30px 100px rgba(0,0,0,.55),0 0 55px rgba(0,229,255,.10); backdrop-filter:blur(22px); }
        .electric-frame:before { content:""; position:absolute; inset:-2px; border-radius:34px; padding:2px; background:conic-gradient(from 0deg,transparent 0deg,transparent 120deg,#00e5ff 165deg,#7c3aed 205deg,transparent 250deg,transparent 360deg); -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; animation:spin 6s linear infinite; pointer-events:none; }
        .electric-panel { min-height:610px; padding:48px; background:linear-gradient(145deg,rgba(0,229,255,.11),rgba(37,99,235,.08) 45%,rgba(124,58,237,.08)); border-right:1px solid rgba(255,255,255,.07); }
        .electric-content { padding:30px 22px; background:linear-gradient(180deg,rgba(6,12,22,.78),rgba(4,8,15,.92)); }
        @media (min-width:640px){.electric-content{padding:48px}.electric-frame{grid-template-columns:.9fr 1.1fr}.electric-panel{display:flex!important}}
        .electric-logo { display:flex; align-items:center; justify-content:center; width:54px; height:54px; border-radius:18px; color:#cffafe; background:linear-gradient(145deg,rgba(0,229,255,.22),rgba(37,99,235,.14)); border:1px solid rgba(0,229,255,.38); box-shadow:inset 3px 3px 7px rgba(0,0,0,.35),inset -2px -2px 6px rgba(255,255,255,.05),0 0 24px rgba(0,229,255,.20); }
        .electric-kicker { font-size:10px; font-weight:900; letter-spacing:.25em; color:#67e8f9; }
        .electric-label { display:block; margin-bottom:8px; font-size:13px; font-weight:800; color:#cbd5e1; }
        .electric-input { width:100%; height:52px; border-radius:14px; border:1px solid rgba(148,163,184,.18); background:rgba(2,6,14,.72); color:#f8fafc; padding:0 16px; outline:none; box-shadow:inset 4px 4px 10px rgba(0,0,0,.38),inset -2px -2px 7px rgba(255,255,255,.025); transition:.25s; }
        .electric-input:focus { border-color:rgba(0,229,255,.72); box-shadow:inset 4px 4px 10px rgba(0,0,0,.38),0 0 0 3px rgba(0,229,255,.08),0 0 24px rgba(0,229,255,.14); }
        .electric-button { position:relative; display:flex; min-height:52px; width:100%; align-items:center; justify-content:center; gap:10px; border-radius:14px; padding:12px 16px; font-weight:900; transition:.25s; overflow:hidden; }
        .electric-button:hover:not(:disabled){ transform:translateY(-2px); }
        .electric-button:disabled{cursor:not-allowed;opacity:.5}.electric-button-primary{color:#001018;background:linear-gradient(135deg,#67e8f9,#22d3ee 45%,#38bdf8);box-shadow:inset 2px 2px 5px rgba(255,255,255,.55),inset -3px -3px 8px rgba(0,80,120,.35),0 0 28px rgba(0,229,255,.25)}
        .electric-button-secondary{color:#f1f5f9;background:rgba(255,255,255,.035);border:1px solid rgba(148,163,184,.18);box-shadow:inset 2px 2px 5px rgba(255,255,255,.035),inset -3px -3px 8px rgba(0,0,0,.35)}
        .electric-button-secondary:hover:not(:disabled){border-color:rgba(0,229,255,.45);box-shadow:0 0 22px rgba(0,229,255,.10)}
        .electric-link{font-weight:800;color:#67e8f9;transition:.2s}.electric-link:hover{color:#a5f3fc;text-decoration:underline}.electric-forgot{display:inline-flex;min-height:40px;align-items:center;justify-content:center;gap:5px;font-weight:700;color:#94a3b8;transition:.2s}.electric-forgot:hover{color:#67e8f9}
        .electric-modal{border:1px solid rgba(0,229,255,.35);border-radius:28px;background:rgba(6,12,22,.96);box-shadow:0 30px 100px rgba(0,0,0,.7),0 0 45px rgba(0,229,255,.12);backdrop-filter:blur(22px)}
        @keyframes spin{to{transform:rotate(360deg)}} @keyframes float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(25px,-18px,0)}}
        @media (prefers-reduced-motion:reduce){.electric-frame:before,.electric-orb{animation:none}}
      `}</style>
    </main>
  );
}
