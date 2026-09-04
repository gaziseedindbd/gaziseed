import { createClient } from '@/lib/supabase/server';

export type ReferralSettings = {
  active: boolean;
  earningPercent: number;
  minPurchase: number;
  walletUseLimitPercent: number;
};

/**
 * ZIP-compatible referral behavior mapped onto the current production schema.
 * This intentionally does not reference the ZIP's legacy referral_codes/referrals
 * client model, keeping the integration boundary explicit until the missing
 * referral relationship table/function is reconciled in Supabase.
 */
export async function getReferralSettings(country: 'BD' | 'IN'): Promise<ReferralSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('referral_settings')
    .select('active, earning_percent, min_purchase, wallet_use_limit_percent')
    .eq('country', country)
    .maybeSingle();

  if (error || !data) return null;

  return {
    active: Boolean(data.active),
    earningPercent: Number(data.earning_percent ?? 0),
    minPurchase: Number(data.min_purchase ?? 0),
    walletUseLimitPercent: Number(data.wallet_use_limit_percent ?? 100),
  };
}

export function calculateReferralReward(orderTotal: number, settings: ReferralSettings): number {
  if (!settings.active || orderTotal < settings.minPurchase) return 0;
  const reward = orderTotal * (settings.earningPercent / 100);
  return Math.max(0, Math.round(reward * 100) / 100);
}
