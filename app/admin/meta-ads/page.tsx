'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, BarChart3, MousePointerClick, Eye, ShoppingBag, Wallet, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type Campaign = {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
  ctr: number;
  cpc: number;
  purchase_roas: number;
  currency: string | null;
};

type Report = {
  ok: boolean;
  countryCode: 'IN' | 'BD';
  days: number;
  configured: boolean;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  campaignCount: number;
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    purchase_value: number;
    ctr: number;
    cpc: number;
    purchase_roas: number;
  };
  campaigns: Campaign[];
  currency: string;
};

const ranges = [
  { days: 7, label: '৭ দিন' },
  { days: 30, label: '৩০ দিন' },
  { days: 90, label: '৯০ দিন' },
];

export default function MetaAdsReportPage() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Admin login যাচাই করা যায়নি। আবার লগইন করুন।');
      const response = await fetch('/api/admin/meta-ads-insights?days=' + days, {
        headers: { Authorization: 'Bearer ' + session.access_token },
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'Meta Ads রিপোর্ট লোড হয়নি।');
      setReport(payload as Report);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Meta Ads রিপোর্ট লোড হয়নি।');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    void loadReport();
    const refreshBranch = () => { void loadReport(); };
    window.addEventListener('gazi-branch-change', refreshBranch);
    return () => window.removeEventListener('gazi-branch-change', refreshBranch);
  }, [loadReport]);

  const number = (value: number, maximumFractionDigits = 0) =>
    Number(value || 0).toLocaleString(report?.countryCode === 'IN' ? 'en-IN' : 'bn-BD', { maximumFractionDigits });

  const money = (value: number) => new Intl.NumberFormat(
    report?.countryCode === 'IN' ? 'en-IN' : 'bn-BD',
    { style: 'currency', currency: report?.currency || (report?.countryCode === 'IN' ? 'INR' : 'BDT'), maximumFractionDigits: 2 },
  ).format(Number(value || 0));

  if (loading) return <div className="space-y-4"><div className="h-10 w-56 animate-pulse rounded-xl bg-secondary" /><div className="h-44 animate-pulse rounded-2xl bg-secondary" /><div className="h-64 animate-pulse rounded-2xl bg-secondary" /></div>;

  const summary = report?.summary;
  const branchName = report?.countryCode === 'IN' ? '🇮🇳 India' : '🇧🇩 Bangladesh';
  const cards = [
    { label: 'Ad spend', value: money(summary?.spend || 0), icon: Wallet, hint: 'Meta Ads থেকে' },
    { label: 'Impressions', value: number(summary?.impressions || 0), icon: Eye, hint: 'বিজ্ঞাপন কতবার দেখানো হয়েছে' },
    { label: 'Clicks', value: number(summary?.clicks || 0), icon: MousePointerClick, hint: 'Meta-র রিপোর্ট করা clicks' },
    { label: 'Purchases', value: number(summary?.purchases || 0), icon: ShoppingBag, hint: 'Meta-attributed purchases' },
    { label: 'Purchase value', value: money(summary?.purchase_value || 0), icon: BarChart3, hint: 'Meta-র attributed value' },
    { label: 'Purchase ROAS', value: number(summary?.purchase_roas || 0, 2) + '×', icon: TrendingUp, hint: 'Purchase value ÷ ad spend' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Meta Ads রিপোর্ট</h1>
          <p className="mt-1 text-sm text-muted-foreground">{branchName} · গত {days} দিনের campaign performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ranges.map((range) => (
            <button key={range.days} type="button" onClick={() => setDays(range.days)} className={days === range.days ? 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground' : 'rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary'}>
              {range.label}
            </button>
          ))}
          <button type="button" onClick={() => void loadReport(true)} disabled={refreshing} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60">
            <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{error}</div>}

      {report && !report.configured && (
        <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Meta Ads account mapping অসম্পূর্ণ</p>
          <p className="mt-1">এই branch-এর ad account ID ও server-side access configuration না থাকায় campaign metrics sync করা যাচ্ছে না। Admin থেকে কোনো ad পরিবর্তন করা হয় না।</p>
        </div>
      )}

      {report && report.configured && !report.syncEnabled && (
        <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Daily sync এখনো চালু হয়নি</p>
          <p className="mt-1">সর্বশেষ synced তথ্য থাকলে নিচে দেখা যাবে। নতুন তথ্য আসার জন্য নিরাপদ server-side schedule enable করতে হবে।</p>
        </div>
      )}

      {report?.lastSyncedAt && (
        <p className="text-xs text-muted-foreground">শেষ sync: {new Date(report.lastSyncedAt).toLocaleString(report.countryCode === 'IN' ? 'en-IN' : 'bn-BD')}</p>
      )}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{card.label}</p><Icon className="h-4 w-4 text-primary" /></div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                </div>
              );
            })}
          </div>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
              <div><h2 className="font-bold">Campaign breakdown</h2><p className="text-xs text-muted-foreground">{report.campaignCount}টি campaign · {branchName}</p></div>
            </div>
            {report.campaigns.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
                    <tr><th className="px-4 py-3">Campaign</th><th className="px-4 py-3 text-right">Spend</th><th className="px-4 py-3 text-right">Impressions</th><th className="px-4 py-3 text-right">Clicks</th><th className="px-4 py-3 text-right">Purchases</th><th className="px-4 py-3 text-right">Purchase value</th><th className="px-4 py-3 text-right">ROAS</th></tr>
                  </thead>
                  <tbody>
                    {report.campaigns.map((campaign) => (
                      <tr key={campaign.campaign_id} className="border-t border-border/70">
                        <td className="px-4 py-3 font-medium">{campaign.campaign_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(campaign.spend)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{number(campaign.impressions)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{number(campaign.clicks)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{number(campaign.purchases, 2)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(campaign.purchase_value)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{number(campaign.purchase_roas, 2)}×</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">এই সময়ের জন্য synced campaign report নেই</p>
                <p className="mt-1 text-sm text-muted-foreground">Meta Ads Manager-এ campaign data থাকলেও, website-এ দেখাতে account mapping এবং daily sync প্রয়োজন।</p>
              </div>
            )}
          </section>
          <p className="text-xs text-muted-foreground">ROAS = Meta-attributed purchase value ÷ Meta ad spend। এটি লাভের হিসাব নয়; shipping, product cost ও অন্যান্য খরচ এতে বাদ নেই। Meta-র attribution window অনুযায়ী ফল Ads Manager-এর সঙ্গে ভিন্ন হতে পারে।</p>
        </>
      )}

      {!report && !error && <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">কোনো রিপোর্ট পাওয়া যায়নি।</div>}
    </div>
  );
}
