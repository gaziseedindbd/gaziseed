'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export const FEATURE_KEYS = [
  'enable_variants',
  'enable_bundles',
  'enable_combos',
  'enable_free_gifts',
  'enable_bulk_pricing',
  'enable_seasonal_finder',
  'enable_recently_viewed',
  'enable_wishlist',
  'enable_coupons',
  'enable_order_again',
  'enable_support_tickets',
  'enable_low_stock_msg',
  'enable_guides',
  'enable_photo_reviews',
  'enable_reward_points',
  'enable_referral',
  'enable_abandoned_checkout',
  'enable_online_payment',
  'enable_courier',
  'enable_sms',
  'enable_whatsapp_api',
  'enable_adsense',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureFlags = Record<FeatureKey, boolean>;

type FeatureRow = Partial<Record<FeatureKey, boolean>>;

const DEFAULT_FEATURE_FLAGS = FEATURE_KEYS.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {} as FeatureFlags);

type FeatureContextValue = {
  flags: FeatureFlags;
  ready: boolean;
  enabled: (feature: FeatureKey) => boolean;
  refresh: () => Promise<void>;
};

const FeatureContext = createContext<FeatureContextValue>({
  flags: DEFAULT_FEATURE_FLAGS,
  ready: false,
  enabled: () => false,
  refresh: async () => {},
});

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('site_settings')
      .select(FEATURE_KEYS.join(','))
      .eq('id', 1)
      .maybeSingle();

    const next = { ...DEFAULT_FEATURE_FLAGS };

    if (!error && data) {
      const row = data as unknown as FeatureRow;
      for (const key of FEATURE_KEYS) {
        next[key] = row[key] === true;
      }
    }

    // Combo availability must work for anonymous visitors too. Resolve only
    // this public feature through a narrow RPC instead of exposing settings.
    const { data: comboEnabled, error: comboError } = await supabase.rpc('get_combo_feature_enabled');
    if (!comboError && typeof comboEnabled === 'boolean') {
      next.enable_combos = comboEnabled;
    }

    setFlags(next);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<FeatureContextValue>(() => ({
    flags,
    ready,
    enabled: (feature) => flags[feature],
    refresh,
  }), [flags, ready, refresh]);

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>;
}

export function useFeatureFlags() {
  return useContext(FeatureContext);
}

export function FeatureGate({ feature, children, fallback = null }: {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { ready, enabled } = useFeatureFlags();
  if (!ready) return null;
  return enabled(feature) ? <>{children}</> : <>{fallback}</>;
}
