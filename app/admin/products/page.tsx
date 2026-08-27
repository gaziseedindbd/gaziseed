'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { Plus, Edit, Trash2, X, Search, Upload, Link as LinkIcon, Star, HelpCircle, ChevronDown } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { MediaUploader } from '@/components/admin/media-uploader';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const [allProducts, setAllProducts] = useState<any[]>([]);

  useEffect(() => { loadProducts(); loadCategories(); loadAllProducts(); }, []);

  const loadAllProducts = async () => {
    const { data } = await supabase.from('products').select('id, name_bn, name_en, slug').eq('is_ads_only', false).order('name_bn');
    setAllProducts(data || []);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_ads_only', false).order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('display_order');
    setCategories(data || []);
  };

  const filtered = products.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name_bn?.toLowerCase().includes(s) || p.name_en?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s);
  });

  const handleSave = async (formData: any) => {
    let productId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('products').update(formData.payload).eq('id', editing.id);
      if (error) { toast('আপডেট ব্যর্থ', 'error'); return; }
      toast('প্রোডাক্ট আপডেট হয়েছে');
    } else {
      const { data: newProduct, error } = await supabase.from('products').insert({ ...formData.payload, is_ads_only: false }).select('id').single();
      if (error) { toast('যোগ করা ব্যর্থ', 'error'); return; }
      productId = newProduct?.id;
      toast('প্রোডাক্ট যোগ করা হয়েছে');
    }
    if (productId && formData.faqs) {
      for (const f of formData.faqs) {
        if (f._new) {
          const { _new, ...rest } = f;
          await supabase.from('product_faqs').insert({ ...rest, product_id: productId });
        } else {
          await supabase.from('product_faqs').update({ question_bn: f.question_bn, answer_bn: f.answer_bn, question_en: f.question_en, answer_en: f.answer_en, display_order: f.display_order, is_active: f.is_active }).eq('id', f.id);
        }
      }
    }
    if (productId && formData.removedFaqs) {
      for (const fid of formData.removedFaqs) {
        await supabase.from('product_faqs').delete().eq('id', fid);
      }
    }
    if (productId && formData.variants) {
      for (const v of formData.variants) {
        if (v._new) {
          const { _new, ...rest } = v;
          await supabase.from('product_variants').insert({ ...rest, product_id: productId });
        } else {
          const { _new, ...rest } = v;
          await supabase.from('product_variants').update(rest).eq('id', v.id);
        }
      }
    }
    if (productId && formData.removedVariants) {
      for (const vid of formData.removedVariants) {
        await supabase.from('product_variants').delete().eq('id', vid);
      }
    }
    if (productId && formData.bulkTiers) {
      for (const b of formData.bulkTiers) {
        const { _new, ...rest } = b;
        if (_new) {
          await supabase.from('bulk_pricing').insert({ ...rest, product_id: productId, variant_id: null });
        } else {
          await supabase.from('bulk_pricing').update({ min_quantity: rest.min_quantity, unit_price: rest.unit_price, is_active: rest.is_active }).eq('id', b.id);
        }
      }
    }
    if (productId && formData.removedBulkTiers) {
      for (const bid of formData.removedBulkTiers) {
        await supabase.from('bulk_pricing').delete().eq('id', bid);
      }
    }
    setShowForm(false);
    setEditing(null);
    loadProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('প্রোডাক্ট মুছে ফেলতে চান?')) return;
    await supabase.from('products').delete().eq('id', id);
    toast('প্রোডাক্ট মুছে ফেলা হয়েছে');
    loadProducts();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">প্রোডাক্ট</h1>
          <p className="text-sm text-muted-foreground">সাধারণ ওয়েবসাইট প্রোডাক্ট ম্যানেজমেন্ট</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> নতুন প্রোডাক্ট
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন..." className="input-bangla pl-10" />
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-secondary" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">নাম</th>
                <th className="p-3">SKU</th>
                <th className="p-3">দাম</th>
                <th className="p-3">স্টক</th>
                <th className="p-3">স্ট্যাটাস</th>
                <th className="p-3">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="p-3 font-medium">{p.name_bn || p.name_en}</td>
                  <td className="p-3 text-muted-foreground">{p.sku}</td>
                  <td className="p-3 font-bold">{formatPrice(p.sale_price || p.regular_price)}</td>
                  <td className="p-3">
                    <span className={p.stock <= 5 ? 'font-bold text-destructive' : ''}>{p.stock}</span>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {p.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-lg p-1.5 hover:bg-secondary" title="এডিট">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" title="মুছুন">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন প্রোডাক্ট নেই</p>}
        </div>
      )}

      {showForm && (
        <ProductForm product={editing} categories={categories} allProducts={allProducts} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function ProductForm({ product, categories, allProducts, onSave, onClose, onSaved }: { product: any; categories: any[]; allProducts: any[]; onSave: (data: any) => void; onClose: () => void; onSaved?: () => void }) {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [removedFaqs, setRemovedFaqs] = useState<string[]>([]);
  const [faqForm, setFaqForm] = useState({ question_bn: '', answer_bn: '', question_en: '', answer_en: '', display_order: 0, is_active: true });
  const [relatedSearch, setRelatedSearch] = useState('');
  const [showRelatedPicker, setShowRelatedPicker] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);
  const [removedVariants, setRemovedVariants] = useState<string[]>([]);
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', regular_price: '', sale_price: '', stock: '', weight_or_count: '', is_active: true, display_order: 0 });
  const [bulkTiers, setBulkTiers] = useState<any[]>([]);
  const [removedBulkTiers, setRemovedBulkTiers] = useState<string[]>([]);
  const [bulkForm, setBulkForm] = useState({ min_quantity: '', unit_price: '', is_active: true });
  const [showSeasonal, setShowSeasonal] = useState(false);
  const allMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  const allSeasonTags = ['Winter', 'Summer', 'Rainy Season', 'Fast Growing', 'Hybrid', 'Local/Desi'];
  const allGrowingTypes = ['Rooftop', 'Pot/Container', 'Field'];

  useEffect(() => {
    if (product?.id) {
      supabase.from('product_faqs').select('*').eq('product_id', product.id).order('display_order').then(({ data }) => setFaqs(data || []));
      supabase.from('product_variants').select('*').eq('product_id', product.id).order('display_order').then(({ data }) => setVariants(data || []));
      supabase.from('bulk_pricing').select('*').eq('product_id', product.id).is('variant_id', null).eq('is_active', true).order('min_quantity').then(({ data }) => setBulkTiers(data || []));
    }
  }, [product]);

  const addVariant = () => {
    if (!variantForm.name || !variantForm.regular_price) { toast('নাম ও দাম দিন', 'error'); return; }
    const v = { ...variantForm, product_id: product?.id, regular_price: Number(variantForm.regular_price), sale_price: variantForm.sale_price ? Number(variantForm.sale_price) : null, stock: Number(variantForm.stock) || 0, display_order: variants.length, _new: true };
    setVariants([...variants, v]);
    setVariantForm({ name: '', sku: '', regular_price: '', sale_price: '', stock: '', weight_or_count: '', is_active: true, display_order: 0 });
  };
  const removeVariant = (idx: number) => {
    const v = variants[idx];
    if (v.id && !v._new) setRemovedVariants([...removedVariants, v.id]);
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const addBulkTier = () => {
    if (!bulkForm.min_quantity || !bulkForm.unit_price) { toast('পরিমাণ ও দাম দিন', 'error'); return; }
    setBulkTiers([...bulkTiers, { ...bulkForm, min_quantity: Number(bulkForm.min_quantity), unit_price: Number(bulkForm.unit_price), product_id: product?.id, _new: true }]);
    setBulkForm({ min_quantity: '', unit_price: '', is_active: true });
  };
  const removeBulkTier = (idx: number) => {
    const b = bulkTiers[idx];
    if (b.id && !b._new) setRemovedBulkTiers([...removedBulkTiers, b.id]);
    setBulkTiers(bulkTiers.filter((_, i) => i !== idx));
  };

  const toggleMonth = (m: string) => {
    const months = form.suitable_months || [];
    setForm({ ...form, suitable_months: months.includes(m) ? months.filter((x: string) => x !== m) : [...months, m] });
  };
  const toggleSeasonTag = (t: string) => {
    const tags = form.season_tags || [];
    setForm({ ...form, season_tags: tags.includes(t) ? tags.filter((x: string) => x !== t) : [...tags, t] });
  };

  const addFaq = () => {
    if (!faqForm.question_bn || !faqForm.answer_bn) { toast('প্রশ্ন ও উত্তর দিন', 'error'); return; }
    const newFaq = { ...faqForm, product_id: product?.id, _new: true };
    setFaqs([...faqs, newFaq]);
    setFaqForm({ question_bn: '', answer_bn: '', question_en: '', answer_en: '', display_order: faqs.length + 1, is_active: true });
  };

  const removeFaq = (idx: number) => {
    const f = faqs[idx];
    if (f.id && !f._new) setRemovedFaqs([...removedFaqs, f.id]);
    setFaqs(faqs.filter((_, i) => i !== idx));
  };
  const [form, setForm] = useState({
    name_bn: product?.name_bn || '',
    name_en: product?.name_en || '',
    slug: product?.slug || '',
    sku: product?.sku || '',
    category_id: product?.category_id || '',
    short_description: product?.short_description || '',
    description: product?.description || '',
    regular_price: product?.regular_price || 0,
    sale_price: product?.sale_price || '',
    stock: product?.stock || 0,
    low_stock_threshold: product?.low_stock_threshold || 5,
    is_active: product?.is_active ?? true,
    is_featured: product?.is_featured || false,
    is_best_seller: product?.is_best_seller || false,
    is_new_arrival: product?.is_new_arrival || false,
    is_seasonal: product?.is_seasonal || false,
    image: product?.image || '',
    images: product?.images || [],
    seed_type: product?.seed_type || '',
    variety: product?.variety || '',
    brand: product?.brand || '',
    origin: product?.origin || '',
    season: product?.season || '',
    planting_season: product?.planting_season || '',
    germination_time: product?.germination_time || '',
    germination_rate: product?.germination_rate || '',
    harvest_time: product?.harvest_time || '',
    plant_spacing: product?.plant_spacing || '',
    planting_depth: product?.planting_depth || '',
    sunlight: product?.sunlight || '',
    water_requirement: product?.water_requirement || '',
    soil_type: product?.soil_type || '',
    packet_weight: product?.packet_weight || '',
    seed_quantity: product?.seed_quantity || '',
    expected_yield: product?.expected_yield || '',
    cultivation_instructions: product?.cultivation_instructions || '',
    storage_instructions: product?.storage_instructions || '',
    seo_title: product?.seo_title || '',
    meta_description: product?.meta_description || '',
    related_product_ids: product?.related_product_ids || [],
    image_alt: product?.image_alt || '',
    image_alt_bn: product?.image_alt_bn || '',
    min_order_qty: product?.min_order_qty || '',
    max_order_qty: product?.max_order_qty || '',
    suitable_months: product?.suitable_months || [],
    growing_type: product?.growing_type || '',
    season_tags: product?.season_tags || [],
    cost_price: product?.cost_price || '',
    show_low_stock: product?.show_low_stock ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = form.slug || form.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || form.name_bn;
    const payload = { ...form, slug, regular_price: Number(form.regular_price), sale_price: form.sale_price ? Number(form.sale_price) : null, stock: Number(form.stock), low_stock_threshold: Number(form.low_stock_threshold), images: form.images, related_product_ids: form.related_product_ids, min_order_qty: form.min_order_qty ? Number(form.min_order_qty) : null, max_order_qty: form.max_order_qty ? Number(form.max_order_qty) : null, cost_price: form.cost_price ? Number(form.cost_price) : null, suitable_months: form.suitable_months, growing_type: form.growing_type || null, season_tags: form.season_tags, show_low_stock: form.show_low_stock };
    onSave({ payload, faqs, variants, bulkTiers, removedFaqs, removedVariants, removedBulkTiers });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{product ? 'প্রোডাক্ট এডিট' : 'নতুন প্রোডাক্ট'}</h2>
          <button onClick={onClose}><X className="h-6 w-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-sm font-medium">নাম (বাংলা)</label><input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} className="input-bangla" required /></div>
            <div><label className="mb-1 block text-sm font-medium">নাম (English)</label><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-bangla" placeholder="auto-generated" /></div>
            <div><label className="mb-1 block text-sm font-medium">SKU</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">ক্যাটাগরি</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input-bangla">
                <option value="">ক্যাটাগরি নির্বাচন করুন</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name_bn}</option>)}
              </select>
            </div>
            <div><label className="mb-1 block text-sm font-medium">রেগুলার দাম (৳)</label><input type="number" value={form.regular_price} onChange={(e) => setForm({ ...form, regular_price: e.target.value })} className="input-bangla" required /></div>
            <div><label className="mb-1 block text-sm font-medium">সেল দাম (৳)</label><input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">স্টক</label><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">লো স্টক থ্রেশহোল্ড</label><input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="input-bangla" /></div>
          </div>

          <div><label className="mb-1 block text-sm font-medium">সংক্ষিপ্ত বিবরণ</label><textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="input-bangla min-h-[60px]" /></div>

          <MediaUploader images={form.images} setImages={(v) => setForm({ ...form, images: v, image: v[0] || form.image })} bucket="product-images" label="পণ্যের ছবি (একাধিক)" recommendation="800 × 800 px" />

          {/* বিস্তারিত বিবরণ (গোছানো টেক্সট লেখার জন্য সাইজ ও গাইডলাইন আপডেট করা হয়েছে) */}
          <div>
            <label className="mb-1 block text-sm font-medium">বিস্তারিত বিবরণ</label>
            <textarea 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              className="input-bangla min-h-[250px]" 
              placeholder="এখানে পণ্যের বিস্তারিত বিবরণ লিখুন। প্যারাগ্রাফ বা পয়েন্ট আলাদা করতে এন্টার দিন।"
            />
            <p className="mt-1 text-xs text-emerald-700 font-medium">
              💡 টিপস: নতুন লাইনে যাওয়ার জন্য 'Enter' প্রেস করুন এবং পয়েন্ট বা ড্যাশ (-) ব্যবহার করে সুন্দরভাবে সাজিয়ে লিখুন। ওয়েবসাইটে এটি ঠিক এভাবেই গোছানো দেখাবে।
            </p>
          </div>

          <div className="rounded-xl bg-secondary/20 p-4">
            <h3 className="mb-3 font-semibold">বীজের তথ্য</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['seed_type', 'বীজের ধরন'], ['variety', 'জাত'], ['brand', 'ব্র্যান্ড'],
                ['origin', 'উৎপত্তি'], ['season', 'মৌসুম'], ['planting_season', 'বপনের মৌসুম'],
                ['germination_time', 'অঙ্কুরোন সময়'], ['germination_rate', 'অঙ্কুরোন হার'],
                ['harvest_time', 'ফসল তোলার সময়'], ['plant_spacing', 'গাছের দূরত্ব'],
                ['planting_depth', 'বপনের গভীরতা'], ['sunlight', 'সূর্যালোক'],
                ['water_requirement', 'পানির প্রয়োজন'], ['soil_type', 'মাটির ধরন'],
                ['packet_weight', 'প্যাকেটের ওজন'], ['seed_quantity', 'বীজের পরিমাণ'],
                ['expected_yield', 'প্রত্যাশিত ফলন'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
                  <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
            <div className="mt-3"><label className="mb-1 block text-sm font-medium">চাষের নির্দেশনা</label><textarea value={form.cultivation_instructions} onChange={(e) => setForm({ ...form, cultivation_instructions: e.target.value })} className="input-bangla min-h-[60px]" /></div>
            <div className="mt-2"><label className="mb-1 block text-sm font-medium">সংরক্ষণ নির্দেশনা</label><textarea value={form.storage_instructions} onChange={(e) => setForm({ ...form, storage_instructions: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              ['is_active', 'সক্রিয়'], ['is_featured', 'ফিচার্ড'],
              ['is_best_seller', 'বেস্ট সেলার'], ['is_new_arrival', 'নতুন'],
              ['is_seasonal', 'মৌসুমি'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="accent-primary" />
                {label}
              </label>
            ))}
          </div>

          {/* Related Seeds */}
          <div className="rounded-xl bg-secondary/20 p-4">
            <h3 className="mb-3 font-semibold">এই বীজগুলিও দেখতে পারেন (Related Seeds)</h3>
            <div className="mb-2 flex flex-wrap gap-2">
              {(form.related_product_ids || []).map((id: string) => {
                const p = allProducts.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <span key={id} className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-sm">
                    {p.name_bn || p.name_en}
                    <button type="button" onClick={() => setForm({ ...form, related_product_ids: (form.related_product_ids || []).filter((x: string) => x !== id) })}><X className="h-3 w-3" /></button>
                  </span>
                );
              })}
            </div>
            <button type="button" onClick={() => setShowRelatedPicker(!showRelatedPicker)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">
              <Plus className="h-4 w-4" /> প্রোডাক্ট যোগ করুন
            </button>
            {showRelatedPicker && (
              <div className="mt-2">
                <input type="text" value={relatedSearch} onChange={(e) => setRelatedSearch(e.target.value)} placeholder="খুঁজুন..." className="input-bangla mb-2" autoFocus />
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  {allProducts.filter((p) => !form.related_product_ids?.includes(p.id) && (p.name_bn?.toLowerCase().includes(relatedSearch.toLowerCase()) || p.name_en?.toLowerCase().includes(relatedSearch.toLowerCase()))).slice(0, 20).map((p) => (
                    <button key={p.id} type="button" onClick={() => { setForm({ ...form, related_product_ids: [...(form.related_product_ids || []), p.id] }); setRelatedSearch(''); }} className="block w-full border-b border-border/50 px-3 py-2 text-left text-sm hover:bg-secondary">
                      {p.name_bn || p.name_en}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Product FAQs */}
          <div className="rounded-xl bg-secondary/20 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><HelpCircle className="h-4 w-4" /> সাধারণ প্রশ্ন ও উত্তর (FAQ)</h3>
            <div className="space-y-2">
              {faqs.map((f, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium">{f.question_bn}</p>
                    <button type="button" onClick={() => removeFaq(idx)}><X className="h-4 w-4 text-destructive" /></button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{f.answer_bn}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2 rounded-lg border border-dashed border-border p-3">
              <input value={faqForm.question_bn} onChange={(e) => setFaqForm({ ...faqForm, question_bn: e.target.value })} placeholder="প্রশ্ন (বাংলা)" className="input-bangla" />
              <textarea value={faqForm.answer_bn} onChange={(e) => setFaqForm({ ...faqForm, answer_bn: e.target.value })} placeholder="উত্তর (বাংলা)" className="input-bangla min-h-[60px]" />
              <input value={faqForm.question_en} onChange={(e) => setFaqForm({ ...faqForm, question_en: e.target.value })} placeholder="Question (English - optional)" className="input-bangla" />
              <textarea value={faqForm.answer_en} onChange={(e) => setFaqForm({ ...faqForm, answer_en: e.target.value })} placeholder="Answer (English - optional)" className="input-bangla min-h-[60px]" />
              <button type="button" onClick={addFaq} className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"><Plus className="h-4 w-4" /> FAQ যোগ করুন</button>
            </div>
          </div>

          {/* Variants */}
          <div className="rounded-xl bg-secondary/20 p-4">
            <h3 className="mb-3 font-semibold">ভেরিয়েন্ট (Variants)</h3>
            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg bg-background p-2 text-sm">
                  <span className="flex-1">{v.name} — ৳{v.regular_price} (স্টক: {v.stock})</span>
                  <button type="button" onClick={() => removeVariant(idx)} className="text-destructive"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-3">
              <input value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} placeholder="নাম (যেমন: ১০g)" className="input-bangla" />
              <input value={variantForm.regular_price} onChange={(e) => setVariantForm({ ...variantForm, regular_price: e.target.value })} placeholder="দাম" type="number" className="input-bangla" />
              <input value={variantForm.sale_price} onChange={(e) => setVariantForm({ ...variantForm, sale_price: e.target.value })} placeholder="সেল দাম" type="number" className="input-bangla" />
              <input value={variantForm.stock} onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })} placeholder="স্টক" type="number" className="input-bangla" />
              <input value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} placeholder="SKU" className="input-bangla" />
              <input value={variantForm.weight_or_count} onChange={(e) => setVariantForm({ ...variantForm, weight_or_count: e.target.value })} placeholder="ওজন/সংখ্যা" className="input-bangla" />
              <button type="button" onClick={addVariant} className="col-span-full flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary"><Plus className="h-4 w-4" /> ভেরিয়েন্ট যোগ করুন</button>
            </div>
          </div>

          {/* Bulk Pricing */}
          <div className="rounded-xl bg-secondary/20 p-4">
            <h3 className="mb-3 font-semibold">হোলসেল / বাল্ক প্রাইসিং</h3>
            <div className="space-y-2">
              {bulkTiers.map((b, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg bg-background p-2 text-sm">
                  <span className="flex-1">{b.min_quantity}+ টি → ৳{b.unit_price}/টি</span>
                  <button type="button" onClick={() => removeBulkTier(idx)} className="text-destructive"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2 rounded-lg border border-dashed border-border p-3">
              <input value={bulkForm.min_quantity} onChange={(e) => setBulkForm({ ...bulkForm, min_quantity: e.target.value })} placeholder="ন্যূনতম পরিমাণ" type="number" className="input-bangla" />
              <input value={bulkForm.unit_price} onChange={(e) => setBulkForm({ ...bulkForm, unit_price: e.target.value })} placeholder="একক দাম" type="number" className="input-bangla" />
              <button type="button" onClick={addBulkTier} className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary"><Plus className="h-4 w-4" /> যোগ করুন</button>
            </div>
          </div>

          {/* Purchase Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-medium">ন্যূনতম অর্ডার পরিমাণ</label><input value={form.min_order_qty} onChange={(e) => setForm({ ...form, min_order_qty: e.target.value })} type="number" className="input-bangla" placeholder="খালি = কোন সীমা নেই" /></div>
            <div><label className="mb-1 block text-sm font-medium">সর্বোচ্চ অর্ডার পরিমাণ</label><input value={form.max_order_qty} onChange={(e) => setForm({ ...form, max_order_qty: e.target.value })} type="number" className="input-bangla" placeholder="খালি = কোন সীমা নেই" /></div>
          </div>

          {/* Seasonal / Seed Finder */}
          <div className="rounded-xl bg-secondary/20 p-4">
            <button type="button" onClick={() => setShowSeasonal(!showSeasonal)} className="flex w-full items-center justify-between font-semibold">
              মৌসুমি / সিড ফাইন্ডার ডেটা
              <ChevronDown className={`h-5 w-5 transition-transform ${showSeasonal ? 'rotate-180' : ''}`} />
            </button>
            {showSeasonal && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">উপযুক্ত মাস</label>
                  <div className="flex flex-wrap gap-2">
                    {allMonths.map((m) => (
                      <button key={m} type="button" onClick={() => toggleMonth(m)} className={`rounded-lg px-3 py-1.5 text-sm ${(form.suitable_months || []).includes(m) ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'}`}>{m}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">চাষের ধরন</label>
                  <select value={form.growing_type} onChange={(e) => setForm({ ...form, growing_type: e.target.value })} className="input-bangla">
                    <option value="">— নির্বাচন করুন —</option>
                    {allGrowingTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">সিজন ট্যাগ</label>
                  <div className="flex flex-wrap gap-2">
                    {allSeasonTags.map((t) => (
                      <button key={t} type="button" onClick={() => toggleSeasonTag(t)} className={`rounded-lg px-3 py-1.5 text-sm ${(form.season_tags || []).includes(t) ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cost Price (admin only) */}
          <div className="rounded-xl bg-secondary/20 p-4">
            <h3 className="mb-3 font-semibold">ক্রয় মূল্য (Cost Price) — শুধু এডমিন</h3>
            <input value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} type="number" className="input-bangla" placeholder="ক্রয় মূল্য" />
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.show_low_stock} onChange={(e) => setForm({ ...form, show_low_stock: e.target.checked })} /> কাস্টমারকে লো স্টক মেসেজ দেখান</label>
          </div>

          {/* SEO Settings */}
          <div className="rounded-xl bg-secondary/20 p-4">
            <h3 className="mb-3 font-semibold">SEO সেটিংস</h3>
            <div className="space-y-3">
              <div><label className="mb-1 block text-sm font-medium">SEO Title</label><input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className="input-bangla" placeholder="SEO Title" /></div>
              <div><label className="mb-1 block text-sm font-medium">Meta Description</label><textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} className="input-bangla min-h-[60px]" placeholder="Meta Description" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-sm font-medium">Image Alt (English)</label><input value={form.image_alt} onChange={(e) => setForm({ ...form, image_alt: e.target.value })} className="input-bangla" /></div>
                <div><label className="mb-1 block text-sm font-medium">Image Alt (বাংলা)</label><input value={form.image_alt_bn} onChange={(e) => setForm({ ...form, image_alt_bn: e.target.value })} className="input-bangla" /></div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">সেভ করুন</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-6 py-3 hover:bg-secondary">বাতিল</button>
          </div>
        </form>
      </div>
    </div>
  );
}
