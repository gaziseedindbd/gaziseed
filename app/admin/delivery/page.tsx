'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminDeliveryPage() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadZones(); }, []);

  const loadZones = async () => {
    const { data } = await supabase.from('delivery_zones').select('*').order('display_order');
    setZones(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    if (editing) {
      await supabase.from('delivery_zones').update(formData).eq('id', editing.id);
      toast('ডেলিভারি জোন আপডেট হয়েছে');
    } else {
      await supabase.from('delivery_zones').insert(formData);
      toast('ডেলিভারি জোন যোগ হয়েছে');
    }
    setShowForm(false); setEditing(null); loadZones();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ডেলিভারি জোন মুছতে চান?')) return;
    await supabase.from('delivery_zones').delete().eq('id', id);
    toast('ডেলিভারি জোন মুছে ফেলা হয়েছে');
    loadZones();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ডেলিভারি জোন</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> নতুন জোন</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            <th className="p-3">জোন</th><th className="p-3">চার্জ</th><th className="p-3">সময়</th><th className="p-3">COD</th><th className="p-3">স্ট্যাটাস</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-b border-border/50">
                <td className="p-3 font-medium">{z.zone_name}</td>
                <td className="p-3 font-bold">{formatPrice(z.charge)}</td>
                <td className="p-3 text-muted-foreground">{z.estimated_time}</td>
                <td className="p-3">{z.cod_enabled ? 'হ্যাঁ' : 'না'}</td>
                <td className="p-3"><span className={`text-xs ${z.is_active ? 'text-green-600' : 'text-destructive'}`}>{z.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span></td>
                <td className="p-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(z); setShowForm(true); }} className="rounded p-1.5 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(z.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {zones.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন জোন নেই</p>}
      </div>
      {showForm && <ZoneForm zone={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function ZoneForm({ zone, onSave, onClose }: any) {
  const [form, setForm] = useState({
    zone_name: zone?.zone_name || '', charge: zone?.charge || 0,
    estimated_time: zone?.estimated_time || '', cod_enabled: zone?.cod_enabled ?? true,
    is_active: zone?.is_active ?? true, display_order: zone?.display_order || 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{zone ? 'জোন এডিট' : 'নতুন জোন'}</h2><button onClick={onClose}><X className="h-6 w-6" /></button></div>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, charge: Number(form.charge), display_order: Number(form.display_order) }); }} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">জোন নাম</label><input value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">চার্জ (৳)</label><input type="number" value={form.charge} onChange={(e) => setForm({ ...form, charge: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">আনুমানিক সময়</label><input value={form.estimated_time} onChange={(e) => setForm({ ...form, estimated_time: e.target.value })} className="input-bangla" placeholder="১-২ দিন" /></div>
          <div><label className="mb-1 block text-sm font-medium">ডিসপ্লে অর্ডার</label><input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className="input-bangla" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.cod_enabled} onChange={(e) => setForm({ ...form, cod_enabled: e.target.checked })} className="accent-primary" /> COD সক্রিয়</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary" /> সক্রিয়</label>
          <button type="submit" className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">সেভ করুন</button>
        </form>
      </div>
    </div>
  );
}
