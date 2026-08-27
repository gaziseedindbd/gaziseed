'use client';

import { supabase } from '@/lib/supabase/client';

const REFERRAL_COOKIE_NAME = 'sb_referral_code';
const REFERRAL_COOKIE_MAX_AGE_DAYS = 30;

/**
 * Detects a `ref` query parameter from the current URL, validates it against
 * the database, and stores it in a cookie if valid. Silently ignores invalid
 * or missing codes. Safe to call on any page load.
 */
export async function detectAndStoreReferralCode(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const refCode = params.get('ref');
  if (!refCode) return null;

  const stored = getStoredReferralCode();
  if (stored === refCode) return stored;

  const { data, error } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('code', refCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  setReferralCookie(refCode);
  return refCode;
}

/**
 * Reads the stored referral code from the cookie. Returns null if not set
 * or the cookie has expired.
 */
export function getStoredReferralCode(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === REFERRAL_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join('='));
    }
  }
  return null;
}

/**
 * Clears the stored referral code. Called after the referral relationship
 * has been created or when it is no longer needed.
 */
export function clearStoredReferralCode(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${REFERRAL_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

function setReferralCookie(code: string): void {
  const maxAge = REFERRAL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Creates a referral relationship between the referrer (identified by the
 * referral code) and the newly signed-up user.
 *
 * The optional referralCode argument is used when signup was reached directly
 * from `/register?ref=...`. This avoids an async cookie-capture race on the
 * registration page while preserving the existing cookie-based flow for
 * referrals that arrive on other pages first.
 */
export async function processReferralOnSignup(
  newUserId: string,
  referralCode?: string | null,
): Promise<void> {
  const refCode = referralCode || getStoredReferralCode();
  if (!refCode) return;

  try {
    // The Admin switch is authoritative: when OFF, no referral relationship
    // may be created even if a previously shared referral link is clicked.
    const { data: settings, error: settingsError } = await supabase
      .from('referral_settings')
      .select('enabled')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError || settings?.enabled !== true) {
      clearStoredReferralCode();
      return;
    }

    const { data: referrerCode, error: refError } = await supabase
      .from('referral_codes')
      .select('user_id, id')
      .eq('code', refCode)
      .eq('is_active', true)
      .maybeSingle();

    if (refError || !referrerCode) return;

    if (referrerCode.user_id === newUserId) return;

    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', newUserId)
      .maybeSingle();

    if (existing) return;

    const { error: insertError } = await supabase.from('referrals').insert({
      referrer_id: referrerCode.user_id,
      referred_id: newUserId,
      referral_code_id: referrerCode.id,
      status: 'pending',
    });

    if (!insertError) clearStoredReferralCode();
  } catch {
    // Silently ignore — referral tracking must never break signup
  }
}
