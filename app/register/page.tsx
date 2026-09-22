'use client';

import { useState, useMemo } from 'react';
import { getVisitorCountry, supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check, X, UserPlus, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { useLang } from '@/components/site/language-provider';

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.7 2.91-4.2 2.91-7.21Z"/><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.52A9.74 9.74 0 0 0 12 21.5Z"/><path fill="#FBBC05" d="M6.54 13.59A5.86 5.86 0 0 1 6.23 12c0-.55.11-1.09.31-1.59V7.89H3.3A9.73 9.73 0 0 0 2.5 12c0 1.57.38 3.06 1.03 4.41l3.01-2.82Z"/><path fill="#EA4335" d="M12 6.38c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.83 3.41 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.39l3.24 2.52C7.31 8.1 9.46 6.38 12 6.38Z"/></svg>;
}

export default function RegisterPage() {
  const { t } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [error, setError] = useState('');
  const passwordChecks = useMemo(() => [
    { label: t('কমপক্ষে ৮ অক্ষর', 'At least 8 characters'), test: (p: string) => p.length >= 8 },
    { label: t('সর্বোচ্চ ২০ অক্ষর', 'Maximum 20 characters'), test: (p: string) => p.length <= 20 },
    { label: t('কমপক্ষে ১টি বড় হাতের অক্ষর (A-Z)', 'At least 1 uppercase letter (A-Z)'), test: (p: string) => /[A-Z]/.test(p) },
    { label: t('কমপক্ষে ১টি ছোট হাতের অক্ষর (a-z)', 'At least 1 lowercase letter (a-z)'), test: (p: string) => /[a-z]/.test(p) },
    { label: t('কমপক্ষে ১টি সংখ্যা (0-9)', 'At least 1 number (0-9)'), test: (p: string) => /[0-9]/.test(p) },
    { label: t('কমপক্ষে ১টি বিশেষ অক্ষর ($@#!...)', 'At least 1 special character ($@#!...)'), test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ], [t]);
  const passwordChecksWithState = useMemo(() => passwordChecks.map(r => ({ ...r, passed: r.test(form.password) })), [passwordChecks, form.password]);
  const allRulesPassed = passwordChecksWithState.every(r => r.passed);

  const createReferral = async (userId: string, referralCode: string | null) => {
    if (!referralCode) return;
    try { await supabase.rpc('create_referral_on_signup', { p_referral_code: referralCode, p_new_user_id: userId }); } catch { /* Referral tracking must never block account creation. */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const country = getVisitorCountry();
    if (!form.name || !form.email || !form.password) { setError(t('সব প্রয়োজনীয় তথ্য পূরণ করুন', 'Please fill in all required fields')); return; }
    if (country === 'IN' && !form.phone.trim()) { setError(t('India-এর জন্য মোবাইল নম্বর আবশ্যক', 'Mobile number is required for India')); return; }
    if (form.password !== form.confirmPassword) { setError(t('পাসওয়ার্ড মেলে না', 'Passwords do not match')); return; }
    if (!allRulesPassed) { setError(t('পাসওয়ার্ড নিয়ম মেনে চলুন', 'Please follow the password requirements')); return; }
    setLoading(true);
    try {
      const referralCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;
      const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { name: form.name, phone: form.phone } } });
      if (error) throw error;
      if (data.user) await createReferral(data.user.id, referralCode);
      setRegisteredEmail(form.email);
      setShowVerificationModal(true);
      if (data.session) {
        router.push('/account');
      }
    } catch (err: any) { setError(err.message || t('রেজিস্ট্রেশন ব্যর্থ হয়েছে', 'Registration failed')); }
    finally { setLoading(false); }
  };

  const handleGoogleSignup = async () => {
    setError(''); setGoogleLoading(true);
    try {
      const referralCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;
      const callbackParams = new URLSearchParams({ next: '/account', mode: 'signup' });
      if (referralCode) callbackParams.set('ref', referralCode);
      const redirectTo = `${window.location.origin}/auth/callback?${callbackParams.toString()}`;
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'select_account' } } });
      if (error) throw error;
    } catch (err: any) { setGoogleLoading(false); setError(err.message || t('Google দিয়ে account তৈরি করা যায়নি', 'Google signup failed')); }
  };

  return (
    <main className="neo-auth min-h-[calc(100vh-160px)] px-4 py-7 sm:py-12">
      <div className="mx-auto w-full max-w-[500px]">
        <section className="neo-card px-5 py-8 sm:px-9 sm:py-9">
          <div className="text-center">
            <div className="neo-icon mx-auto"><UserPlus className="h-8 w-8" strokeWidth={1.8} /></div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-slate-500">GAZI SEED</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-800 sm:text-4xl">{t('নতুন অ্যাকাউন্ট', 'Create account')}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{t('কয়েকটি তথ্য দিয়ে আপনার account তৈরি করুন', 'Create your account with a few details')}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div><label className="neo-label">{t('নাম', 'Name')} *</label><input type="text" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="neo-input" required /></div>
            <div><label className="neo-label">{t('ইমেইল', 'Email')} *</label><input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="neo-input" required /></div>
            <div><label className="neo-label">{t('মোবাইল নম্বর', 'Mobile number')} <span className="font-normal text-slate-400">({t('আবশ্যক', 'required')})</span></label><input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="neo-input" placeholder="01XXXXXXXXX" /></div>
            <div><label className="neo-label">{t('পাসওয়ার্ড', 'Password')} *</label><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="neo-input" required maxLength={20} />{form.password.length > 0 && <div className="neo-rules mt-3">{passwordChecksWithState.map((rule, idx) => <div key={idx} className="flex items-start gap-2 text-xs leading-5">{rule.passed ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}<span className={rule.passed ? 'text-cyan-700' : 'text-slate-500'}>{rule.label}</span></div>)}</div>}</div>
            <div><label className="neo-label">{t('পাসওয়ার্ড নিশ্চিত করুন', 'Confirm password')} *</label><input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="neo-input" required /></div>
            {error && <p role="alert" className="neo-error">{error}</p>}
            <button type="submit" disabled={loading || googleLoading} className="neo-button neo-button-primary mt-2">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('অ্যাকাউন্ট তৈরি করুন', 'CREATE ACCOUNT')}</button>
          </form>

          <div className="my-6 flex items-center gap-3"><span className="neo-line" /><span className="text-xs font-bold text-slate-400">{t('অথবা', 'OR')}</span><span className="neo-line" /></div>
          <button type="button" onClick={handleGoogleSignup} disabled={googleLoading || loading} className="neo-button neo-button-secondary">{googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}<span>{t('Google দিয়ে account তৈরি করুন', 'Sign up with Google')}</span></button>
          <p className="mt-7 text-center text-sm text-slate-500">{t('অ্যাকাউন্ট আছে?', 'Already have an account?')} <Link href="/login" className="neo-link font-black">{t('লগইন করুন', 'Sign in')}</Link></p>
          <div className="mt-7 flex justify-center gap-3"><div className="neo-mini" aria-hidden="true">G</div><div className="neo-mini" aria-hidden="true">A</div><div className="neo-mini" aria-hidden="true">Z</div><div className="neo-mini" aria-hidden="true">I</div><div className="neo-mini" aria-hidden="true">S</div><div className="neo-mini" aria-hidden="true">E</div><div className="neo-mini" aria-hidden="true">E</div><div className="neo-mini" aria-hidden="true">D</div></div>
        </section>
      </div>

      {showVerificationModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verification-title"
        >
          <div className="verification-modal w-full max-w-md rounded-[28px] p-6 sm:p-7">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25">
              <Mail className="h-8 w-8" strokeWidth={2} />
            </div>

            <div className="mt-5 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">
                {t('ইমেইল ভেরিফিকেশন', 'EMAIL VERIFICATION')}
              </p>
              <h2 id="verification-title" className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
                {t('আপনার email verify করুন', 'Verify your email')}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {t(
                  'আপনার account তৈরি হয়েছে। আমরা একটি verification email পাঠিয়েছি। Account ব্যবহার করার আগে email address verify করুন।',
                  'Your account has been created. We sent a verification email. Please verify your email address before using your account.'
                )}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                {t('Verification email পাঠানো হয়েছে', 'VERIFICATION EMAIL SENT')}
              </p>
              <p className="mt-2 break-all text-sm font-bold text-slate-800">{registeredEmail}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="text-sm leading-6 text-slate-600">
                  <p className="font-bold text-slate-800">
                    {t('Inbox-এ email না পেলে', 'Can\'t find the email?')}
                  </p>
                  <p className="mt-1">
                    {t(
                      'কয়েক মিনিট অপেক্ষা করুন। তারপর Spam / Junk / Promotions folder-ও অবশ্যই check করুন।',
                      'Wait a few minutes, then check your Spam, Junk, or Promotions folder too.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setShowVerificationModal(false); router.push('/login'); }}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5"
            >
              {t('Login page-এ যান', 'Go to Login')}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowVerificationModal(false)}
              className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              {t('এখন নয়', 'Not now')}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .neo-auth{position:relative;overflow:hidden;background:radial-gradient(circle at 50% 8%,rgba(34,211,238,.13),transparent 34%),linear-gradient(135deg,#e9f0f5 0%,#f8fafc 50%,#e4ebf1 100%);display:flex;align-items:center;justify-content:center}.neo-auth:before{content:"";position:absolute;width:420px;height:420px;border-radius:999px;top:-230px;right:-150px;background:rgba(34,211,238,.10);filter:blur(30px);pointer-events:none}.neo-auth:after{content:"";position:absolute;width:320px;height:320px;border-radius:999px;bottom:-210px;left:-140px;background:rgba(8,145,178,.08);filter:blur(34px);pointer-events:none}
        .neo-card{position:relative;z-index:1;border-radius:34px;background:#eef3f7;box-shadow:18px 18px 38px rgba(163,177,198,.42),-18px -18px 38px rgba(255,255,255,.95);border:1px solid rgba(255,255,255,.7)}
        .neo-icon{width:82px;height:82px;border-radius:28px;display:flex;align-items:center;justify-content:center;color:#0f8796;background:#eef3f7;box-shadow:inset 8px 8px 16px rgba(163,177,198,.42),inset -8px -8px 16px rgba(255,255,255,.95),10px 10px 20px rgba(163,177,198,.22),-8px -8px 18px rgba(255,255,255,.75)}
        .neo-label{display:block;margin:0 0 8px 4px;font-size:13px;font-weight:800;color:#566575}.neo-input{width:100%;height:52px;border:0;border-radius:16px;background:#eef3f7;color:#263746;padding:0 16px;outline:none;box-shadow:inset 6px 6px 13px rgba(163,177,198,.40),inset -6px -6px 13px rgba(255,255,255,.95);transition:box-shadow .2s}.neo-input::placeholder{color:#9aa7b4}.neo-input:focus{box-shadow:inset 5px 5px 11px rgba(163,177,198,.34),inset -5px -5px 11px rgba(255,255,255,.96),0 0 0 3px rgba(34,211,238,.16),0 0 18px rgba(34,211,238,.18)}
        .neo-button{width:100%;min-height:52px;border:0;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:900;transition:transform .2s,box-shadow .2s;box-shadow:8px 8px 16px rgba(163,177,198,.42),-8px -8px 16px rgba(255,255,255,.9)}.neo-button:hover:not(:disabled){transform:translateY(-1px)}.neo-button:active:not(:disabled){transform:translateY(1px);box-shadow:inset 5px 5px 11px rgba(163,177,198,.34),inset -5px -5px 11px rgba(255,255,255,.92)}.neo-button:disabled{opacity:.55;cursor:not-allowed}.neo-button-primary{color:#fff;background:linear-gradient(135deg,#16b7c7,#0797a9);box-shadow:8px 8px 17px rgba(128,151,170,.42),-8px -8px 17px rgba(255,255,255,.9),0 7px 20px rgba(14,165,183,.20)}.neo-button-secondary{color:#445565;background:#eef3f7}
        .neo-link{color:#078fa1;transition:color .2s}.neo-link:hover{color:#056b79;text-decoration:underline}.neo-line{height:1px;flex:1;background:linear-gradient(90deg,transparent,#c5ced7,transparent)}.neo-mini{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#657585;background:#eef3f7;box-shadow:6px 6px 12px rgba(163,177,198,.38),-6px -6px 12px rgba(255,255,255,.9)}
        .verification-modal{background:#eef3f7;border:1px solid rgba(255,255,255,.78);box-shadow:20px 20px 46px rgba(15,23,42,.22),-12px -12px 32px rgba(255,255,255,.9);animation:verificationIn .22s ease-out}.verification-modal p{margin:0}
        @keyframes verificationIn{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        .neo-rules{display:grid;gap:4px;border-radius:15px;padding:11px 12px;background:#eef3f7;box-shadow:inset 4px 4px 9px rgba(163,177,198,.25),inset -4px -4px 9px rgba(255,255,255,.9)}.neo-error{border-radius:14px;padding:11px 13px;background:#fff0f0;color:#c53c3c;box-shadow:inset 3px 3px 7px rgba(200,120,120,.16),inset -3px -3px 7px rgba(255,255,255,.9);font-size:13px;line-height:1.5}
        @media (min-width:640px){.neo-rules{grid-template-columns:1fr 1fr}}@media (prefers-reduced-motion:reduce){.neo-button,.neo-input,.neo-link{transition:none}}
      `}</style>
    </main>
  );
}
