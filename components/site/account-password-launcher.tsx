'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LockKeyhole, X } from 'lucide-react';
import ChangePasswordForm from '@/components/site/change-password-form';

export default function AccountPasswordLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname !== '/account') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90 sm:bottom-6 sm:right-6"
        aria-label="পাসওয়ার্ড পরিবর্তন করুন"
      >
        <LockKeyhole className="h-4 w-4" />
        পাসওয়ার্ড পরিবর্তন
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl border border-border">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 hover:bg-secondary transition"
              aria-label="বন্ধ করুন"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="pr-10">
              <ChangePasswordForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
