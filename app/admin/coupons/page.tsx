'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadCoupons(); }, []);

  const loadCoupons = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    if (editing) {
      await supabase.from('coupons').update(formData).eq('id', editing.id);
      toast('কুপন আপডেট হয়েছে');
    } else {
      await supabase.from('coupons').insert(formData);
      toast('কুপন যোগ হয়েছে');
    }
    setShowForm(false);
    setEditing(null);
    loadCoupons();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('কুপন মুছতে চান?')) return;
    await supabase.from('coupons').delete().eq('id', id);
    toast('কুপন মুছে ফেলা হয়েছে');
    loadCoupons();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">কুপন</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> নতুন কুপন
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3">কোড</th><th className="p-3">ধরন</th><th className="p-3">মূল্য</th><th className="p-3">ব্যবহার</th><th className="p-3">স্ট্যাটাস</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="p-3 font-mono font-bold">{c.code}</td>
                <td className="p-3">{c.type === 'fixed' ? 'নির্দিষ্ট' : 'শতকরা'}</td>
                <td className="p-3">{c.type === 'fixed' ? formatPrice(c.value) : `${c.value}%`}</td>
                <td className="p-3">{c.usage_count}/{c.usage_limit || '∞'}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span></td>
                <td className="p-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(c); setShowForm(true); }} className="rounded p-1.5 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন কুপন নেই</p>}
      </div>

      {showForm && (
        <CouponForm coupon={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function CouponForm({ coupon, onSave, onClose }: any) {
  const [form, setForm] = useState({
    code: coupon?.code || '', type: coupon?.type || 'fixed', value: coupon?.value || 0,
    min_order: coupon?.min_order || 0, max_discount: coupon?.max_discount || '',
    usage_limit: coupon?.usage_limit || '', is_active: coupon?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, value: Number(form.value), min_order: Number(form.min_order), max_discount: form.max_discount ? Number(form.max_discount) : null, usage_limit: form.usage_limit ? Number(form.usage_limit) : null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{coupon ? 'কুপন এডিট' : 'নতুন কুপন'}</h2><button onClick={onClose}><X className="h-6 w-6" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">কোড</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">ধরন</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-bangla"><option value="fixed">নির্দিষ্ট ছাড়</option><option value="percentage">শতকরা ছাড়</option></select></div>
          <div><label className="mb-1 block text-sm font-medium">মূল্য</label><input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">ন্যূনতম অর্ডার</label><input type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} className="input-bangla" /></div>
          {form.type === 'percentage' && <div><label className="mb-1 block text-sm font-medium">সর্বোচ্চ ছাড়</label><input type="number" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} className="input-bangla" /></div>}
          <div><label className="mb-1 block text-sm font-medium">ব্যবহার লিমিট</label><input type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} className="input-bangla" placeholder="খালি = আনলিমিটেড" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary" /> সক্রিয়</label>
          <button type="submit" className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">সেভ করুন</button>
        </form>
      </div>
    </div>
  );
}
