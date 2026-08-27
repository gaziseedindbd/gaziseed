'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processReferralOnSignup } from '@/lib/referral';

const PASSWORD_RULES = [
  { label: 'কমপক্ষে ৮ অক্ষর', test: (p: string) => p.length >= 8 },
  { label: 'সর্বোচ্চ ২০ অক্ষর', test: (p: string) => p.length <= 20 },
  { label: 'কমপক্ষে ১টি বড় হাতের অক্ষর (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'কমপক্ষে ১টি ছোট হাতের অক্ষর (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'কমপক্ষে ১টি সংখ্যা (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'কমপক্ষে ১টি বিশেষ অক্ষর ($@#!...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [error, setError] = useState('');

  const passwordChecks = useMemo(() => PASSWORD_RULES.map(r => ({ ...r, passed: r.test(form.password) })), [form.password]);
  const allRulesPassed = passwordChecks.every(r => r.passed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) { setError('সব প্রয়োজনীয় তথ্য পূরণ করুন'); return; }
    if (form.password !== form.confirmPassword) { setError('পাসওয়ার্ড মেলে না'); return; }
    if (!allRulesPassed) { setError('পাসওয়ার্ড নিয়ম মেনে চলুন'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name, phone: form.phone } },
      });
      if (error) throw error;
      if (data.user) {
        const referralCode = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('ref')
          : null;
        await processReferralOnSignup(data.user.id, referralCode);
      }
      toast('অ্যাকাউন্ট তৈরি সফল হয়েছে');
      router.push('/account');
    } catch (err: any) {
      setError(err.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-custom py-12">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold">নতুন অ্যাকাউন্ট তৈরি</h1>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">নাম *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-bangla" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">ইমেইল *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-bangla" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">মোবাইল নম্বর (ঐচ্ছিক)</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-bangla" placeholder="01XXXXXXXXX" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">পাসওয়ার্ড *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-bangla" required maxLength={20} />
            {form.password.length > 0 && (
              <div className="mt-2 space-y-1">
                {passwordChecks.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    {rule.passed
                      ? <Check className="h-3.5 w-3.5 text-green-600" />
                      : <X className="h-3.5 w-3.5 text-destructive" />}
                    <span className={rule.passed ? 'text-green-600' : 'text-muted-foreground'}>{rule.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">পাসওয়ার্ড নিশ্চিত করুন *</label>
            <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="input-bangla" required />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'অ্যাকাউন্ট তৈরি করুন'}
          </button>
          <div className="text-center text-sm text-muted-foreground">
            অ্যাকাউন্ট আছে? <Link href="/login" className="font-medium text-primary hover:underline">লগইন করুন</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
