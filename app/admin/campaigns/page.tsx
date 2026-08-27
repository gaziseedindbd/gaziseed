'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { BarChart3, Eye } from 'lucide-react';

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, grand_total, status, utm_source, utm_medium, utm_campaign, created_at, order_items(product_name, quantity, bundle_name)')
      .not('utm_source', 'eq', '')
      .order('created_at', { ascending: false });
    
    // Group by utm_campaign
    const map = new Map<string, any>();
    (data || []).forEach((o: any) => {
      const key = o.utm_campaign || '(no campaign)';
      if (!map.has(key)) {
        map.set(key, { campaign: key, source: o.utm_source, orders: [], revenue: 0, count: 0, units: 0 });
      }
      const c = map.get(key);
      c.orders.push(o);
      c.count++;
      if (o.status !== 'cancelled') c.revenue += Number(o.grand_total);
      c.units += (o.order_items || []).reduce((s: number, i: any) => s + i.quantity, 0);
    });

    setCampaigns(Array.from(map.values()));
    setLoading(false);
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">ক্যাম্পেইন ট্র্যাকিং</h1>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
          <p className="text-muted-foreground">এখনো কোন ক্যাম্পেইন ডেটা নেই। Ads Landing Page থেকে UTM প্যারামিটার সহ অর্ডার এলে এখানে দেখা যাবে।</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <div key={c.campaign} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{c.campaign}</h3>
                  <p className="text-sm text-muted-foreground">Source: {c.source}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-lg font-bold text-primary">{formatPrice(c.revenue)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Orders</p><p className="text-lg font-bold">{c.count}</p></div>
                <div className="rounded-lg bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Units</p><p className="text-lg font-bold">{c.units}</p></div>
                <div className="rounded-lg bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Avg Order</p><p className="text-lg font-bold">{c.count > 0 ? formatPrice(c.revenue / c.count) : '—'}</p></div>
              </div>
              <div className="mt-3 space-y-1">
                {c.orders.slice(0, 5).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg bg-secondary/10 p-2 text-sm">
                    <div><span className="font-medium">{o.order_number}</span> — {o.customer_name} ({o.customer_phone})</div>
                    <div className="flex items-center gap-2"><span className="text-muted-foreground">{o.status}</span><span className="font-bold">{formatPrice(o.grand_total)}</span></div>
                  </div>
                ))}
                {c.orders.length > 5 && <p className="text-center text-xs text-muted-foreground">+{c.orders.length - 5} আরো অর্ডার</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
