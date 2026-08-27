'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, X, Search, Upload, Loader2, Image as ImageIcon, FileText, Link as LinkIcon } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';

export default function AdminComboPacksPage() {
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => { loadCombos(); }, []);

  const loadCombos = async () => {
    const { data } = await supabase.from('combo_packs').select('*');
    setCombos(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    const { items, ...rawPayload } = formData;
    
    const payload = {
      title_bn: rawPayload.title_bn,
      slug: rawPayload.slug,
      description_bn: rawPayload.description_bn,
      regular_total: Number(rawPayload.regular_total) || 0,
      combo_price: Number(rawPayload.combo_price) || 0,
      tier_pricing: rawPayload.tier_pricing || [],
      manual_items_list: rawPayload.manual_items_list || [],
      is_active: rawPayload.is_active,
      images: rawPayload.images || [],
    };

    let comboId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('combo_packs').update(payload).eq('id', editing.id);
      if (error) { toast('আপডেট ব্যর্থ: ' + error.message, 'error'); return; }
      await supabase.from('combo_items').delete().eq('combo_id', editing.id);
    } else {
      const { data, error } = await supabase.from('combo_packs').insert([payload]).select('id').single();
      if (error) { toast('যোগ করা ব্যর্থ: ' + error.message, 'error'); return; }
      comboId = data.id;
    }

    if (comboId && items?.length > 0) {
      const { error: itemsError } = await supabase.from('combo_items').insert(
        items.map((it: any) => ({
          combo_id: comboId,
          product_id: it.product_id,
          quantity: Number(it.quantity) || 1,
          unit_type: it.unit_type || 'piece',
        }))
      );
      if (itemsError) { toast('কম্বো আইটেম সেভ ব্যর্থ: ' + itemsError.message, 'error'); return; }
    }

    toast('সফলভাবে সেভ হয়েছে');
    setShowForm(false);
    setEditing(null);
    loadCombos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('মুছতে চান?')) return;
    await supabase.from('combo_packs').delete().eq('id', id);
    toast('কম্বো মুছে ফেলা হয়েছে');
    loadCombos();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">কম্বো প্যাক</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-5 w-5" /> নতুন কম্বো
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {combos.map((c) => {
          const firstTier = Array.isArray(c.tier_pricing) ? c.tier_pricing[0] : null;
          const offerPrice = Number(firstTier?.offer) || Number(c.combo_price) || 0;
          const regularPrice = Number(firstTier?.regular) || Number(c.regular_total) || 0;

          return (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between">
              <div>
                {c.images?.[0] && <img src={c.images[0]} alt={c.title_bn} className="mb-3 h-40 w-full rounded-xl object-cover" />}
                <h3 className="font-bold text-lg">{c.title_bn}</h3>
                {c.description_bn && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.description_bn}</p>}
                
                <div className="mt-3 flex items-center gap-3">
                  {regularPrice > 0 && <span className="text-sm text-muted-foreground line-through">৳{regularPrice}</span>}
                  <span className="text-xl font-bold text-primary">৳{offerPrice}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {c.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(c); setShowForm(true); }} className="rounded-lg p-2 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
        {combos.length === 0 && <p className="col-span-full p-8 text-center text-muted-foreground">কোন কম্বো প্যাক নেই</p>}
      </div>

      {showForm && <ComboForm combo={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function ComboForm({ combo, onSave, onClose }: { combo: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    title_bn: combo?.title_bn || '',
    slug: combo?.slug || '',
    description_bn: combo?.description_bn || '',
    regular_total: combo?.regular_total || 0,
    combo_price: combo?.combo_price || 0,
    is_active: combo?.is_active ?? true,
  });

  const [manualItems, setManualItems] = useState<any[]>(
    Array.isArray(combo?.manual_items_list) && combo.manual_items_list.length > 0 
      ? combo.manual_items_list 
      : [{ name: '', qty: '' }]
  );

  const addManualRow = () => setManualItems([...manualItems, { name: '', qty: '' }]);
  const removeManualRow = (index: number) => setManualItems(manualItems.filter((_, i) => i !== index));
  const updateManualRow = (index: number, field: string, value: string) => {
    const updated = [...manualItems];
    updated[index][field] = value;
    setManualItems(updated);
  };

  const [tiers, setTiers] = useState<any[]>(combo?.tier_pricing || [
    { qty: 1, regular: 500, offer: 300, badge: 'BEST', freeDelivery: true },
    { qty: 2, regular: 1000, offer: 500, badge: 'POPULAR', freeDelivery: true },
    { qty: 3, regular: 1500, offer: 700, badge: 'MEGA DEAL', freeDelivery: true }
  ]);

  const [images, setImages] = useState<string[]>(combo?.images || []);
  const [items, setItems] = useState<{ product_id: string; quantity: number; name?: string; price: number; unit_type: 'packet' | 'piece' }[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [imageInput, setImageInput] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (!error && data) setAllProducts(data);
    };
    fetchProducts();

    if (combo?.id) {
      supabase.from('combo_items').select('*, products(*)').eq('combo_id', combo.id).then(({ data }) => {
        setItems((data || []).map((it: any) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_type: it.unit_type === 'packet' ? 'packet' : 'piece',
          name: it.products?.name_bn || it.products?.name_en || 'প্রোডাক্ট',
          price: it.products?.regular_price || it.products?.sale_price || 0
        })));
      });
    }
  }, [combo]);

  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    if (total > 0) setForm((prev) => ({ ...prev, regular_total: total }));
  }, [items]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const processed = await processLocalImage(file, { maxWidth: 1200, maxHeight: 1200 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      setImages([...images, url]);
      toast('ছবি প্রসেস ও ওয়াটারমার্কসহ আপলোড হয়েছে');
    } catch (err: any) {
      toast(`আপলোড ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const importFromUrl = async () => {
    if (!imageInput.trim()) return;
    setUploading(true);
    try {
      const processed = await processUrlImage(imageInput.trim(), { maxWidth: 1200, maxHeight: 1200 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      setImages([...images, url]);
      setImageInput('');
      toast('ছবি ইম্পোর্ট ও ওয়াটারমার্ক হয়েছে');
    } catch (err: any) {
      toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const addProduct = (p: any) => {
    if (items.find((it) => it.product_id === p.id)) return;
    setItems([...items, { product_id: p.id, quantity: 1, unit_type: 'piece', name: p.name_bn || p.name_en || 'প্রোডাক্ট', price: p.regular_price || p.sale_price || 0 }]);
    setSearch('');
  };

  const updateQty = (idx: number, qty: number) => setItems(items.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, qty) } : it));
  const updateUnitType = (idx: number, unit_type: 'packet' | 'piece') => setItems(items.map((it, i) => i === idx ? { ...it, unit_type } : it));
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const updateTier = (index: number, field: string, value: any) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const addTier = () => setTiers([...tiers, { qty: tiers.length + 1, regular: 0, offer: 0, badge: '', freeDelivery: true }]);
  const removeTier = (index: number) => setTiers(tiers.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseSlug = form.slug || form.title_bn?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'combo';
    const slug = combo ? baseSlug : `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    
    onSave({ ...form, slug, images, items, tier_pricing: tiers, manual_items_list: manualItems });
  };

  const filteredProducts = allProducts.filter((p) => {
    const nameBn = p.name_bn || '';
    const nameEn = p.name_en || '';
    const query = search.toLowerCase();
    return (nameBn.toLowerCase().includes(query) || nameEn.toLowerCase().includes(query)) && !items.find((it) => it.product_id === p.id);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-background p-6 shadow-2xl border border-border">
        
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h3 className="text-xl font-bold">{combo ? 'কম্বো প্যাক এডিট করুন' : 'নতুন কম্বো প্যাক তৈরি করুন'}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">কম্বো নাম (বাংলা) *</label>
              <input value={form.title_bn} onChange={(e) => setForm({ ...form, title_bn: e.target.value })} className="input-bangla border p-3 w-full rounded-xl bg-secondary/30" placeholder="যেমন: স্পেশাল বীজ কম্বো" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Slug (ইউআরএল)</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-bangla border p-3 w-full rounded-xl bg-secondary/30" placeholder="auto-generated" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">কম্বো প্যাকেজ বিবরণ (Description)</label>
            <textarea value={form.description_bn} onChange={(e) => setForm({ ...form, description_bn: e.target.value })} rows={3} className="input-bangla border p-3 w-full rounded-xl bg-secondary/30" placeholder="বিবরণ লিখুন..." />
          </div>

          <div className="rounded-2xl border p-4 bg-secondary/10">
            <label className="mb-2 block text-sm font-semibold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> প্যাকেজ ছবি (ওয়াটারমার্ক সহ)</label>
            <div className="flex gap-2 mb-3">
              <input value={imageInput} onChange={(e) => setImageInput(e.target.value)} className="input-bangla border p-2.5 flex-1 rounded-xl bg-background" placeholder="Image URL দিন" />
              <button type="button" onClick={importFromUrl} disabled={uploading} className="rounded-xl bg-secondary px-4 font-semibold flex items-center gap-1 disabled:opacity-50">
                <LinkIcon className="h-4 w-4" /> ইম্পোর্ট
              </button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-dashed border-border p-3 text-xs font-semibold w-full justify-center bg-background">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploading ? 'প্রসেস হচ্ছে...' : 'ছবি আপলোড করুন'}</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
            </label>
            {images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img src={img} alt="" className="h-16 w-16 rounded-xl object-cover border" />
                    <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-secondary/20 p-4 border">
            <h4 className="mb-2 font-semibold text-sm">অপশন ১: প্রোডাক্ট লিস্ট থেকে সিলেক্ট করুন</h4>
            <div className="space-y-2 mb-3">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-xl bg-background p-3 border space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{it.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">পণ্যের মূল্য: <span className="font-semibold text-foreground">৳{it.price}</span></div>
                    </div>
                    <input type="number" value={it.quantity} onChange={(e) => updateQty(idx, Number(e.target.value))} className="w-16 rounded-lg border px-2 py-1.5 text-sm text-center bg-secondary/30" min={1} />
                    <button type="button" onClick={() => removeItem(idx)} className="text-destructive p-1.5"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">একক:</span>
                    <div className="flex rounded-lg border overflow-hidden">
                      <label className={`cursor-pointer px-3 py-1.5 text-xs font-semibold ${it.unit_type === 'packet' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'}`}>
                        <input type="radio" name={`unit-${idx}`} value="packet" checked={it.unit_type === 'packet'} onChange={() => updateUnitType(idx, 'packet')} className="sr-only" />
                        প্যাকেট
                      </label>
                      <label className={`cursor-pointer px-3 py-1.5 text-xs font-semibold border-l ${it.unit_type === 'piece' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'}`}>
                        <input type="radio" name={`unit-${idx}`} value="piece" checked={it.unit_type === 'piece'} onChange={() => updateUnitType(idx, 'piece')} className="sr-only" />
                        পিস
                      </label>
                    </div>
                    <span className="text-xs text-muted-foreground">{it.quantity} {it.unit_type === 'packet' ? 'প্যাকেট' : 'পিস'}</span>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">কোনো প্রোডাক্ট সিলেক্ট করা হয়নি</p>}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="প্রোডাক্ট সার্চ করুন..." className="input-bangla pl-9 border p-3 w-full rounded-xl bg-background" />
              {search && (
                <div className="absolute z-30 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border bg-background shadow-xl">
                  {filteredProducts.map((p) => (
                    <button key={p.id} type="button" onClick={() => addProduct(p)} className="block w-full border-b px-3.5 py-2.5 text-left text-sm hover:bg-secondary">
                      {p.name_bn || p.name_en} — ৳{p.regular_price || p.sale_price || 0}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-secondary/20 p-4 border space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-1.5"><FileText className="h-4 w-4" /> অপশন ২: ম্যানুয়াল লিস্ট (বক্স আকারে)</h4>
              <button type="button" onClick={addManualRow} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> নতুন আইটেম যোগ করুন
              </button>
            </div>

            <div className="space-y-2">
              {manualItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-background p-2.5 border rounded-xl shadow-sm">
                  <input type="text" value={item.name} onChange={(e) => updateManualRow(idx, 'name', e.target.value)} placeholder="বীজের নাম (যেমন: তরমুজ বীজ)" className="flex-1 border rounded-lg p-2 text-sm bg-secondary/30 input-bangla" />
                  <input type="text" value={item.qty} onChange={(e) => updateManualRow(idx, 'qty', e.target.value)} placeholder="পরিমাণ (যেমন: ১০ পিস)" className="w-32 border rounded-lg p-2 text-sm bg-secondary/30 input-bangla" />
                  {manualItems.length > 1 && <button type="button" onClick={() => removeManualRow(idx)} className="text-destructive p-1.5 hover:bg-destructive/10 rounded-lg"><X className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4 bg-secondary/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm">পরিমাণ অনুযায়ী অফার মূল্য (Tier Pricing)</h4>
              <button type="button" onClick={addTier} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> পরিমাণ যোগ করুন</button>
            </div>
            <div className="space-y-3">
              {tiers.map((tier, idx) => (
                <div key={idx} className="bg-background border rounded-2xl p-3 space-y-2 relative shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1"><span className="text-xs font-bold text-muted-foreground">পরিমাণ:</span><input type="number" value={tier.qty} onChange={(e) => updateTier(idx, 'qty', Number(e.target.value))} className="w-16 border rounded-lg p-1 text-center font-bold text-sm bg-secondary/30" min={1} /></div>
                    {tiers.length > 1 && <button type="button" onClick={() => removeTier(idx)} className="text-destructive p-1 hover:bg-destructive/10 rounded-lg"><X className="h-4 w-4" /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[11px] font-semibold text-muted-foreground block mb-0.5">সাধারণ মূল্য (৳)</label><input type="number" value={tier.regular} onChange={(e) => updateTier(idx, 'regular', Number(e.target.value))} className="w-full border rounded-lg p-2 text-sm bg-secondary/30" /></div>
                    <div><label className="text-[11px] font-semibold text-muted-foreground block mb-0.5">অফার মূল্য (৳)</label><input type="number" value={tier.offer} onChange={(e) => updateTier(idx, 'offer', Number(e.target.value))} className="w-full border rounded-lg p-2 text-sm bg-secondary/30 font-bold text-primary" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center pt-1">
                    <div><label className="text-[11px] font-semibold text-muted-foreground block mb-0.5">ব্যাজ (যেমন: BEST)</label><input type="text" value={tier.badge} onChange={(e) => updateTier(idx, 'badge', e.target.value)} placeholder="BEST / POPULAR" className="w-full border rounded-lg p-1.5 text-xs bg-secondary/30" /></div>
                    <div className="flex items-center pt-5"><label className="flex items-center gap-2 text-xs font-semibold cursor-pointer"><input type="checkbox" checked={tier.freeDelivery} onChange={(e) => updateTier(idx, 'freeDelivery', e.target.checked)} className="rounded h-4 w-4 text-primary" /> Free Delivery</label></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2"><label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded h-4 w-4 text-primary" /> ওয়েবসাইটে সক্রিয় রাখুন</label></div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg">{combo ? 'আপডেট করুন' : 'তৈরি করুন'}</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-6 py-3 hover:bg-secondary font-semibold">বাতিল</button>
          </div>
        </form>
      </div>
    </div>
  );
}