'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, X, Upload, Link as LinkIcon } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadBanners(); }, []);

  const loadBanners = async () => {
    const { data } = await supabase.from('banners').select('*').order('display_order');
    setBanners(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    if (editing) {
      await supabase.from('banners').update(formData).eq('id', editing.id);
      toast('ব্যানার আপডেট হয়েছে');
    } else {
      await supabase.from('banners').insert(formData);
      toast('ব্যানার যোগ হয়েছে');
    }
    setShowForm(false); setEditing(null); loadBanners();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ব্যানার মুছতে চান?')) return;
    await supabase.from('banners').delete().eq('id', id);
    toast('ব্যানার মুছে ফেলা হয়েছে');
    loadBanners();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ব্যানার</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> নতুন ব্যানার</button>
      </div>
      <div className="space-y-3">
        {banners.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div className="flex-1">
              <h3 className="font-semibold">{b.title || '(শিরোনাম ছাড়া)'}</h3>
              {b.subtitle && <p className="text-sm text-muted-foreground">{b.subtitle}</p>}
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <span>অর্ডার: {b.display_order}</span>
                <span className={b.is_active ? 'text-green-600' : 'text-destructive'}>{b.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
                {b.cta_text && <span>CTA: {b.cta_text}</span>}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(b); setShowForm(true); }} className="rounded p-1.5 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
              <button onClick={() => handleDelete(b.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {banners.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন ব্যানার নেই</p>}
      </div>
      {showForm && <BannerForm banner={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function BannerForm({ banner, onSave, onClose }: any) {
  const [form, setForm] = useState({
    desktop_image: banner?.desktop_image || '', mobile_image: banner?.mobile_image || '',
    title: banner?.title || '', subtitle: banner?.subtitle || '',
    cta_text: banner?.cta_text || '', cta_url: banner?.cta_url || '',
    display_order: banner?.display_order || 0, is_active: banner?.is_active ?? true,
  });
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState({ desktop: '', mobile: '' });
  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File, field: 'desktop_image' | 'mobile_image') => {
    setUploading(true);
    try {
      const processed = await processLocalImage(file, { maxWidth: 1920, maxHeight: 1080 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      setForm({ ...form, [field]: url });
      toast('ছবি প্রসেস ও আপলোড হয়েছে');
    } catch (err: any) { toast(`আপলোড ব্যর্থ: ${err.message}`, 'error'); }
    finally { setUploading(false); }
  };

  const importFromUrl = async (field: 'desktop_image' | 'mobile_image') => {
    const url = field === 'desktop_image' ? urlInput.desktop : urlInput.mobile;
    if (!url.trim()) return;
    setUploading(true);
    try {
      const processed = await processUrlImage(url.trim(), { maxWidth: 1920, maxHeight: 1080 });
      const uploadedUrl = await uploadProcessedFile(processed, 'product-images', supabase);
      setForm({ ...form, [field]: uploadedUrl });
      setUrlInput({ ...urlInput, [field === 'desktop_image' ? 'desktop' : 'mobile']: '' });
      toast('ছবি ইম্পোর্ট ও ওয়াটারমার্ক হয়েছে');
    } catch (err: any) { toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error'); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{banner ? 'ব্যানার এডিট' : 'নতুন ব্যানার'}</h2><button onClick={onClose}><X className="h-6 w-6" /></button></div>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, display_order: Number(form.display_order) }); }} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">ডেস্কটপ ছবি</label><p className="mb-1 text-xs text-muted-foreground">Recommended: 1920 × 1080 px — Best for display</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => desktopRef.current?.click()} disabled={uploading} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Upload className="h-4 w-4" /> আপলোড</button>
              <input ref={desktopRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'desktop_image'); e.target.value = ''; }} />
              <input value={urlInput.desktop} onChange={(e) => setUrlInput({ ...urlInput, desktop: e.target.value })} className="input-bangla flex-1" placeholder="অথবা ছবি URL (ওয়াটারমার্ক সহ)" />
              <button type="button" onClick={() => importFromUrl('desktop_image')} disabled={uploading} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><LinkIcon className="h-4 w-4" /></button>
            </div>
            {form.desktop_image && <img src={form.desktop_image} alt="" className="mt-1 h-20 w-full rounded-lg object-cover" />}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">মোবাইল ছবি</label><p className="mb-1 text-xs text-muted-foreground">Recommended: 1080 × 1080 px — Best for display</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => mobileRef.current?.click()} disabled={uploading} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Upload className="h-4 w-4" /> আপলোড</button>
              <input ref={mobileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'mobile_image'); e.target.value = ''; }} />
              <input value={urlInput.mobile} onChange={(e) => setUrlInput({ ...urlInput, mobile: e.target.value })} className="input-bangla flex-1" placeholder="অথবা ছবি URL (ওয়াটারমার্ক সহ)" />
              <button type="button" onClick={() => importFromUrl('mobile_image')} disabled={uploading} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><LinkIcon className="h-4 w-4" /></button>
            </div>
            {form.mobile_image && <img src={form.mobile_image} alt="" className="mt-1 h-20 w-20 rounded-lg object-cover" />}
          </div>
          {uploading && <p className="text-sm text-primary">প্রসেস হচ্ছে...</p>}
          <div><label className="mb-1 block text-sm font-medium">শিরোনাম</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">সাবটাইটেল</label><input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="input-bangla" /></div>
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
