'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { Search, Eye, X, Package } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending: 'অর্ডার গৃহীত', confirmed: 'কনফার্মড', processing: 'প্রসেসিং', packed: 'প্যাকড',
  shipped: 'শিপড', delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'ফেরত',
};

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [newStock, setNewStock] = useState(0);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name_bn, name_en, sku, stock, low_stock_threshold, is_ads_only, is_active').order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const filtered = products.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name_bn?.toLowerCase().includes(s) || p.name_en?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s);
  });

  const updateStock = async () => {
    if (!editing) return;
    const oldStock = editing.stock;
    const change = newStock - oldStock;
    await supabase.from('products').update({ stock: newStock }).eq('id', editing.id);
    if (change !== 0) {
      await supabase.from('inventory_history').insert({ product_id: editing.id, quantity_change: change, reason: 'Manual adjustment' });
    }
    toast('স্টক আপডেট হয়েছে');
    setEditing(null);
    loadProducts();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">ইনভেন্টরি</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন..." className="input-bangla pl-10" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3">প্রোডাক্ট</th>
              <th className="p-3">SKU</th>
              <th className="p-3">স্টক</th>
              <th className="p-3">স্ট্যাটাস</th>
              <th className="p-3">ধরন</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="p-3 font-medium">{p.name_bn || p.name_en}</td>
                <td className="p-3 text-muted-foreground">{p.sku}</td>
                <td className="p-3">
                  <span className={p.stock <= p.low_stock_threshold ? 'font-bold text-destructive' : ''}>{p.stock}</span>
                  {p.stock <= p.low_stock_threshold && <span className="ml-1 text-xs text-destructive">(Low)</span>}
                </td>
                <td className="p-3"><span className={`text-xs ${p.is_active ? 'text-green-600' : 'text-destructive'}`}>{p.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span></td>
                <td className="p-3">{p.is_ads_only ? <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Ads Only</span> : <span className="text-xs text-muted-foreground">Website</span>}</td>
                <td className="p-3"><button onClick={() => { setEditing(p); setNewStock(p.stock); }} className="rounded-lg p-1.5 hover:bg-secondary"><Eye className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">স্টক আপডেট</h2>
              <button onClick={() => setEditing(null)}><X className="h-6 w-6" /></button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{editing.name_bn || editing.name_en}</p>
            <p className="mb-2 text-sm">বর্তমান স্টক: <span className="font-bold">{editing.stock}</span></p>
            <div><label className="mb-1 block text-sm font-medium">নতুন স্টক</label><input type="number" value={newStock} onChange={(e) => setNewStock(Number(e.target.value))} className="input-bangla" /></div>
            <button onClick={updateStock} className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">আপডেট করুন</button>
          </div>
        </div>
      )}
    </div>
  );
}

import { toast } from '@/components/site/toast-provider';
