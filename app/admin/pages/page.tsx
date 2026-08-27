'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminPagesPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadPages(); }, []);

  const loadPages = async () => {
    const { data } = await supabase.from('pages').select('*').order('created_at', { ascending: false });
    setPages(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    if (editing) {
      await supabase.from('pages').update(formData).eq('id', editing.id);
      toast('পেজ আপডেট হয়েছে');
    } else {
      await supabase.from('pages').insert(formData);
      toast('পেজ যোগ হয়েছে');
    }
    setShowForm(false); setEditing(null); loadPages();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('পেজ মুছতে চান?')) return;
    await supabase.from('pages').delete().eq('id', id);
    toast('পেজ মুছে ফেলা হয়েছে');
    loadPages();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">পেজ</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> নতুন পেজ</button>
      </div>
      <div className="space-y-3">
        {pages.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div className="flex-1">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-xs text-muted-foreground">/page/{p.slug}</p>
              <span className={`text-xs ${p.is_published ? 'text-green-600' : 'text-destructive'}`}>{p.is_published ? 'প্রকাশিত' : 'খসড়া'}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded p-1.5 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
              <button onClick={() => handleDelete(p.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {pages.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন পেজ নেই</p>}
      </div>
      {showForm && <PageForm page={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function PageForm({ page, onSave, onClose }: any) {
  const [form, setForm] = useState({
    title: page?.title || '', slug: page?.slug || '', content: page?.content || '',
    seo_title: page?.seo_title || '', meta_description: page?.meta_description || '',
    is_published: page?.is_published ?? true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{page ? 'পেজ এডিট' : 'নতুন পেজ'}</h2><button onClick={onClose}><X className="h-6 w-6" /></button></div>
        <form onSubmit={(e) => { e.preventDefault(); const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); onSave({ ...form, slug }); }} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">শিরোনাম</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-bangla" placeholder="about-us" /></div>
          <div><label className="mb-1 block text-sm font-medium">কন্টেন্ট</label><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="input-bangla min-h-[200px]" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="accent-primary" /> প্রকাশিত</label>
          <button type="submit" className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">সেভ করুন</button>
        </form>
      </div>
    </div>
  );
}
