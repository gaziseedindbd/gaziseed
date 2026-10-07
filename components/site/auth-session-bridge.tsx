'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useLang } from './language-provider';

const updateHeaderAuth = (user: { email?: string | null; user_metadata?: Record<string, any> } | null, accountLabel: string, loginLabel: string) => {
  if (typeof document === 'undefined') return;

  const label = user
    ? (user.user_metadata?.name || user.email?.split('@')[0] || accountLabel)
    : loginLabel;

  document.querySelectorAll<HTMLAnchorElement>('header a[href="/account"]').forEach((accountLink) => {
    accountLink.title = user ? accountLabel : loginLabel;
    const text = accountLink.querySelector('span');
    if (text) text.textContent = label;
    accountLink.setAttribute('aria-label', label);
  });
};

export function AuthSessionBridge() {
  const pathname = usePathname();
  const { t } = useLang();

  useEffect(() => {
    let mounted = true;

    // Supabase emits INITIAL_SESSION when the client finishes loading the
    // existing session, so avoid a separate getSession() request here.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      updateHeaderAuth(session?.user ?? null, t('আমার অ্যাকাউন্ট', 'My account', 'मेरा खाता'), t('লগইন / রেজিস্টার', 'Login / Register', 'लॉगिन / रजिस्टर'));

      // Handle both the initial restored session and fresh sign-ins.
      if (session && pathname === '/login' && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        window.location.replace('/account');
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, t]);

  return null;
}
