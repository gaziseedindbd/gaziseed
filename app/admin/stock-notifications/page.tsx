'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Bell, Check, Trash2 } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminStockNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'waiting' | 'notified' | 'cancelled'>('waiting');

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    const { data } = await supabase.from('stock_notifications').select('*, products(name_bn, name_en, stock)').order('created_at', { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  };

  const markNotified = async (id: string) => {
    await supabase.from('stock_notifications').update({ status: 'notified', notified_at: new Date().toISOString() }).eq('id', id);
    toast('নোটিফাইড হিসেবে চিহ্নিত');
    loadNotifications();
  };

  const cancel = async (id: string) => {
    await supabase.from('stock_notifications').update({ status: 'cancelled' }).eq('id', id);
    toast('বাতিল করা হয়েছে');
    loadNotifications();
  };

  const remove = async (id: string) => {
    if (!confirm('মুছতে চান?')) return;
    await supabase.from('stock_notifications').delete().eq('id', id);
    loadNotifications();
  };

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.status === filter);

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold"><Bell className="h-6 w-6" /> স্টক নোটিফিকেশন</h1>

      <div className="mb-4 flex gap-2">
        {[
          { key: 'waiting', label: 'অপেক্ষমাণ' },
          { key: 'notified', label: 'জানানো হয়েছে' },
          { key: 'cancelled', label: 'বাতিল' },
          { key: 'all', label: 'সব' },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key as any)} className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f.key ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:bg-secondary'}`}>{f.label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((n) => (
          <div key={n.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{n.products?.name_bn || n.products?.name_en || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">ফোন: {n.phone} {n.email && `· ${n.email}`}</p>
                <p className="text-xs text-muted-foreground">অনুরোধ: {new Date(n.created_at).toLocaleDateString('bn-BD')}</p>
                {n.products && <p className="mt-1 text-xs">বর্তমান স্টক: {n.products.stock}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${n.status === 'waiting' ? 'bg-amber-100 text-amber-700' : n.status === 'notified' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{n.status}</span>
                {n.status === 'waiting' && <button onClick={() => markNotified(n.id)} className="rounded-lg p-2 text-green-600 hover:bg-green-50" title="জানানো হয়েছে"><Check className="h-4 w-4" /></button>}
                {n.status !== 'cancelled' && <button onClick={() => cancel(n.id)} className="rounded-lg p-2 text-orange-600 hover:bg-orange-50" title="বাতিল"><Trash2 className="h-4 w-4" /></button>}
                <button onClick={() => remove(n.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="মুছুন"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন নোটিফিকেশন নেই</p>}
      </div>
    </div>
  );
}
