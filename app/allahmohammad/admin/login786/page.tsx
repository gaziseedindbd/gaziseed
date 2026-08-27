'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('ইমেইল ও পাসওয়ার্ড দিন'); return; }
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInError) throw signInError;

      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) {
        await supabase.auth.signOut();
        setError('এই অ্যাকাউন্টে অ্যাডমিন অ্যাক্সেস নেই।');
        return;
      }

      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'লগইন ব্যর্থ');
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
          <h1 className="text-2xl font-bold">SEED BARI Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">অ্যাডমিন প্যানেলে লগইন করুন</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">ইমেইল</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-bangla" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">পাসওয়ার্ড</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-bangla" required />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'লগইন করুন'}
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-primary">প্রথমবার সেটআপ:</p>
          <p className="mt-1">1. একটি অ্যাকাউন্ট তৈরি করুন <a href="/register" className="text-primary underline">/register</a> এ</p>
          <p>2. সুপারবাইজার প্যানেলে গিয়ে ইমেইলটি admin_users টেবিলে যোগ করুন</p>
        </div>
      </div>
    </div>
  );
}
