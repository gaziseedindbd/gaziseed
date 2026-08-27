'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle2, LockKeyhole } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast('সব পাসওয়ার্ডের ঘর পূরণ করুন', 'error');
      return;
    }
    if (newPassword.length < 8) {
      toast('নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('নতুন পাসওয়ার্ড দুটো মিলছে না', 'error');
      return;
    }
    if (currentPassword === newPassword) {
      toast('নতুন পাসওয়ার্ডটি বর্তমান পাসওয়ার্ডের থেকে আলাদা দিন', 'error');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast('আপনার সেশন শেষ হয়ে গেছে। আবার লগইন করুন', 'error');
        return;
      }

      // Current password is verified without using any admin/service-role credential.
      if (user.email) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (verifyError) {
          toast('বর্তমান পাসওয়ার্ড সঠিক নয়', 'error');
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast(error.message || 'পাসওয়ার্ড পরিবর্তন করা যায়নি', 'error');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে');
    } catch (error) {
      console.error('Password change error:', error);
      toast('পাসওয়ার্ড পরিবর্তন করা যায়নি। আবার চেষ্টা করুন', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-secondary/20 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LockKeyhole className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-black text-sm sm:text-base">পাসওয়ার্ড পরিবর্তন</h3>
          <p className="text-[11px] text-muted-foreground">আপনার অ্যাকাউন্টের নিরাপত্তার জন্য নতুন পাসওয়ার্ড সেট করুন</p>
        </div>
      </div>

      <form onSubmit={handleChangePassword} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">বর্তমান পাসওয়ার্ড</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input-bangla w-full"
            autoComplete="current-password"
            placeholder="বর্তমান পাসওয়ার্ড লিখুন"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">নতুন পাসওয়ার্ড</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-bangla w-full"
              autoComplete="new-password"
              minLength={8}
              placeholder="কমপক্ষে ৮ অক্ষর"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">নতুন পাসওয়ার্ড আবার লিখুন</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-bangla w-full"
              autoComplete="new-password"
              minLength={8}
              placeholder="পাসওয়ার্ড নিশ্চিত করুন"
            />
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-background p-3 text-[11px] text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের দিন এবং আগের পাসওয়ার্ডের থেকে আলাদা রাখুন।</span>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
        </button>
      </form>
    </div>
  );
}
