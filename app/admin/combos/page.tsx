'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { MultilingualFields } from '@/components/admin/multilingual-fields';
import { Plus, Edit, Trash2, X, Search, Upload, Loader2, Image as ImageIcon, FileText, Link as LinkIcon } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';
import { usePathname } from 'next/navigation';

function getAdminProductImage(product: any): string {
  const candidates = [
    product?.image_url,
    product?.featured_image,
    product?.primary_image,
    product?.image,
    ...(Array.isArray(product?.images) ? product.images : []),
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim() && !value.includes('placehold.co'))?.trim() || '';
}

const MANUAL_ITEM_LANGUAGES = [
  { key: 'bn', label: 'বাংলা', namePlaceholder: 'বীজের নাম', qtyPlaceholder: 'পরিমাণ' },
  { key: 'en', label: 'English', namePlaceholder: 'Seed name', qtyPlaceholder: 'Quantity' },
  { key: 'hi', label: 'हिन्दी', namePlaceholder: 'बीज का नाम', qtyPlaceholder: 'मात्रा' },
] as const;

function readManualItems(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split('\n').map((line) => line.trim()).filter(Boolean).map((name) => ({ name, qty: '' }));
  }
}

function normalizeManualItem(item: any) {
  const translations = item?.translations || {};
  const legacyName = item?.name || item?.name_bn || '';
  const legacyQty = item?.qty || item?.quantity || '';
  return {
    image_url: item?.image_url || item?.image || '',
    translations: {
      bn: { name: translations.bn?.name || legacyName, qty: translations.bn?.qty || legacyQty },
      en: { name: translations.en?.name || item?.name_en || '', qty: translations.en?.qty || item?.qty_en || '' },
      hi: { name: translations.hi?.name || item?.name_hi || '', qty: translations.hi?.qty || item?.qty_hi || '' },
    },
  };
}

export default function AdminComboPacksPage() {
  const pathname = usePathname();
  const isSeedLanding = pathname === '/admin/seed-combo-landing';
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [adminBranch, setAdminBranch] = useState<'BD' | 'IN'>('BD');

  const currencySymbol = adminBranch === 'IN' ? '₹' : '৳';

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.rpc('current_admin_country');
      const branch = String(data || '').toUpperCase();
      if (error || !['BD', 'IN'].includes(branch)) { toast('ব্রাঞ্চ তথ্য যাচাই করা যায়নি', 'error'); setLoading(false); return; }
      setAdminBranch(branch as 'BD' | 'IN');
      await loadCombos(branch as 'BD' | 'IN');
    };
    init();
    const handleBranchChange = () => { setShowForm(false); setEditing(null); init(); };
    window.addEventListener('gazi-branch-change', handleBranchChange);
    return () => window.removeEventListener('gazi-branch-change', handleBranchChange);
  }, [isSeedLanding]);

  const loadCombos = async (branch: 'BD' | 'IN' = adminBranch) => {
    const { data, error } = await supabase.from('combo_packs').select('*').eq('country_code', branch).eq('landing_type', isSeedLanding ? 'seed_landing' : 'combo');
    if (error) { toast('কম্বো লোড ব্যর্থ: ' + error.message, 'error'); setCombos([]); }
    else setCombos(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    const { items, ...rawPayload } = formData;
    
    const payload = {
      title_bn: rawPayload.title_bn,
      slug: rawPayload.slug,
      description_bn: rawPayload.description_bn,
      translations: rawPayload.translations || {},
      title_en: rawPayload.translations?.en?.title || rawPayload.title_bn,
      description_en: rawPayload.translations?.en?.description || rawPayload.description_bn,
      seo_title: rawPayload.translations?.en?.seo_title || null,
      meta_description: rawPayload.translations?.en?.meta_description || null,
      regular_total: Number(rawPayload.regular_total) || 0,
      combo_price: Number(rawPayload.combo_price) || 0,
      tier_pricing: rawPayload.tier_pricing || [],
      manual_items_list: JSON.stringify((rawPayload.manual_items_list || []).map((item: any) => ({
        ...item,
        name: item.translations?.bn?.name || item.name || '',
        qty: item.translations?.bn?.qty || item.qty || '',
      }))),
      is_active: rawPayload.is_active,
      is_featured: rawPayload.is_featured === true,
      is_best_seller: rawPayload.is_best_seller === true,
      is_new_arrival: rawPayload.is_new_arrival === true,
      is_seasonal: rawPayload.is_seasonal === true,
      images: rawPayload.images || [],
      landing_type: isSeedLanding ? 'seed_landing' : 'combo',
      country_code: adminBranch,
    };

    let comboId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('combo_packs').update(payload).eq('id', editing.id).eq('country_code', adminBranch);
      if (error) { toast('আপডেট ব্যর্থ: ' + error.message, 'error'); return; }
      await supabase.from('combo_items').delete().eq('combo_id', editing.id).eq('country_code', adminBranch);
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
          country_code: adminBranch,
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
    const { error } = await supabase.from('combo_packs').delete().eq('id', id).eq('country_code', adminBranch);
    if (error) { toast('কম্বো মুছতে ব্যর্থ: ' + error.message, 'error'); return; }
    toast('কম্বো মুছে ফেলা হয়েছে');
    loadCombos();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isSeedLanding ? 'Seed Combo Landing' : 'কম্বো প্যাক'}</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-5 w-5" /> {isSeedLanding ? 'নতুন Seed Combo Landing' : 'নতুন কম্বো'}
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
                  {regularPrice > 0 && <span className="text-sm text-muted-foreground line-through">{currencySymbol}{regularPrice}</span>}
                  <span className="text-xl font-bold text-primary">{currencySymbol}{offerPrice}</span>
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
        {combos.length === 0 && <p className="col-span-full p-8 text-center text-muted-foreground">{isSeedLanding ? 'এখনো কোনো Seed Combo Landing তৈরি করা হয়নি' : 'কোন কম্বো প্যাক নেই'}</p>}
      </div>

      {showForm && <ComboForm combo={editing} countryCode={adminBranch} isSeedLanding={isSeedLanding} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function ComboForm({ combo, countryCode, isSeedLanding, onSave, onClose }: { combo: any; countryCode: 'BD' | 'IN'; isSeedLanding: boolean; onSave: (data: any) => void; onClose: () => void }) {
  const currencySymbol = countryCode === 'IN' ? '₹' : '৳';
  const [form, setForm] = useState({
    country_code: combo?.country_code || countryCode,
    title_bn: combo?.title_bn || '',
    slug: combo?.slug || '',
    description_bn: combo?.description_bn || '',
    regular_total: combo?.regular_total || 0,
    combo_price: combo?.combo_price || 0,
    is_active: combo?.is_active ?? true,
    translations: combo?.translations || {},
    is_featured: combo?.is_featured ?? false,
    is_best_seller: combo?.is_best_seller ?? false,
    is_new_arrival: combo?.is_new_arrival ?? false,
    is_seasonal: combo?.is_seasonal ?? false,
  });

  const [manualItems, setManualItems] = useState<any[]>(() => {
    const saved = readManualItems(combo?.manual_items_list).map(normalizeManualItem);
    return saved.length > 0 ? saved : [normalizeManualItem({})];
  });

  const addManualRow = () => setManualItems([...manualItems, normalizeManualItem({})]);
  const removeManualRow = (index: number) => setManualItems(manualItems.filter((_, i) => i !== index));
  const updateManualTranslation = (index: number, language: 'bn' | 'en' | 'hi', field: 'name' | 'qty', value: string) => {
    setManualItems((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, translations: { ...item.translations, [language]: { ...item.translations?.[language], [field]: value } } }
      : item));
  };
  const updateManualImage = (index: number, value: string) => {
    setManualItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, image_url: value } : item));
  };
  const [manualImageUploading, setManualImageUploading] = useState<number | null>(null);

  const [tiers, setTiers] = useState<any[]>(combo?.tier_pricing || [
    { qty: 1, regular: 500, offer: 300, badge: 'BEST', freeDelivery: true },
    { qty: 2, regular: 1000, offer: 500, badge: 'POPULAR', freeDelivery: true },
    { qty: 3, regular: 1500, offer: 700, badge: 'MEGA DEAL', freeDelivery: true }
  ]);

  const [images, setImages] = useState<string[]>(combo?.images || []);
  const [items, setItems] = useState<{ product_id: string; quantity: number; name?: string; image?: string; price: number; unit_type: 'packet' | 'piece' }[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [imageInput, setImageInput] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*').eq('country_code', countryCode);
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
          image: getAdminProductImage(it.products),
          price: it.products?.regular_price || it.products?.sale_price || 0
        })));
      });
    }
  }, [combo, countryCode]);

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

  const handleManualImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setManualImageUploading(index);
    try {
      const processed = await processLocalImage(file, { maxWidth: 800, maxHeight: 800 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      updateManualImage(index, url);
      toast('আইটেমের ছোট ছবি আপলোড হয়েছে');
    } catch (err: any) {
      toast(`ছবি আপলোড ব্যর্থ: ${err.message}`, 'error');
    } finally {
      setManualImageUploading(null);
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
    setItems([...items, { product_id: p.id, quantity: 1, unit_type: 'piece', name: p.name_bn || p.name_en || 'প্রোডাক্ট', image: getAdminProductImage(p), price: p.regular_price || p.sale_price || 0 }]);
    setSearch('');
  };

  const updateQty = (idx: number, qty: number) => setItems(items.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, qty) } : it));
  const updateUnitType = (idx: number, unit_type: 'packet' | 'piece') => setItems(items.map((it, i) => i === idx ? { ...it, unit_type } : it));
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const setMainImage = (index: number) => setImages((current) => [current[index], ...current.filter((_, imageIndex) => imageIndex !== index)]);

  const updateTier = (index: number, field: string, value: any) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const addTier = () => setTiers([...tiers, { qty: tiers.length + 1, regular: 0, offer: 0, badge: '', freeDelivery: true }]);
  const removeTier = (index: number) => setTiers(tiers.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Published combinations must have language-specific copy; do not silently
    // publish untranslated future combos.
    if (form.is_active && (['en', 'bn', 'hi'] as const).some((locale) =>
      !form.translations?.[locale]?.title?.trim() ||
      !form.translations?.[locale]?.description?.trim()
    )) {
      toast('লাইভ করার আগে English, বাংলা ও हिन्दी Title এবং Description পূরণ করুন', 'error');
      return;
    }
    const baseSlug = form.slug || form.title_bn?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'combo';
    const slug = combo ? baseSlug : `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    
    onSave({ ...form, translations: form.translations || {}, slug, images, items, tier_pricing: tiers, manual_items_list: manualItems });
  };

  const filteredProducts = allProducts.filter((p) => {
    const nameBn = p.name_bn || '';
    const nameEn = p.name_en || '';
    const query = search.toLowerCase();
    return (nameBn.toLowerCase().includes(query) || nameEn.toLowerCase().includes(query)) && !items.find((it) => it.product_id === p.id);
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-background shadow-2xl border border-border">
        
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-border bg-background p-6">
          <h3 className="text-xl font-bold">{isSeedLanding ? (combo ? 'Seed Combo Landing সম্পাদনা' : 'নতুন Seed Combo Landing তৈরি করুন') : (combo ? 'কম্বো প্যাক এডিট করুন' : 'নতুন কম্বো প্যাক তৈরি করুন')}</h3>
          <button aria-label="Close combo form" onClick={onClose} className="shrink-0 rounded-full p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <form id="admin-combo-form" onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">মূল কম্বো নাম (বাংলা) *</label>
              <input value={form.title_bn} onChange={(e) => setForm({ ...form, title_bn: e.target.value })} className="input-bangla border p-3 w-full rounded-xl bg-secondary/30" placeholder="যেমন: স্পেশাল বীজ কম্বো" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Slug (ইউআরএল)</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-bangla border p-3 w-full rounded-xl bg-secondary/30" placeholder="auto-generated" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">মূল বাংলা নাম ও বিবরণ কম্বোর পরিচিতি। লাইভ করতে নিচের English, বাংলা ও हिन्दी tab-এ Title ও Description পূরণ করুন। SEO প্রতিটি ভাষার tab-এ লিখুন।</p>
          <MultilingualFields value={form.translations || {}} onChange={(translations) => setForm({ ...form, translations })} title="🌐 ভাষাভিত্তিক কম্বো নাম ও বিবরণ" fields={[{ key: 'title', label: 'Combo Title' }, { key: 'subtitle', label: 'Subtitle' }, { key: 'description', label: 'Description', multiline: true }, { key: 'seo_title', label: 'SEO Title' }, { key: 'meta_description', label: 'Meta Description', multiline: true }]} />

          <div>
            <label className="mb-1.5 block text-sm font-semibold">মূল কম্বো বিবরণ (বাংলা)</label>
            <textarea value={form.description_bn} onChange={(e) => setForm({ ...form, description_bn: e.target.value })} rows={3} className="input-bangla border p-3 w-full rounded-xl bg-secondary/30" placeholder="বিবরণ লিখুন..." />
          </div>

          <div className="rounded-2xl border p-4 bg-secondary/10">
            <label className="mb-2 block text-sm font-semibold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> প্রধান প্যাকেজ ছবি ও গ্যালারি (ওয়াটারমার্ক সহ)</label>
            <p className="mb-3 text-xs leading-5 text-muted-foreground">প্রথম ছবিটি landing page-এ বড় প্রধান ছবি হবে। অন্য ছবিতে “প্রধান করুন” চাপলে সেটি সামনে যাবে। ম্যানুয়াল লিস্টের প্রতিটি বীজের ছোট ছবিও আলাদাভাবে যোগ করতে পারবেন।</p>
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
                  <div key={`${img}-${idx}`} className="relative flex flex-col items-center gap-1.5">
                    <img src={img} alt={idx === 0 ? 'প্রধান প্যাকেজ ছবি' : 'প্যাকেজ গ্যালারি ছবি'} className={`h-16 w-16 rounded-xl object-cover border ${idx === 0 ? 'ring-2 ring-primary ring-offset-2' : ''}`} />
                    {idx === 0 ? <span className="text-[10px] font-bold text-primary">প্রধান</span> : <button type="button" onClick={() => setMainImage(idx)} className="text-[10px] font-semibold text-primary underline underline-offset-2">প্রধান করুন</button>}
                    <button type="button" aria-label="ছবি মুছুন" onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
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
                    {it.image && <img src={it.image} alt="" className="h-12 w-12 shrink-0 rounded-lg border bg-white object-contain p-1" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{it.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">পণ্যের মূল্য: <span className="font-semibold text-foreground">{currencySymbol}{it.price}</span></div>
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
                      {p.name_bn || p.name_en} — {currencySymbol}{p.regular_price || p.sale_price || 0}
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

            <p className="mb-2 text-xs text-muted-foreground">প্রতিটি আইটেমের নাম ও পরিমাণ বাংলা, English ও हिन्दी-তে লিখুন। যেকোনো ভাষার ছোট ছবি একই থাকবে।</p>
            <div className="space-y-3">
              {manualItems.map((item, idx) => (
                <div key={idx} className="rounded-xl bg-background p-3 border shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted-foreground">আইটেম {idx + 1} — নাম ও পরিমাণ</span>
                    {manualItems.length > 1 && <button type="button" aria-label="আইটেম মুছুন" onClick={() => removeManualRow(idx)} className="text-destructive p-1.5 hover:bg-destructive/10 rounded-lg"><X className="h-4 w-4" /></button>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {MANUAL_ITEM_LANGUAGES.map((language) => (
                      <div key={language.key} className="rounded-lg border bg-secondary/10 p-2">
                        <span className="mb-1.5 block text-[11px] font-bold">{language.label}</span>
                        <input type="text" value={item.translations?.[language.key]?.name || ''} onChange={(e) => updateManualTranslation(idx, language.key, 'name', e.target.value)} placeholder={language.namePlaceholder} aria-label={`${language.label} manual item name`} className="mb-1.5 w-full min-w-0 rounded-lg border bg-background p-2 text-sm input-bangla" />
                        <input type="text" value={item.translations?.[language.key]?.qty || ''} onChange={(e) => updateManualTranslation(idx, language.key, 'qty', e.target.value)} placeholder={language.qtyPlaceholder} aria-label={`${language.label} manual item quantity`} className="w-full min-w-0 rounded-lg border bg-background p-2 text-sm input-bangla" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.image_url && <img src={item.image_url} alt={item.name || 'বীজের ছোট ছবি'} className="h-12 w-12 rounded-lg border bg-white object-contain p-1" />}
                    <input type="url" value={item.image_url || ''} onChange={(e) => updateManualImage(idx, e.target.value)} placeholder="এই বীজের ছবির URL (ঐচ্ছিক)" aria-label="Manual item image URL" className="min-w-[180px] flex-1 border rounded-lg p-2 text-xs bg-secondary/30" />
                    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-secondary ${manualImageUploading === idx ? 'pointer-events-none opacity-50' : ''}`}>
                      {manualImageUploading === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {manualImageUploading === idx ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড'}
                      <input type="file" accept="image/*" onChange={(e) => handleManualImageUpload(idx, e)} className="hidden" disabled={manualImageUploading !== null} />
                    </label>
                    {item.image_url && <button type="button" onClick={() => updateManualImage(idx, '')} className="text-xs text-destructive underline">ছবি সরান</button>}
                  </div>
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
                    <div><label className="text-[11px] font-semibold text-muted-foreground block mb-0.5">সাধারণ মূল্য ({currencySymbol})</label><input type="number" value={tier.regular} onChange={(e) => updateTier(idx, 'regular', Number(e.target.value))} className="w-full border rounded-lg p-2 text-sm bg-secondary/30" /></div>
                    <div><label className="text-[11px] font-semibold text-muted-foreground block mb-0.5">অফার মূল্য ({currencySymbol})</label><input type="number" value={tier.offer} onChange={(e) => updateTier(idx, 'offer', Number(e.target.value))} className="w-full border rounded-lg p-2 text-sm bg-secondary/30 font-bold text-primary" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center pt-1">
                    <div><label className="text-[11px] font-semibold text-muted-foreground block mb-0.5">ব্যাজ (যেমন: BEST)</label><input type="text" value={tier.badge} onChange={(e) => updateTier(idx, 'badge', e.target.value)} placeholder="BEST / POPULAR" className="w-full border rounded-lg p-1.5 text-xs bg-secondary/30" /></div>
                    <div className="flex items-center pt-5"><label className="flex items-center gap-2 text-xs font-semibold cursor-pointer"><input type="checkbox" checked={tier.freeDelivery} onChange={(e) => updateTier(idx, 'freeDelivery', e.target.checked)} className="rounded h-4 w-4 text-primary" /> Free Delivery</label></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isSeedLanding ? (
            <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
              <h4 className="font-bold text-sm">হোমপেজে দেখানোর অপশন</h4>
              <p className="mt-1 mb-3 text-xs leading-5 text-muted-foreground">সক্রিয় থাকলে landing page খোলা যাবে। Featured, Best Seller, New বা Seasonal বাছলে সেটি হোমপেজের সংশ্লিষ্ট বীজের section-এ দেখাবে।</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { key: 'is_active', label: 'সক্রিয় (Active)', checked: form.is_active },
                  { key: 'is_featured', label: 'ফিচার্ড (Featured)', checked: form.is_featured },
                  { key: 'is_best_seller', label: 'বেস্ট সেলার (Best Seller)', checked: form.is_best_seller },
                  { key: 'is_new_arrival', label: 'নতুন (New)', checked: form.is_new_arrival },
                  { key: 'is_seasonal', label: 'মৌসুমি (Seasonal)', checked: form.is_seasonal },
                ].map((option) => (
                  <label key={option.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-semibold">
                    <input type="checkbox" checked={option.checked} onChange={(e) => setForm({ ...form, [option.key]: e.target.checked })} className="h-4 w-4 rounded accent-primary" />
                    {option.label}
                  </label>
                ))}
              </div>
            </section>
          ) : (
            <div className="flex items-center gap-2 pt-2"><label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded h-4 w-4 text-primary" /> ওয়েবসাইটে সক্রিয় রাখুন</label></div>
          )}

        </form>
          <div className="shrink-0 flex gap-3 border-t border-border bg-background p-6">
            <button type="submit" form="admin-combo-form" className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg">{combo ? 'আপডেট করুন' : 'তৈরি করুন'}</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-6 py-3 hover:bg-secondary font-semibold">বাতিল</button>
          </div>
      </div>
    </div>
  );
}
