'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, KeyRound, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [contactInfo, setContactInfo] = useState<{ phone: string; whatsapp: string; email: string } | null>(null);

  useEffect(() => {
    supabase.from('site_settings').select('phone, whatsapp, email').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setContactInfo({ phone: data.phone, whatsapp: data.whatsapp, email: data.email });
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('ইমেইল ও পাসওয়ার্ড দিন'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) throw error;

      toast('লগইন সফল হয়েছে');
      router.push('/account');
    } catch (err: any) {
      setError(err.message || 'লগইন ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-custom py-12">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold">লগইন</h1>
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
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">অ্যাকাউন্ট নেই? <Link href="/register" className="font-medium text-primary hover:underline">নতুন অ্যাকাউন্ট তৈরি করুন</Link></span>
            <button type="button" onClick={() => setShowForgot(true)} className="flex items-center gap-1 font-medium text-primary hover:underline">
              <KeyRound className="h-3.5 w-3.5" /> পাসওয়ার্ড ভুলে গেছেন?
            </button>
          </div>
        </form>
      </div>

      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForgot(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold"><KeyRound className="h-5 w-5" /> পাসওয়ার্ড ভুলে গেছেন?</h3>
              <button onClick={() => setShowForgot(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>পাসওয়ার্ড ভুলে গেলে Customer Care-এর সাথে যোগাযোগ করুন।</p>
              <p>Temporary Password-এর জন্য আমাদের Customer Care-এ যোগাযোগ করুন:</p>
              {contactInfo && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
                  {contactInfo.phone && (
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <span className="text-primary">ফোন:</span> {contactInfo.phone}
                    </p>
                  )}
                  {contactInfo.whatsapp && (
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <span className="text-primary">WhatsApp:</span> {contactInfo.whatsapp}
                    </p>
                  )}
                  {contactInfo.email && (
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <span className="text-primary">ইমেইল:</span> {contactInfo.email}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
