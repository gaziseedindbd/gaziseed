'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Printer, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminReportsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'today' | '7days' | '30days' | 'custom'>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => { loadOrders(); }, [range]);

  const loadOrders = async () => {
    let start = new Date();
    if (range === 'today') start.setHours(0, 0, 0, 0);
    else if (range === '7days') start.setDate(start.getDate() - 7);
    else if (range === '30days') start.setDate(start.getDate() - 30);
    else if (range === 'custom' && customStart) start = new Date(customStart);
    else if (range === 'custom') { setLoading(false); setOrders([]); return; }

    let query = supabase.from('orders').select('*, order_items(*)').gte('created_at', start.toISOString()).order('created_at', { ascending: false });
    if (range === 'custom' && customEnd) query = query.lte('created_at', new Date(customEnd + 'T23:59:59').toISOString());
    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  };

  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const revenue = validOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);
  const totalOrders = validOrders.length;
  const productsSold = validOrders.reduce((s, o) => s + (o.order_items || []).reduce((ss: number, oi: any) => ss + oi.quantity, 0), 0);
  const discountGiven = validOrders.reduce((s, o) => s + Number(o.discount || 0), 0);
  const freeGiftCost = validOrders.reduce((s, o) => s + (o.order_items || []).filter((oi: any) => oi.is_free_gift).reduce((ss: number, oi: any) => ss + Number(oi.unit_price || 0) * oi.quantity, 0), 0);
  const estimatedCost = validOrders.reduce((s, o) => s + (o.order_items || []).reduce((ss: number, oi: any) => ss + Number(oi.cost_price || 0) * oi.quantity, 0), 0);
  const estimatedProfit = revenue - estimatedCost - discountGiven - freeGiftCost;
  const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;

  // Best selling
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  validOrders.forEach((o) => {
    (o.order_items || []).forEach((oi: any) => {
      if (oi.is_free_gift) return;
      const key = oi.product_id || oi.product_name;
      if (!productSales[key]) productSales[key] = { name: oi.product_name, qty: 0, revenue: 0 };
      productSales[key].qty += oi.quantity;
      productSales[key].revenue += Number(oi.total_price || 0);
    });
  });
  const bestSelling = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // Top categories
  const catSales: Record<string, number> = {};
  validOrders.forEach((o) => {
    (o.order_items || []).forEach((oi: any) => {
      if (oi.is_free_gift) return;
      const key = oi.product_name || 'Other';
      catSales[key] = (catSales[key] || 0) + Number(oi.total_price || 0);
    });
  });
  const topCategories = Object.entries(catSales).sort(([, a], [, b]) => b - a).slice(0, 5);

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">রিপোর্ট</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'today', label: 'আজ' },
          { key: '7days', label: '৭ দিন' },
          { key: '30days', label: '৩০ দিন' },
          { key: 'custom', label: 'কাস্টম' },
        ].map((r) => (
          <button key={r.key} onClick={() => setRange(r.key as any)} className={`rounded-lg px-4 py-2 text-sm font-medium ${range === r.key ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:bg-secondary'}`}>{r.label}</button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="mb-4 flex gap-2">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-bangla" />
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-bangla" />
          <button onClick={loadOrders} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">প্রয়োগ করুন</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">মোট রাজস্ব</p>
          <p className="text-2xl font-bold text-primary">৳{revenue.toLocaleString('bn-BD')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">অর্ডার সংখ্যা</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">বিক্রিত পণ্য</p>
          <p className="text-2xl font-bold">{productsSold} টি</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">গড় অর্ডার মূল্য</p>
          <p className="text-2xl font-bold">৳{avgOrderValue.toFixed(0)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">ছাড় প্রদান</p>
          <p className="text-2xl font-bold text-orange-600">৳{discountGiven.toLocaleString('bn-BD')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">ফ্রি গিফট খরচ</p>
          <p className="text-2xl font-bold text-purple-600">৳{freeGiftCost.toLocaleString('bn-BD')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">আনুমানিক পণ্য খরচ</p>
          <p className="text-2xl font-bold text-muted-foreground">৳{estimatedCost.toLocaleString('bn-BD')}</p>
        </div>
        <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4">
          <p className="text-sm text-green-700">আনুমানিক সম্ভাব্য লাভ *</p>
          <p className="text-2xl font-bold text-green-700">৳{estimatedProfit.toLocaleString('bn-BD')}</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">* লাভ অনুমানিক — প্রকৃত খরচ, রিটার্ন, ফি বাদ দিয়ে গণনা করা হয়েছে।</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 font-bold">সেরা বিক্রিত বীজ</h3>
          <div className="space-y-2">
            {bestSelling.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span>{idx + 1}. {p.name}</span>
                <span className="text-muted-foreground">{p.qty} টি — ৳{p.revenue.toLocaleString('bn-BD')}</span>
              </div>
            ))}
            {bestSelling.length === 0 && <p className="text-sm text-muted-foreground">কোন তথ্য নেই</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
