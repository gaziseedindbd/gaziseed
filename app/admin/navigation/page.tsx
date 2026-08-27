'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminNavigationPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadNav(); }, []);

  const loadNav = async () => {
    const { data } = await supabase.from('navigation').select('*').order('display_order');
    setItems(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    if (editing) {
      await supabase.from('navigation').update(formData).eq('id', editing.id);
      toast('মেনু আপডেট হয়েছে');
    } else {
      await supabase.from('navigation').insert(formData);
      toast('মেনু যোগ হয়েছে');
    }
    setShowForm(false); setEditing(null); loadNav();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('মেনু আইটেম মুছতে চান?')) return;
    await supabase.from('navigation').delete().eq('id', id);
    toast('মেনু মুছে ফেলা হয়েছে');
    loadNav();
  };

  const moveOrder = async (item: any, direction: 'up' | 'down') => {
    const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((i) => i.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapItem = sorted[swapIdx];
    await supabase.from('navigation').update({ display_order: swapItem.display_order }).eq('id', item.id);
    await supabase.from('navigation').update({ display_order: item.display_order }).eq('id', swapItem.id);
    loadNav();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">নেভিগেশন</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> নতুন মেনু</button>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <button onClick={() => moveOrder(item, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => moveOrder(item, 'down')} disabled={idx === items.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.url}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{item.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(item); setShowForm(true); }} className="rounded p-1.5 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
              <button onClick={() => handleDelete(item.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন মেনু নেই</p>}
      </div>
      {showForm && <NavForm item={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function NavForm({ item, onSave, onClose }: any) {
  const [form, setForm] = useState({
    title: item?.title || '', url: item?.url || '/',
    display_order: item?.display_order || 0, is_active: item?.is_active ?? true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{item ? 'মেনু এডিট' : 'নতুন মেনু'}</h2><button onClick={onClose}><X className="h-6 w-6" /></button></div>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, display_order: Number(form.display_order) }); }} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">মেনু টাইটেল</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">URL</label><input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">ডিসপ্লে অর্ডার</label><input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className="input-bangla" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary" /> সক্রিয়</label>
          <button type="submit" className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">সেভ করুন</button>
        </form>
      </div>
    </div>
  );
}
