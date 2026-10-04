'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const updateHeaderAuth = (user: { email?: string | null; user_metadata?: Record<string, any> } | null) => {
  if (typeof document === 'undefined') return;

  const accountLink = document.querySelector<HTMLAnchorElement>('header a[href="/account"]');
  if (!accountLink) return;

  const label = user
    ? (user.user_metadata?.name || user.email?.split('@')[0] || 'আমার অ্যাকাউন্ট')
    : 'লগইন / রেজিস্টার';

  accountLink.title = user ? 'আমার অ্যাকাউন্ট' : 'লগইন / রেজিস্টার';
  const text = accountLink.querySelector('span');
  if (text) text.textContent = label;
  accountLink.setAttribute('aria-label', label);
};

export function AuthSessionBridge() {
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    // Supabase emits INITIAL_SESSION when the client finishes loading the
    // existing session, so avoid a separate getSession() request here.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      updateHeaderAuth(session?.user ?? null);

      // Handle both the initial restored session and fresh sign-ins.
      if (session && pathname === '/login' && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        window.location.replace('/account');
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname]);

  return null;
}
