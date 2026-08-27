'use client';

import { FeatureGate } from '@/components/site/feature-provider';

export default function ComboLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      feature="enable_combos"
      fallback={
        <div className="container-custom py-24 text-center">
          <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8">
            <h1 className="text-lg font-bold text-foreground">এই ফিচারটি বর্তমানে বন্ধ আছে</h1>
            <p className="mt-2 text-sm text-muted-foreground">কম্বো অফার বর্তমানে সক্রিয় নয়।</p>
          </div>
        </div>
      }
    >
      {children}
    </FeatureGate>
  );
}
