'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').order('display_order');
    setServices(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    if (editing) {
      await supabase.from('services').update(formData).eq('id', editing.id);
      toast('সার্ভিস আপডেট হয়েছে');
    } else {
      await supabase.from('services').insert(formData);
      toast('সার্ভিস যোগ হয়েছে');
    }
    setShowForm(false); setEditing(null); loadServices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('সার্ভিস মুছতে চান?')) return;
    await supabase.from('services').delete().eq('id', id);
    toast('সার্ভিস মুছে ফেলা হয়েছে');
    loadServices();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">সার্ভিস</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> নতুন সার্ভিস</button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.short_description}</p>
                <span className={`mt-2 inline-block text-xs ${s.is_active ? 'text-green-600' : 'text-destructive'}`}>{s.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(s); setShowForm(true); }} className="rounded p-1.5 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(s.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showForm && <ServiceForm service={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function ServiceForm({ service, onSave, onClose }: any) {
  const [form, setForm] = useState({
    title: service?.title || '', short_description: service?.short_description || '',
    full_description: service?.full_description || '', icon: service?.icon || '',
    image: service?.image || '', cta_text: service?.cta_text || '', cta_url: service?.cta_url || '',
    display_order: service?.display_order || 0, is_active: service?.is_active ?? true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{service ? 'সার্ভিস এডিট' : 'নতুন সার্ভিস'}</h2><button onClick={onClose}><X className="h-6 w-6" /></button></div>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, display_order: Number(form.display_order) }); }} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">শিরোনাম</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">সংক্ষিপ্ত বিবরণ</label><textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          <div><label className="mb-1 block text-sm font-medium">বিস্তারিত বিবরণ</label><textarea value={form.full_description} onChange={(e) => setForm({ ...form, full_description: e.target.value })} className="input-bangla min-h-[100px]" /></div>
          <div><label className="mb-1 block text-sm font-medium">CTA টেক্সট</label><input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">CTA URL</label><input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">ডিসপ্লে অর্ডার</label><input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className="input-bangla" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary" /> সক্রিয়</label>
          <button type="submit" className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">সেভ করুন</button>
        </form>
      </div>
    </div>
  );
}
