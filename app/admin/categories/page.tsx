'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, X, Upload, Link as LinkIcon, Star } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('display_order');
    setCategories(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    if (editing) {
      await supabase.from('categories').update(formData).eq('id', editing.id);
      toast('ক্যাটাগরি আপডেট হয়েছে');
    } else {
      await supabase.from('categories').insert(formData);
      toast('ক্যাটাগরি যোগ হয়েছে');
    }
    setShowForm(false);
    setEditing(null);
    loadCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ক্যাটাগরি মুছতে চান?')) return;
    await supabase.from('categories').delete().eq('id', id);
    toast('ক্যাটাগরি মুছে ফেলা হয়েছে');
    loadCategories();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ক্যাটাগরি</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> নতুন ক্যাটাগরি
        </button>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-secondary" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                {c.image ? <img src={c.image} alt={c.name_bn} className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-2xl">🌱</div>}
                <div>
                  <p className="font-medium">{c.name_bn}</p>
                  <p className="text-xs text-muted-foreground">{c.slug}</p>
                  <span className={`text-xs ${c.is_active ? 'text-green-600' : 'text-destructive'}`}>{c.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(c); setShowForm(true); }} className="rounded-lg p-1.5 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CategoryForm category={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function CategoryForm({ category, onSave, onClose }: { category: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name_bn: category?.name_bn || '',
    name_en: category?.name_en || '',
    slug: category?.slug || '',
    description: category?.description || '',
    image: category?.image || '',
    banner: category?.banner || '',
    display_order: category?.display_order || 0,
    is_active: category?.is_active ?? true,
    seo_title: category?.seo_title || '',
    meta_description: category?.meta_description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = form.slug || form.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || form.name_bn;
    onSave({ ...form, slug, display_order: Number(form.display_order) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{category ? 'ক্যাটাগরি এডিট' : 'নতুন ক্যাটাগরি'}</h2>
          <button onClick={onClose}><X className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">নাম (বাংলা)</label><input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">নাম (English)</label><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-bangla" placeholder="auto-generated" /></div>
          <div><label className="mb-1 block text-sm font-medium">বিবরণ</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          
          {/* ক্যাটাগরি থাম্বনেইল ছবি (৮০০x৮০০ px) */}
          <CategoryImageUploader 
            image={form.image} 
            setImage={(v) => setForm({ ...form, image: v })} 
            label="ক্যাটাগরি ছবি" 
            recommendation="800 × 800 px (Square) — Best for icon/card"
          />

          {/* ক্যাটাগরি ব্যানার ছবি (১২০০x৪০০ px) */}
          <CategoryImageUploader 
            image={form.banner} 
            setImage={(v) => setForm({ ...form, banner: v })} 
            label="ব্যানার ছবি" 
            recommendation="1200 × 400 px (Wide) — Best for header banner"
          />

          <div><label className="mb-1 block text-sm font-medium">ডিসপ্লে অর্ডার</label><input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className="input-bangla" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary" /> সক্রিয়</label>
          <button type="submit" className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">সেভ করুন</button>
        </form>
      </div>
    </div>
  );
}

function CategoryImageUploader({ image, setImage, label, recommendation }: { image: string; setImage: (v: string) => void; label: string; recommendation?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const processed = await processLocalImage(file, { maxWidth: 1200, maxHeight: 1200 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      setImage(url);
      toast('ছবি প্রসেস ও আপলোড হয়েছে');
    } catch (err: any) { toast(`আপলোড ব্যর্থ: ${err.message}`, 'error'); }
    finally { setUploading(false); }
  };

  const importFromUrl = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      const processed = await processUrlImage(urlInput.trim(), { maxWidth: 1200, maxHeight: 1200 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      setImage(url);
      setUrlInput('');
      toast('ছবি ইম্পোর্ট ও ওয়াটারমার্ক হয়েছে');
    } catch (err: any) { toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error'); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      {recommendation && <p className="text-xs text-muted-foreground">Recommended: {recommendation}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Upload className="h-4 w-4" /> {uploading ? 'প্রসেস হচ্ছে...' : 'আপলোড'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ''; }} />
        <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="input-bangla flex-1" placeholder="অথবা ছবি URL (ওয়াটারমার্ক সহ)" />
        <button type="button" onClick={importFromUrl} disabled={uploading} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><LinkIcon className="h-4 w-4" /> ইম্পোর্ট</button>
      </div>
      {uploading && <p className="text-xs text-primary">প্রসেস ও আপলোড হচ্ছে...</p>}
      {image && (
        <div className="relative inline-block">
          <img src={image} alt="" className="h-24 w-24 rounded-lg border border-border object-cover" />
          <button type="button" onClick={() => setImage('')} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
        </div>
      )}
    </div>
  );
}
