'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from '@/components/site/toast-provider';
import { Save, Trash2, Plus, X, Calendar, Eye, EyeOff, Upload, Link as LinkIcon } from 'lucide-react';
import type { PromotionalPopup } from '@/lib/supabase/types';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';

const FREQ_OPTIONS = [
  { value: 'every_visit', label: 'Every Visit' },
  { value: 'once_per_session', label: 'Once Per Session' },
  { value: 'once_per_day', label: 'Once Per Day' },
  { value: 'once_until_closed', label: 'Once Until Closed' },
];

export default function AdminPopupsPage() {
  const [popups, setPopups] = useState<PromotionalPopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PromotionalPopup | null>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const processed = await processLocalImage(file, { maxWidth: 1200, maxHeight: 1200 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      if (editing) setEditing({ ...editing, image: url });
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
      if (editing) setEditing({ ...editing, image: url });
      setUrlInput('');
      toast('ছবি ইম্পোর্ট ও ওয়াটারমার্ক হয়েছে');
    } catch (err: any) { toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error'); }
    finally { setUploading(false); }
  };

  const fetchPopups = async () => {
    const { data } = await supabase.from('promotional_popups').select('*').order('created_at', { ascending: false });
    setPopups((data || []) as PromotionalPopup[]);
    setLoading(false);
  };

  useEffect(() => { fetchPopups(); }, []);

  const newPopup = (): PromotionalPopup => ({
    id: '', title: '', description: '', image: '', offer: '', cta_text: '', cta_link: '',
    start_date: new Date().toISOString().slice(0, 16),
    end_date: null, is_active: false, show_on_main: true, show_on_offers: false,
    show_close_button: true, auto_close: false, auto_close_seconds: 10,
    display_frequency: 'every_visit', created_at: '', updated_at: '',
  });

  const save = async () => {
    if (!editing) return;
    if (editing.id) {
      const { id, created_at, updated_at, ...payload } = editing;
      const { error } = await supabase.from('promotional_popups').update(payload).eq('id', editing.id);
      if (error) { toast('Save failed', 'error'); return; }
      toast('Popup updated');
    } else {
      const { id, created_at, updated_at, ...payload } = editing;
      const { error } = await supabase.from('promotional_popups').insert(payload);
      if (error) { toast('Save failed', 'error'); return; }
      toast('Popup created');
    }
    setEditing(null);
    fetchPopups();
  };

  const toggleActive = async (p: PromotionalPopup) => {
    await supabase.from('promotional_popups').update({ is_active: !p.is_active }).eq('id', p.id);
    fetchPopups();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this popup?')) return;
    await supabase.from('promotional_popups').delete().eq('id', id);
    fetchPopups();
    toast('Popup deleted');
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Promotional Popups</h1>
        <button onClick={() => setEditing(newPopup())} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Popup
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {popups.length === 0 && <p className="text-muted-foreground">No popups yet. Click "New Popup" to create one.</p>}
        {popups.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-4">
              {p.image ? <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-xl">📣</div>}
              <div>
                <p className="font-semibold text-foreground">{p.title || '(untitled)'}</p>
                <p className="text-xs text-muted-foreground">
                  {p.is_active ? <span className="text-green-600">Active</span> : <span className="text-muted-foreground">Inactive</span>}
                  {' · '}
                  {p.display_frequency.replace(/_/g, ' ')}
                  {' · '}
                  {p.show_on_main ? 'Main ' : ''}{p.show_on_offers ? 'Offers' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(p)} className="rounded-lg p-2 hover:bg-secondary" title={p.is_active ? 'Deactivate' : 'Activate'}>
                {p.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button onClick={() => setEditing(p)} className="rounded-lg p-2 hover:bg-secondary"><Save className="h-4 w-4" /></button>
              <button onClick={() => del(p.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? 'Edit Popup' : 'New Popup'}</h2>
              <button onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="input-bangla" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input-bangla min-h-[60px]" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Image</label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Upload className="h-4 w-4" /> Upload</button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); e.target.value = ''; }} />
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="input-bangla flex-1" placeholder="or image URL (watermarked)" />
                  <button type="button" onClick={importFromUrl} disabled={uploading} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><LinkIcon className="h-4 w-4" /></button>
                </div>
                {uploading && <p className="mt-1 text-xs text-primary">Processing...</p>}
                {editing.image && <img src={editing.image} alt="" className="mt-1 h-20 w-20 rounded-lg object-cover" />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Offer Text</label>
                  <input value={editing.offer} onChange={(e) => setEditing({ ...editing, offer: e.target.value })} className="input-bangla" placeholder="20% OFF" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">CTA Text</label>
                  <input value={editing.cta_text} onChange={(e) => setEditing({ ...editing, cta_text: e.target.value })} className="input-bangla" placeholder="Shop Now" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">CTA Link</label>
                <input value={editing.cta_link} onChange={(e) => setEditing({ ...editing, cta_link: e.target.value })} className="input-bangla" placeholder="/all-products" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Start Date</label>
                  <input type="datetime-local" value={(editing.start_date || '').slice(0, 16)} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} className="input-bangla" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">End Date (optional)</label>
                  <input type="datetime-local" value={(editing.end_date || '').slice(0, 16)} onChange={(e) => setEditing({ ...editing, end_date: e.target.value || null })} className="input-bangla" />
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="accent-primary" /> Active (ON/OFF)</label>
                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editing.show_on_main} onChange={(e) => setEditing({ ...editing, show_on_main: e.target.checked })} className="accent-primary" /> Show on Main Website</label>
                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editing.show_on_offers} onChange={(e) => setEditing({ ...editing, show_on_offers: e.target.checked })} className="accent-primary" /> Show on Ads Landing Pages (/offer/*)</label>
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editing.show_close_button} onChange={(e) => setEditing({ ...editing, show_close_button: e.target.checked })} className="accent-primary" /> Show X Close Button</label>
                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editing.auto_close} onChange={(e) => setEditing({ ...editing, auto_close: e.target.checked })} className="accent-primary" /> Auto Close</label>
                {editing.auto_close && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Auto Close After (seconds)</label>
                    <input type="number" value={editing.auto_close_seconds} onChange={(e) => setEditing({ ...editing, auto_close_seconds: Number(e.target.value) })} className="input-bangla" />
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <label className="mb-1 block text-sm font-medium">Display Frequency</label>
                <select value={editing.display_frequency} onChange={(e) => setEditing({ ...editing, display_frequency: e.target.value })} className="input-bangla">
                  {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <button onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">
                <Save className="h-4 w-4" /> {editing.id ? 'Update Popup' : 'Create Popup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
