'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Copy, Check, Users, Clock, CheckCircle, Gift, Link2, Wallet } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

interface ReferralStat {
  total: number;
  pending: number;
  qualified: number;
  rewarded: number;
  totalReward: number;
}

interface ReferralRecord {
  id: string;
  status: string;
  created_at: string;
  reward_status: string | null;
  reward_amount: number;
}

export default function ReferralSection({ userId }: { userId: string }) {
  const [referralCode, setReferralCode] = useState<string>('');
  const [stats, setStats] = useState<ReferralStat>({ total: 0, pending: 0, qualified: 0, rewarded: 0, totalReward: 0 });
  const [history, setHistory] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, [userId]);

  const loadReferralData = async () => {
    try {
      const { data: codeData } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', userId)
        .maybeSingle();

      if (codeData) setReferralCode(codeData.code);

      const { data: referrals } = await supabase
        .from('referrals')
        .select('id, status, created_at')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      const referralList = referrals || [];
      const total = referralList.length;
      const pending = referralList.filter(r => r.status === 'pending').length;
      const qualified = referralList.filter(r => r.status === 'qualified').length;
      const rewarded = referralList.filter(r => r.status === 'rewarded').length;

      if (total > 0) {
        const referralIds = referralList.map(r => r.id);
        const { data: rewards } = await supabase
          .from('referral_rewards')
          .select('referral_id, status, amount')
          .in('referral_id', referralIds);

        const rewardMap = new Map<string, { status: string; amount: number }>();
        (rewards || []).forEach(rw => rewardMap.set(rw.referral_id, {
          status: rw.status,
          amount: Number(rw.amount || 0),
        }));

        const totalReward = (rewards || [])
          .filter(rw => rw.status === 'issued' || rw.status === 'redeemed')
          .reduce((sum, rw) => sum + Number(rw.amount || 0), 0);

        const historyWithRewards: ReferralRecord[] = referralList.map(r => ({
          id: r.id,
          status: r.status,
          created_at: r.created_at,
          reward_status: rewardMap.get(r.id)?.status || null,
          reward_amount: rewardMap.get(r.id)?.amount || 0,
        }));

        setHistory(historyWithRewards);
        setStats({ total, pending, qualified, rewarded, totalReward });
      } else {
        setHistory([]);
        setStats({ total, pending, qualified, rewarded, totalReward: 0 });
      }
    } catch {
      // Silently ignore — referral section must never break the dashboard
    } finally {
      setLoading(false);
    }
  };

  // Referral links intentionally open the registration form directly.
  // The global ReferralTracker captures ?ref= on the register page before signup.
  const referralLink = typeof window !== 'undefined' && referralCode
    ? `${window.location.origin}/register?ref=${encodeURIComponent(referralCode)}`
    : '';

  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast('রেফারেল লিংক কপি হয়েছে');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('কপি করতে সমস্যা হয়েছে', 'error');
    }
  };

  const statusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'অপেক্ষমাণ',
      qualified: 'যোগ্য',
      rewarded: 'পুরস্কার প্রদান করা হয়েছে',
      cancelled: 'বাতিল',
    };
    return labels[status] || status;
  };

  const rewardStatusLabel = (status: string | null): string => {
    if (!status) return '-';
    const labels: Record<string, string> = {
      pending: 'অপেক্ষমাণ',
      issued: 'প্রদান করা হয়েছে',
      redeemed: 'ব্যবহৃত',
      expired: 'মেয়াদোত্তীর্ণ',
    };
    return labels[status] || status;
  };

  const statusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: 'text-yellow-600',
      qualified: 'text-blue-600',
      rewarded: 'text-green-600',
      cancelled: 'text-destructive',
    };
    return colors[status] || 'text-muted-foreground';
  };

  const formatReward = (amount: number) => `৳${amount.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-secondary" />
        <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <Users className="h-5 w-5 text-primary" /> রেফারেল প্রোগ্রাম
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">আমার রেফারেল কোড</label>
            <div className="flex items-center gap-2">
              <code className="rounded-lg bg-secondary px-4 py-2.5 font-mono text-lg font-bold tracking-wider text-primary">
                {referralCode || '-'}
              </code>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">আমার রেফারেল লিংক</label>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm text-muted-foreground">{referralLink || '-'}</span>
              </div>
              <button onClick={handleCopyLink} disabled={!referralLink} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'কপি হয়েছে' : 'কপি করুন'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" /> রেফারেল রিওয়ার্ড
            </p>
            <p className="mt-1 text-3xl font-black text-primary">{formatReward(stats.totalReward)}</p>
            <p className="mt-1 text-xs text-muted-foreground">এখন পর্যন্ত প্রদান করা মোট রিওয়ার্ড</p>
          </div>
          <Gift className="h-9 w-9 text-primary" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <Users className="h-5 w-5 text-primary" /> রেফারেল পরিসংখ্যান
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl bg-secondary/20 p-4 text-center"><p className="text-sm text-muted-foreground">মোট রেফারেল</p><p className="mt-1 text-2xl font-bold text-primary">{stats.total}</p></div>
          <div className="rounded-xl bg-secondary/20 p-4 text-center"><p className="flex items-center justify-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" /> অপেক্ষমাণ</p><p className="mt-1 text-2xl font-bold text-yellow-600">{stats.pending}</p></div>
          <div className="rounded-xl bg-secondary/20 p-4 text-center"><p className="flex items-center justify-center gap-1 text-sm text-muted-foreground"><CheckCircle className="h-3.5 w-3.5" /> যোগ্য</p><p className="mt-1 text-2xl font-bold text-blue-600">{stats.qualified}</p></div>
          <div className="rounded-xl bg-secondary/20 p-4 text-center"><p className="flex items-center justify-center gap-1 text-sm text-muted-foreground"><Gift className="h-3.5 w-3.5" /> পুরস্কারপ্রাপ্ত</p><p className="mt-1 text-2xl font-bold text-green-600">{stats.rewarded}</p></div>
          <div className="rounded-xl bg-primary/5 p-4 text-center"><p className="flex items-center justify-center gap-1 text-sm text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> মোট রিওয়ার্ড</p><p className="mt-1 text-xl font-bold text-primary">{formatReward(stats.totalReward)}</p></div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Users className="h-5 w-5 text-primary" /> রেফারেল ইতিহাস</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">এখনও কোন রেফারেল নেই</p>
        ) : (
          <div className="space-y-2">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-secondary/20 p-3 text-sm gap-3">
                <div>
                  <p className="font-medium">{new Date(r.created_at).toLocaleDateString('bn-BD')}</p>
                  <p className="text-xs text-muted-foreground">পুরস্কার: {rewardStatusLabel(r.reward_status)}</p>
                </div>
                <div className="text-right shrink-0">
                  {r.reward_amount > 0 && <p className="font-black text-primary">{formatReward(r.reward_amount)}</p>}
                  <span className={`text-xs font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
