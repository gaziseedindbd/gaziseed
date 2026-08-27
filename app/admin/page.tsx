'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { ShoppingCart, Package, Users, TrendingUp, AlertTriangle, Clock, Sparkles } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ todayOrders: 0, todayRevenue: 0, pendingOrders: 0, confirmedOrders: 0, totalProducts: 0, totalCustomers: 0, lowStock: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const [todayOrdersRes, pendingRes, confirmedRes, productsRes, lowStockRes, recentRes] = await Promise.all([
      supabase.from('orders').select('grand_total, status').gte('created_at', todayStr),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('name_bn, stock, low_stock_threshold').lt('stock', 10),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    const todayRevenue = (todayOrdersRes.data || []).filter((o: any) => o.status !== 'cancelled').reduce((sum: number, o: any) => sum + Number(o.grand_total), 0);
    setStats({ todayOrders: todayOrdersRes.data?.length || 0, todayRevenue, pendingOrders: pendingRes.count || 0, confirmedOrders: confirmedRes.count || 0, totalProducts: productsRes.count || 0, totalCustomers: 0, lowStock: (lowStockRes.data || []).filter((p: any) => p.stock <= p.low_stock_threshold).length });
    setRecentOrders(recentRes.data || []); setLoading(false);
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;
  const statCards = [
    { label: 'আজকের অর্ডার', value: stats.todayOrders, icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' },
    { label: 'আজকের আয়', value: formatPrice(stats.todayRevenue), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'পেন্ডিং অর্ডার', value: stats.pendingOrders, icon: Clock, color: 'text-orange-600 bg-orange-50' },
    { label: 'কনফার্মড অর্ডার', value: stats.confirmedOrders, icon: ShoppingCart, color: 'text-primary bg-primary/10' },
    { label: 'মোট প্রোডাক্ট', value: stats.totalProducts, icon: Package, color: 'text-purple-600 bg-purple-50' },
    { label: 'লো স্টক', value: stats.lowStock, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
  ];
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4"><h1 className="text-2xl font-bold">ড্যাশবোর্ড</h1><Link href="/admin/ai" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Sparkles className="h-4 w-4" /> AI Center</Link></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{statCards.map((card, idx) => (<div key={idx} className="rounded-2xl border border-border bg-card p-4"><div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}><card.icon className="h-5 w-5" /></div><p className="text-sm text-muted-foreground">{card.label}</p><p className="mt-1 text-xl font-bold">{card.value}</p></div>))}</div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6"><h2 className="mb-4 text-lg font-bold">সাম্প্রতিক অর্ডার</h2>{recentOrders.length === 0 ? <p className="text-sm text-muted-foreground">কোন অর্ডার নেই</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2 pr-4">অর্ডার নং</th><th className="pb-2 pr-4">কাস্টমার</th><th className="pb-2 pr-4">ফোন</th><th className="pb-2 pr-4">সোর্স</th><th className="pb-2 pr-4">মোট</th><th className="pb-2 pr-4">স্ট্যাটাস</th><th className="pb-2">তারিখ</th></tr></thead><tbody>{recentOrders.map((o) => <tr key={o.id} className="border-b border-border/50"><td className="py-2 pr-4 font-medium">{o.order_number}</td><td className="py-2 pr-4">{o.customer_name}</td><td className="py-2 pr-4">{o.customer_phone}</td><td className="py-2 pr-4">{o.order_source}</td><td className="py-2 pr-4 font-bold">{formatPrice(o.grand_total)}</td><td className="py-2 pr-4"><span className={`rounded-full px-2 py-0.5 text-xs ${o.status === 'delivered' ? 'bg-green-100 text-green-700' : o.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{o.status}</span></td><td className="py-2 text-muted-foreground">{new Date(o.created_at).toLocaleDateString('bn-BD')}</td></tr>)}</tbody></table></div>}</div>
    </div>
  );
}
