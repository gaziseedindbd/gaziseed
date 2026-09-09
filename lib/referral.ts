'use client';

import { supabase } from '@/lib/supabase/client';

const REFERRAL_COOKIE_NAME = 'sb_referral_code';
const REFERRAL_COOKIE_MAX_AGE_DAYS = 30;

export function getStoredReferralCode(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === REFERRAL_COOKIE_NAME) return decodeURIComponent(valueParts.join('='));
  }
  return null;
}

export function clearStoredReferralCode(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${REFERRAL_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

function setReferralCookie(code: string): void {
  const maxAge = REFERRAL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export async function detectAndStoreReferralCode(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refCode = new URLSearchParams(window.location.search).get('ref');
  if (!refCode) return null;
  const stored = getStoredReferralCode();
  if (stored === refCode) return stored;
  const { data, error } = await supabase.from('referral_codes').select('code').eq('code', refCode).eq('is_active', true).maybeSingle();
  if (error || !data) return null;
  setReferralCookie(refCode);
  return refCode;
}

export async function processReferralOnSignup(newUserId: string, referralCode?: string | null): Promise<void> {
  const refCode = referralCode || getStoredReferralCode();
  if (!refCode) return;
  try {
    await supabase.rpc('create_referral_on_signup', {
      p_referral_code: refCode,
      p_new_user_id: newUserId,
    });
    clearStoredReferralCode();
  } catch {
    // Referral tracking must never block signup.
  }
}
