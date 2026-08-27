'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, AlertTriangle, Check } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      setUser(data.session.user);
      const mustChange = (data.session.user.app_metadata as any)?.must_change_password;
      if (!mustChange) { router.push('/account'); }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.newPassword.length < 8) { setError('পাসওয়ার্ড কমপক্ষি ৮ অক্ষরের হতে হবে'); return; }
    if (form.newPassword !== form.confirmPassword) { setError('পাসওয়ার্ড মিলছে না'); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: form.newPassword });
      if (updateError) throw updateError;

      // Clear must_change_password flag via edge function
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-customer-support`;

      if (token) {
        await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'force_password_change', target_user_id: user.id }),
        }).catch(() => {});
      }

      toast('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে');
      router.push('/account');
    } catch (err: any) {
      setError(err.message || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-custom flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
            <Lock className="h-6 w-6 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold">নতুন পাসওয়ার্ড সেট করুন</h1>
          <p className="mt-2 text-sm text-muted-foreground">নিরাপত্তার জন্য একটি নতুন পাসওয়ার্ড সেট করা আবশ্যক</p>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">আপনি একটি টেম্পোরারি পাসওয়ার্ড দিয়ে লগইন করেছেন। নিরাপত্তার জন্য একটি নতুন পাসওয়ার্ড সেট করা বাধ্যতামূলক।</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">নতুন পাসওয়ার্ড</label>
            <input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className="input-bangla" placeholder="কমপক্ষি ৮ অক্ষর" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">পাসওয়ার্ড নিশ্চিত করুন</label>
            <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="input-bangla" required />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> পাসওয়ার্ড আপডেট করুন</>}
          </button>
        </form>
      </div>
    </div>
  );
}
