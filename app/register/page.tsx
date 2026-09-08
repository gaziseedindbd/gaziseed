'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check, X, Sprout, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processReferralOnSignup } from '@/lib/referral';
import { useLang } from '@/components/site/language-provider';

export default function RegisterPage() {
  const { t } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!form.name || !form.email || !form.password) { setError(t('সব প্রয়োজনীয় তথ্য পূরণ করুন', 'Please fill in all required fields')); return; }
    if (form.password !== form.confirmPassword) { setError(t('পাসওয়ার্ড মেলে না', 'Passwords do not match')); return; }
    if (!allRulesPassed) { setError(t('পাসওয়ার্ড নিয়ম মেনে চলুন', 'Please follow the password requirements')); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { name: form.name, phone: form.phone } } });
      if (error) throw error;
      if (data.user) { const referralCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null; await processReferralOnSignup(data.user.id, referralCode); }
      toast(t('অ্যাকাউন্ট তৈরি সফল হয়েছে', 'Account created successfully')); router.push('/account');
    } catch (err: any) { setError(err.message || t('রেজিস্ট্রেশন ব্যর্থ হয়েছে', 'Registration failed')); }
    finally { setLoading(false); }
  };

  return <main className="min-h-[calc(100vh-160px)] bg-gradient-to-b from-primary/[0.06] via-background to-accent/[0.05] px-4 py-7 sm:py-12"><div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-[0_24px_80px_-38px_hsl(var(--primary)/0.45)] lg:grid-cols-[.85fr_1.15fr]"><div className="hidden bg-gradient-to-br from-primary to-primary/85 p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between"><div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Sprout className="h-6 w-6" /></div><p className="mt-7 text-xs font-black uppercase tracking-[0.2em] opacity-70">GAZI SEED</p><h2 className="mt-2 text-4xl font-black leading-tight">{t('আজই আপনার seed journey শুরু করুন', 'Start your seed journey today')}</h2><p className="mt-4 text-sm leading-7 opacity-80">{t('অর্ডার, wishlist, saved addresses এবং আরও সুবিধা এক account-এ।', 'Orders, wishlist, saved addresses, and more—all in one account.')}</p></div><div className="flex items-center gap-2 text-xs font-semibold opacity-80"><ShieldCheck className="h-4 w-4" /> {t('দ্রুত ও নিরাপদ signup', 'Fast and secure signup')}</div></div><div className="p-5 sm:p-10"><div className="mx-auto max-w-md"><div className="mb-6 text-center lg:hidden"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sprout className="h-6 w-6" /></div><p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-primary">GAZI SEED</p></div><h1 className="text-center text-3xl font-black tracking-tight">{t('নতুন অ্যাকাউন্ট', 'Create account')}</h1><p className="mt-2 text-center text-sm leading-6 text-muted-foreground">{t('কয়েকটি তথ্য দিয়ে নিরাপদে account তৈরি করুন', 'Create your account securely with a few details')}</p><form onSubmit={handleSubmit} className="mt-7 space-y-4"><div><label className="mb-1.5 block text-sm font-bold">{t('নাম', 'Name')} *</label><input type="text" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-bangla h-12 w-full rounded-xl" required /></div><div><label className="mb-1.5 block text-sm font-bold">{t('ইমেইল', 'Email')} *</label><input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-bangla h-12 w-full rounded-xl" required /></div><div><label className="mb-1.5 block text-sm font-bold">{t('মোবাইল নম্বর', 'Mobile number')} <span className="font-normal text-muted-foreground">({t('ঐচ্ছিক', 'optional')})</span></label><input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-bangla h-12 w-full rounded-xl" placeholder="01XXXXXXXXX" /></div><div><label className="mb-1.5 block text-sm font-bold">{t('পাসওয়ার্ড', 'Password')} *</label><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-bangla h-12 w-full rounded-xl" required maxLength={20} />{form.password.length > 0 && <div className="mt-3 grid gap-1 rounded-2xl border border-border/70 bg-secondary/35 p-3 sm:grid-cols-2">{passwordChecksWithState.map((rule, idx) => <div key={idx} className="flex items-start gap-2 text-xs leading-5">{rule.passed ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}<span className={rule.passed ? 'text-green-600' : 'text-muted-foreground'}>{rule.label}</span></div>)}</div>}</div><div><label className="mb-1.5 block text-sm font-bold">{t('পাসওয়ার্ড নিশ্চিত করুন', 'Confirm password')} *</label><input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="input-bangla h-12 w-full rounded-xl" required /></div>{error && <p role="alert" className="rounded-xl border border-destructive/15 bg-destructive/10 p-3 text-sm font-medium leading-5 text-destructive">{error}</p>}<button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('অ্যাকাউন্ট তৈরি করুন', 'Create account')}</button><p className="text-center text-sm leading-6 text-muted-foreground">{t('অ্যাকাউন্ট আছে?', 'Already have an account?')} <Link href="/login" className="font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t('লগইন করুন', 'Sign in')}</Link></p></form></div></div></div></main>;
}