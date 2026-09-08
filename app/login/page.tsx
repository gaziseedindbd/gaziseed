'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, KeyRound, X, Sprout, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    if (!form.email || !form.password) { setError('ইমেইল ও পাসওয়ার্ড দিন'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) throw error;
      toast('লগইন সফল হয়েছে');
      router.push('/account');
    } catch (err: any) {
      setError(err.message || 'লগইন ব্যর্থ হয়েছে');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { setError('ইমেইল ঠিকানা দিন'); return; }
    setResetLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo });
      if (error) throw error;
      setResetSent(true);
      toast('পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে');
    } catch (err: any) {
      setError(err.message || 'পাসওয়ার্ড রিসেট অনুরোধ ব্যর্থ হয়েছে');
    } finally { setResetLoading(false); }
  };

  return <main className="min-h-[calc(100vh-160px)] bg-gradient-to-b from-primary/[0.06] via-background to-accent/[0.05] px-4 py-8 sm:py-14"><div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-[0_24px_80px_-38px_hsl(var(--primary)/0.45)] lg:grid-cols-[.9fr_1.1fr]"><div className="hidden bg-gradient-to-br from-primary to-primary/85 p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between"><div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Sprout className="h-6 w-6" /></div><p className="mt-7 text-xs font-black uppercase tracking-[0.2em] opacity-70">GAZI SEED</p><h2 className="mt-2 text-4xl font-black leading-tight">আপনার বাগান ও চাষের সঙ্গী</h2><p className="mt-4 text-sm leading-7 opacity-80">আপনার অর্ডার, wishlist এবং account details এক জায়গা থেকে পরিচালনা করুন।</p></div><div className="flex items-center gap-2 text-xs font-semibold opacity-80"><ShieldCheck className="h-4 w-4" /> নিরাপদ customer account</div></div><div className="p-5 sm:p-10"><div className="mx-auto max-w-md"><div className="mb-6 text-center lg:hidden"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sprout className="h-6 w-6" /></div><p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-primary">GAZI SEED</p></div><h1 className="text-center text-3xl font-black tracking-tight">স্বাগতম</h1><p className="mt-2 text-center text-sm leading-6 text-muted-foreground">আপনার GAZI SEED account-এ নিরাপদে লগইন করুন</p><form onSubmit={handleSubmit} className="mt-7 space-y-5"><div><label className="mb-1.5 block text-sm font-bold">ইমেইল</label><input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-bangla h-12 w-full rounded-xl" required /></div><div><label className="mb-1.5 block text-sm font-bold">পাসওয়ার্ড</label><input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-bangla h-12 w-full rounded-xl" required /></div>{error && !showForgot && <p role="alert" className="rounded-xl border border-destructive/15 bg-destructive/10 p-3 text-sm font-medium leading-5 text-destructive">{error}</p>}<button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'লগইন করুন'}</button><div className="flex flex-col gap-3 text-center text-sm"><Link href="/register" className="font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">নতুন অ্যাকাউন্ট তৈরি করুন</Link><button type="button" onClick={() => setShowForgot(true)} className="inline-flex min-h-10 items-center justify-center gap-1 font-semibold text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><KeyRound className="h-3.5 w-3.5" /> পাসওয়ার্ড ভুলে গেছেন?</button></div></form></div></div></div>{showForgot && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title"><div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowForgot(false)} /><div className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-border bg-background p-5 shadow-2xl sm:p-6"><div className="mb-4 flex items-center justify-between gap-4"><h3 id="forgot-password-title" className="flex items-center gap-2 font-black"><KeyRound className="h-5 w-5 text-primary" /> পাসওয়ার্ড রিসেট</h3><button type="button" onClick={() => setShowForgot(false)} aria-label="Close" className="rounded-lg p-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-5 w-5" /></button></div>{resetSent ? <div className="space-y-4"><p className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6">রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইমেইলের লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।</p><button type="button" onClick={() => setShowForgot(false)} className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">লগইনে ফিরুন</button></div> : <form onSubmit={handleResetPassword} className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">আপনার account-এর ইমেইল দিন। আমরা একটি secure password reset link পাঠাব।</p><div><label className="mb-1.5 block text-sm font-bold">ইমেইল</label><input type="email" inputMode="email" autoComplete="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="input-bangla h-12 w-full rounded-xl" required /></div>{error && <p role="alert" className="rounded-xl border border-destructive/15 bg-destructive/10 p-3 text-sm font-medium leading-5 text-destructive">{error}</p>}<button type="submit" disabled={resetLoading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground disabled:opacity-50">{resetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'রিসেট লিংক পাঠান'}</button></form>}</div></div>}</main>;
}