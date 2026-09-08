'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle, Sprout } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setReady(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 8) { setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে'); return; }
    if (password.length > 20) { setError('পাসওয়ার্ড সর্বোচ্চ ২০ অক্ষরের হতে হবে'); return; }
    if (password !== confirmPassword) { setError('পাসওয়ার্ড মেলে না'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন নতুন পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।');
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err.message || 'পাসওয়ার্ড পরিবর্তন করা যায়নি');
    } finally { setLoading(false); }
  };

  return <main className="min-h-[calc(100vh-160px)] bg-gradient-to-b from-primary/[0.06] via-background to-accent/[0.05] px-4 py-8 sm:py-14"><div className="mx-auto w-full max-w-md rounded-[2rem] border border-primary/10 bg-card p-5 shadow-[0_24px_80px_-38px_hsl(var(--primary)/0.45)] sm:p-10"><div className="mb-7 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sprout className="h-6 w-6" /></div><p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-primary">GAZI SEED</p><h1 className="mt-3 text-2xl font-black">নতুন পাসওয়ার্ড সেট করুন</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">আপনার account-এর জন্য একটি নতুন নিরাপদ পাসওয়ার্ড দিন।</p></div>{message ? <div className="space-y-4"><div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{message}</span></div><Link href="/login" className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">লগইনে ফিরুন</Link></div> : !ready ? <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-center text-sm text-muted-foreground"><AlertCircle className="mx-auto mb-2 h-5 w-5" />এই reset link বৈধ নয় বা মেয়াদ শেষ হয়েছে। আবার password reset request করুন।</div> : <form onSubmit={handleSubmit} className="space-y-4"><div><label className="mb-1.5 block text-sm font-bold">নতুন পাসওয়ার্ড</label><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-bangla h-12 w-full rounded-xl" required maxLength={20} /></div><div><label className="mb-1.5 block text-sm font-bold">পাসওয়ার্ড নিশ্চিত করুন</label><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-bangla h-12 w-full rounded-xl" required maxLength={20} /></div>{error && <p role="alert" className="rounded-xl border border-destructive/15 bg-destructive/10 p-3 text-sm font-medium leading-5 text-destructive">{error}</p>}<button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground disabled:opacity-50">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'পাসওয়ার্ড পরিবর্তন করুন'}</button></form>}</div></main>;
}