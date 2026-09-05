'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Branch = 'BD' | 'IN';
const BRANCH_KEY = 'gazi_admin_branch';

export function OrderBranchHeader() {
  const [branch, setBranch] = useState<Branch>('BD');
  const [count, setCount] = useState(0);

  const load = async () => {
    const saved = localStorage.getItem(BRANCH_KEY);
    const next: Branch = saved === 'IN' ? 'IN' : 'BD';
    setBranch(next);
    const { count: total } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true });
    setCount(total || 0);
  };

  useEffect(() => {
    load();
    const onBranchChange = () => load();
    window.addEventListener('gazi-branch-change', onBranchChange);
    return () => window.removeEventListener('gazi-branch-change', onBranchChange);
  }, []);

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current order branch</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-lg">{branch === 'IN' ? '🇮🇳' : '🇧🇩'}</span>
          <span className="font-bold">{branch === 'IN' ? 'India Branch' : 'Bangladesh Branch'}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{count} orders</span>
        </div>
      </div>
      <div className="text-xs font-medium text-muted-foreground">
        {branch === 'IN' ? 'Currency: ₹' : 'Currency: ৳'}
      </div>
    </div>
  );
}
