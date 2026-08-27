'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, X, Search, Gift, Calendar } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminPromotionsPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => { loadPromos(); }, []);

  const loadPromos = async () => {
    const { data } = await supabase.from('promotions').select('*, promotion_gifts(*)').order('created_at', { ascending: false });
    setPromos(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    const { gift_product_ids, ...payload } = formData;
    let promoId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('promotions').update(payload).eq('id', editing.id);
      if (error) { toast('আপডেট ব্যর্থ', 'error'); return; }
      await supabase.from('promotion_gifts').delete().eq('promotion_id', editing.id);
    } else {
      const { data: newPromo, error } = await supabase.from('promotions').insert(payload).select('id').single();
      if (error) { toast('যোগ করা ব্যর্থ', 'error'); return; }
      promoId = newPromo?.id;
    }

    if (promoId && gift_product_ids?.length > 0) {
      await supabase.from('promotion_gifts').insert(gift_product_ids.map((id: string) => ({ promotion_id: promoId, product_id: id })));
    }

    toast(editing ? 'প্রমোশন আপডেট হয়েছে' : 'প্রমোশন তৈরি হয়েছে');
    setShowForm(false);
    setEditing(null);
    loadPromos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('মুছতে চান?')) return;
    await supabase.from('promotions').delete().eq('id', id);
    toast('প্রমোশন মুছে ফেলা হয়েছে');
    loadPromos();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Gift className="h-6 w-6" /> ফ্রি গিফট প্রমোশন</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-5 w-5" /> নতুন প্রমোশন
        </button>
      </div>

      <div className="space-y-3">
        {promos.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold">{p.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {p.min_quantity > 0 && <span>ন্যূনতম {p.min_quantity} টি · </span>}
                  {p.min_amount > 0 && <span>ন্যূনতম ৳{p.min_amount} · </span>}
                  <span>মোড: {p.gift_mode === 'automatic' ? 'অটোমেটিক' : 'কাস্টমার বাছাই'}</span>
                  {p.start_date && <span> · শুরু: {new Date(p.start_date).toLocaleDateString('bn-BD')}</span>}
                  {p.end_date && <span> · শেষ: {new Date(p.end_date).toLocaleDateString('bn-BD')}</span>}
                </div>
                <p className="mt-1 text-sm">গিফট প্রোডাক্ট: {p.promotion_gifts?.length || 0} টি</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-lg p-2 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(p.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {promos.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন প্রমোশন নেই</p>}
      </div>

      {showForm && <PromoForm promo={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function PromoForm({ promo, onSave, onClose }: { promo: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: promo?.name || '',
    is_active: promo?.is_active ?? true,
    min_quantity: promo?.min_quantity || 0,
    min_amount: promo?.min_amount || 0,
    eligibility: promo?.eligibility || 'all',
    gift_mode: promo?.gift_mode || 'automatic',
    free_quantity: promo?.free_quantity || 1,
    start_date: promo?.start_date?.split('T')[0] || '',
    end_date: promo?.end_date?.split('T')[0] || '',
    usage_limit: promo?.usage_limit || '',
    one_per_order: promo?.one_per_order ?? true,
    can_combine: promo?.can_combine ?? true,
  });
  const [giftProductIds, setGiftProductIds] = useState<string[]>([]);
  const [eligibleProductIds, setEligibleProductIds] = useState<string[]>([]);
  const [eligibleCategoryIds, setEligibleCategoryIds] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('products').select('id, name_bn, name_en').eq('is_active', true).eq('is_ads_only', false).order('name_bn').then(({ data }) => setAllProducts(data || []));
    supabase.from('categories').select('id, name_en').eq('is_active', true).order('name_en').then(({ data }) => setAllCategories(data || []));
    if (promo?.id) {
      supabase.from('promotion_gifts').select('product_id').eq('promotion_id', promo.id).then(({ data }) => setGiftProductIds((data || []).map((g: any) => g.product_id)));
      setEligibleProductIds(promo.eligible_product_ids || []);
      setEligibleCategoryIds(promo.eligible_category_ids || []);
    }
  }, [promo]);

  const toggleGift = (id: string) => setGiftProductIds(giftProductIds.includes(id) ? giftProductIds.filter((x) => x !== id) : [...giftProductIds, id]);
  const toggleEligibleProduct = (id: string) => setEligibleProductIds(eligibleProductIds.includes(id) ? eligibleProductIds.filter((x) => x !== id) : [...eligibleProductIds, id]);
  const toggleEligibleCategory = (id: string) => setEligibleCategoryIds(eligibleCategoryIds.includes(id) ? eligibleCategoryIds.filter((x) => x !== id) : [...eligibleCategoryIds, id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (giftProductIds.length === 0) { toast('গিফট প্রোডাক্ট নির্বাচন করুন', 'error'); return; }
    onSave({
      ...form,
      min_quantity: Number(form.min_quantity),
      min_amount: Number(form.min_amount),
      free_quantity: Number(form.free_quantity),
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      eligible_product_ids: form.eligibility === 'selected_products' ? eligibleProductIds : [],
      eligible_category_ids: form.eligibility === 'selected_categories' ? eligibleCategoryIds : [],
      gift_product_ids: giftProductIds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{promo ? 'প্রমোশন এডিট' : 'নতুন প্রমোশন'}</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">প্রমোশন নাম *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-bangla" required /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-medium">ন্যূনতম ক্রয় সংখ্যা</label><input type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: Number(e.target.value) })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">ন্যূনতম অর্ডার মূল্য (ঐচ্ছিক)</label><input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: Number(e.target.value) })} className="input-bangla" /></div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">যোগ্যতা</label>
            <select value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} className="input-bangla">
              <option value="all">সব প্রোডাক্ট</option>
              <option value="selected_products">নির্দিষ্ট প্রোডাক্ট</option>
              <option value="selected_categories">নির্দিষ্ট ক্যাটাগরি</option>
            </select>
          </div>

          {form.eligibility === 'selected_products' && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
              {allProducts.map((p) => (
                <label key={p.id} className="flex items-center gap-2 p-1 text-sm">
                  <input type="checkbox" checked={eligibleProductIds.includes(p.id)} onChange={() => toggleEligibleProduct(p.id)} /> {p.name_bn || p.name_en}
                </label>
              ))}
            </div>
          )}
          {form.eligibility === 'selected_categories' && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
              {allCategories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 p-1 text-sm">
                  <input type="checkbox" checked={eligibleCategoryIds.includes(c.id)} onChange={() => toggleEligibleCategory(c.id)} /> {c.name_en}
                </label>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">গিফট মোড</label>
            <select value={form.gift_mode} onChange={(e) => setForm({ ...form, gift_mode: e.target.value })} className="input-bangla">
              <option value="automatic">অটোমেটিক (কাস্টমার স্বয়ংক্রিয় পাবে)</option>
              <option value="choose">কাস্টমার বেছে নেবে</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">গিফট প্রোডাক্ট *</label>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="খুঁজুন..." className="input-bangla pl-8" />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
              {allProducts.filter((p) => p.name_bn?.toLowerCase().includes(search.toLowerCase())).map((p) => (
                <label key={p.id} className="flex items-center gap-2 p-1 text-sm">
                  <input type="checkbox" checked={giftProductIds.includes(p.id)} onChange={() => toggleGift(p.id)} /> {p.name_bn || p.name_en}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{giftProductIds.length} টি নির্বাচিত</p>
          </div>

          <div><label className="mb-1 block text-sm font-medium">ফ্রি কোয়ান্টিটি</label><input type="number" value={form.free_quantity} onChange={(e) => setForm({ ...form, free_quantity: Number(e.target.value) })} className="input-bangla" min={1} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-medium">শুরু তারিখ</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">শেষ তারিখ</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input-bangla" /></div>
          </div>

          <div><label className="mb-1 block text-sm font-medium">ব্যবহার সীমা (ঐচ্ছিক)</label><input type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} className="input-bangla" placeholder="খালি = সীমাহীন" /></div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.one_per_order} onChange={(e) => setForm({ ...form, one_per_order: e.target.checked })} /> প্রতি অর্ডারে একটি</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.can_combine} onChange={(e) => setForm({ ...form, can_combine: e.target.checked })} /> অন্যান্য প্রমোশনের সাথে যুক্ত</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> সক্রিয়</label>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">{promo ? 'আপডেট' : 'তৈরি করুন'}</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-6 hover:bg-secondary">বাতিল</button>
          </div>
        </form>
      </div>
    </div>
  );
}
