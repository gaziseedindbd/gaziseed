'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setChecking(false);
      if (!session) {
        setError('রিসেট লিংকটি অবৈধ বা মেয়াদ শেষ হয়েছে। আবার পাসওয়ার্ড রিসেট করুন।');
      }
    };

    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
      return;
    }
    if (password !== confirmPassword) {
      setError('নতুন পাসওয়ার্ড এবং নিশ্চিত পাসওয়ার্ড মিলছে না।');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('রিসেট সেশন পাওয়া যায়নি। আবার পাসওয়ার্ড রিসেট করুন।');

      const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
      if (adminError) throw adminError;
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error('এই অ্যাকাউন্টে অ্যাডমিন অ্যাক্সেস নেই।');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।');
      await supabase.auth.signOut();
      setTimeout(() => router.push('/allahmohammad/admin/login786'), 900);
    } catch (err: any) {
      setError(err.message || 'পাসওয়ার্ড পরিবর্তন করা যায়নি');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/10 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-xl font-bold">G</span>
          </div>
          <h1 className="text-2xl font-bold">GAZI SEED Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">নতুন অ্যাডমিন পাসওয়ার্ড সেট করুন</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">নতুন পাসওয়ার্ড</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-bangla" minLength={8} autoComplete="new-password" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">পাসওয়ার্ড নিশ্চিত করুন</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-bangla" minLength={8} autoComplete="new-password" required />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {message && <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{message}</p>}
          <button type="submit" disabled={loading || checking} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : checking ? 'যাচাই করা হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
          </button>
        </form>
      </div>
    </div>
  );
}
