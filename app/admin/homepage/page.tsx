'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from '@/components/site/toast-provider';
import { Save, Eye, EyeOff, ChevronUp, ChevronDown, Upload, Link as LinkIcon, Trash2, Image as ImageIcon } from 'lucide-react';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';

const PROMO_SLOTS = [
  { slot: 'growing_guide', label: 'চাষাবাদ গাইড' },
  { slot: 'farmer_stories', label: 'কৃষকের গল্প' },
] as const;

export default function AdminHomepagePage() {
  const [sections, setSections] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPromo, setSavingPromo] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [sectionRes, promoRes] = await Promise.all([
      supabase.from('homepage_sections').select('*').order('display_order'),
      supabase.from('homepage_promos').select('*').order('display_order'),
    ]);
    setSections(sectionRes.data || []);
    setPromos(promoRes.data || []);
    setLoading(false);
  };

  const toggleSection = async (s: any) => {
    await supabase.from('homepage_sections').update({ is_enabled: !s.is_enabled }).eq('id', s.id);
    toast(s.is_enabled ? 'সেকশন বন্ধ হয়েছে' : 'সেকশন চালু হয়েছে');
    loadAll();
  };

  const updateTitle = async (id: string, title: string, subtitle: string) => {
    await supabase.from('homepage_sections').update({ title, subtitle }).eq('id', id);
  };

  const moveOrder = async (section: any, direction: 'up' | 'down') => {
    const sorted = [...sections].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((s) => s.id === section.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapItem = sorted[swapIdx];
    await supabase.from('homepage_sections').update({ display_order: swapItem.display_order }).eq('id', section.id);
    await supabase.from('homepage_sections').update({ display_order: section.display_order }).eq('id', swapItem.id);
    loadAll();
  };

  const getPromo = (slot: string) => promos.find((p) => p.slot === slot);

  const savePromo = async (promo: any) => {
    if (!promo?.id) return;
    setSavingPromo(promo.slot);
    const { error } = await supabase.from('homepage_promos').update({
      title: promo.title || '',
      subtitle: promo.subtitle || '',
      image_url: promo.image_url || '',
      href: promo.href || '/blog',
      button_text: promo.button_text || '',
      is_active: Boolean(promo.is_active),
      display_order: Number(promo.display_order) || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', promo.id);
    if (error) toast(`সেভ ব্যর্থ: ${error.message}`, 'error');
    else toast(`${promo.title || 'প্রোমো'} আপডেট হয়েছে`);
    setSavingPromo(null);
    loadAll();
  };

  const updatePromoLocal = (slot: string, patch: Record<string, unknown>) => {
    setPromos((items) => items.map((item) => item.slot === slot ? { ...item, ...patch } : item));
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-bold">হোমপেজ ম্যানেজমেন্ট</h1>
        <p className="text-sm text-muted-foreground">হোমপেজের সেকশন চালু/বন্ধ করুন, টাইটেল পরিবর্তন করুন এবং নতুন promo banner/image আলাদাভাবে নিয়ন্ত্রণ করুন।</p>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">হোমপেজ সেকশন</h2>
            <p className="text-xs text-muted-foreground">সেকশনের ক্রম ও visibility নিয়ন্ত্রণ করুন।</p>
          </div>
        </div>
        <div className="space-y-2">
          {sections.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col">
                <button onClick={() => moveOrder(s, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => moveOrder(s, 'down')} disabled={idx === sections.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
              <div className="flex-1">
                <input value={s.title || ''} onChange={(e) => setSections(sections.map((item) => item.id === s.id ? { ...item, title: e.target.value } : item))} onBlur={(e) => updateTitle(s.id, e.target.value, s.subtitle)} className="w-full rounded-lg border border-input px-3 py-2 text-sm font-medium" placeholder={s.section_key} />
                <input value={s.subtitle || ''} onChange={(e) => setSections(sections.map((item) => item.id === s.id ? { ...item, subtitle: e.target.value } : item))} onBlur={(e) => updateTitle(s.id, s.title, e.target.value)} className="mt-1 w-full rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground" placeholder="সাবটাইটেল" />
              </div>
              <button onClick={() => toggleSection(s)} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${s.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {s.is_enabled ? <><Eye className="h-4 w-4" /> চালু</> : <><EyeOff className="h-4 w-4" /> বন্ধ</>}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Homepage Promo Images</h2>
          <p className="text-xs text-muted-foreground">এই দুইটি image Main Hero Banner থেকে সম্পূর্ণ আলাদা। এখানে image, title, text, link ও active status আলাদাভাবে edit/delete/replace করতে পারবেন। Recommended: 1200 × 600 px.</p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {PROMO_SLOTS.map(({ slot, label }) => {
            const promo = getPromo(slot);
            return promo ? (
              <PromoEditor key={slot} promo={promo} label={label} saving={savingPromo === slot} onChange={(patch) => updatePromoLocal(slot, patch)} onSave={() => savePromo(getPromo(slot))} />
            ) : (
              <div key={slot} className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">{label} slot পাওয়া যায়নি।</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PromoEditor({ promo, label, saving, onChange, onSave }: { promo: any; label: string; saving: boolean; onChange: (patch: Record<string, unknown>) => void; onSave: () => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const processed = await processLocalImage(file, { maxWidth: 1600, maxHeight: 900 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      onChange({ image_url: url });
      toast('প্রোমো ছবি আপলোড হয়েছে');
    } catch (err: any) {
      toast(`আপলোড ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const importFromUrl = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      const processed = await processUrlImage(urlInput.trim(), { maxWidth: 1600, maxHeight: 900 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      onChange({ image_url: url });
      setUrlInput('');
      toast('প্রোমো ছবি ইম্পোর্ট হয়েছে');
    } catch (err: any) {
      toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary" /><h3 className="font-bold">{label}</h3></div>
          <p className="mt-1 text-xs text-muted-foreground">Slot: {promo.slot}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(promo.is_active)} onChange={(e) => onChange({ is_active: e.target.checked })} className="accent-primary" />
          {promo.is_active ? 'সক্রিয়' : 'বন্ধ'}
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-secondary/30">
        {promo.image_url ? <img src={promo.image_url} alt={promo.title || label} className="aspect-[2/1] w-full object-cover" /> : <div className="flex aspect-[2/1] items-center justify-center text-sm text-muted-foreground">কোনো image নেই</div>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Upload className="h-4 w-4" />{uploading ? 'প্রসেস হচ্ছে...' : 'ছবি আপলোড'}</button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFile(file); e.target.value = ''; }} />
        <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="input-bangla min-w-[220px] flex-1" placeholder="Image URL" />
        <button type="button" onClick={() => void importFromUrl()} disabled={uploading} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><LinkIcon className="h-4 w-4" /></button>
        {promo.image_url && <button type="button" onClick={() => onChange({ image_url: '' })} className="flex items-center gap-2 rounded-lg border border-destructive/20 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /> ছবি সরান</button>}
      </div>

      <div className="mt-5 grid gap-3">
        <div><label className="mb-1 block text-sm font-medium">শিরোনাম</label><input value={promo.title || ''} onChange={(e) => onChange({ title: e.target.value })} className="input-bangla" /></div>
        <div><label className="mb-1 block text-sm font-medium">সাবটাইটেল</label><input value={promo.subtitle || ''} onChange={(e) => onChange({ subtitle: e.target.value })} className="input-bangla" /></div>
        <div><label className="mb-1 block text-sm font-medium">বাটন টেক্সট</label><input value={promo.button_text || ''} onChange={(e) => onChange({ button_text: e.target.value })} className="input-bangla" /></div>
        <div><label className="mb-1 block text-sm font-medium">লিংক</label><input value={promo.href || ''} onChange={(e) => onChange({ href: e.target.value })} className="input-bangla" placeholder="/blog" /></div>
        <div><label className="mb-1 block text-sm font-medium">ডিসপ্লে অর্ডার</label><input type="number" value={promo.display_order ?? 0} onChange={(e) => onChange({ display_order: Number(e.target.value) })} className="input-bangla" /></div>
      </div>

      <button type="button" onClick={onSave} disabled={saving || uploading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        <Save className="h-4 w-4" /> {saving ? 'সেভ হচ্ছে...' : 'প্রোমো সেভ করুন'}
      </button>
    </div>
  );
}
