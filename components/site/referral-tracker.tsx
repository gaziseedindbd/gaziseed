'use client';

import { useEffect } from 'react';
import { detectAndStoreReferralCode } from '@/lib/referral';

export function ReferralTracker() {
  useEffect(() => {
    detectAndStoreReferralCode();
  }, []);

  return null;
}
