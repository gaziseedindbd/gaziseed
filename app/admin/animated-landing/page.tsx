'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { toast } from '@/components/site/toast-provider';
import { Copy, Eye, Pencil, Plus, Power, Sparkles, Trash2, X } from 'lucide-react';

const blankPackage = (index = 0) => ({
  package_name: index === 0 ? '১ প্যাকেট' : `${index + 1} প্যাকেট`,
  quantity: index + 1,
  offer_price: '',
  compare_price: '',
  badge: index === 0 ? 'NORMAL' : index === 1 ? 'POPULAR' : 'BEST',
  free_delivery: true,
  custom_delivery_charge: '',
  is_default_selected: index === 0,
  is_active: true,
  display_order: index,
});

const defaultStory = [
  { title: 'সমস্যা', text: 'কম ফলন, দুর্বল গাছ ও অনিশ্চিত ফলনের চিন্তা।', icon: '01' },
  { title: 'সমাধান', text: 'ভালো বীজ বাছাই থেকেই ভালো ফলনের শুরু।', icon: '02' },
  { title: 'আমাদের বীজ', text: 'বাছাইকৃত মানসম্মত বীজ, চাষের জন্য প্রস্তুত।', icon: '03' },
  { title: 'কেন আমাদের', text: 'নিরাপদ প্যাকিং, স্পষ্ট তথ্য ও সহায়ক সেবা।', icon: '04' },
  { title: 'চাষ পদ্ধতি', text: 'সহজ ধাপে কীভাবে চাষ করবেন তা দেখানো হবে।', icon: '05' },
  { title: 'অর্ডার করুন', text: 'পছন্দের প্যাকেজ নিন এবং ঘরে বসে অর্ডার করুন।', icon: '06' },
];

export default function AdminAnimatedLandingPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const [{ data: rows }, { data: prods }] = await Promise.all([
      supabase.from('animated_landing_pages').select('*, products(name_bn,name_en,image,stock)').order('created_at', { ascending: false }),
      supabase.from('products').select('id,name_bn,name_en,slug,image,stock,regular_price,sale_price').eq('is_active', true).order('name_bn'),
    ]);
    setPages(rows || []);
    setProducts(prods || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (page: any) => {
    const next = page.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('animated_landing_pages').update({ status: next, updated_at: new Date().toISOString() }).eq('id', page.id);
    if (error) toast(error.message, 'error'); else { toast(next === 'active' ? 'Landing Page চালু হয়েছে' : 'Landing Page বন্ধ হয়েছে'); load(); }
  };

  const remove = async (page: any) => {
    if (!confirm(`“${page.landing_name || page.slug}” মুছতে চান?`)) return;
    const { error } = await supabase.from('animated_landing_pages').delete().eq('id', page.id);
    if (error) toast(error.message, 'error'); else { toast('Animated Landing Page মুছে ফেলা হয়েছে'); load(); }
  };

  const openCreate = () => { setEditing(null); setBuilderOpen(true); };
  const openEdit = (page: any) => { setEditing(page); setBuilderOpen(true); };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div><div className="flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /><h1 className="text-2xl font-black">Animated Landing Pages</h1></div><p className="mt-1 text-sm text-muted-foreground">Premium storyboard-style product landing page তৈরি করুন—existing order/delivery system অপরিবর্তিত থাকবে।</p></div>
        <button onClick={openCreate} className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> নতুন Animated Page</button>
      </div>

      {!pages.length ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center"><Sparkles className="mx-auto mb-4 h-12 w-12 text-primary/30" /><h2 className="font-bold">এখনও কোনো Animated Landing Page নেই</h2><p className="mt-1 text-sm text-muted-foreground">একটি product select করে premium animated sales page তৈরি করুন।</p><button onClick={openCreate} className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">প্রথম পেজ তৈরি করুন</button></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{pages.map((page) => <div key={page.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"><div className="relative aspect-[16/9] bg-[#07180f]"><img src={page.hero_image || page.products?.image || ''} alt="" className="h-full w-full object-contain p-4" /> <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${page.status === 'active' ? 'bg-lime-300 text-[#07180f]' : 'bg-white/10 text-white'}`}>{page.status}</span></div><div className="p-5"><h3 className="font-black">{page.landing_name || page.hero_title || page.slug}</h3><p className="mt-1 text-xs text-muted-foreground">Product: {page.products?.name_bn || page.products?.name_en || '—'}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-secondary px-2.5 py-1">Views: {page.views || 0}</span><span className="rounded-full bg-secondary px-2.5 py-1">Orders: {page.conversions || 0}</span></div><div className="mt-4 grid grid-cols-5 gap-2"><Link href={`/animated-landing/${page.slug}`} target="_blank" className="flex items-center justify-center rounded-xl border border-border p-2 hover:bg-secondary" title="Preview"><Eye className="h-4 w-4" /></Link><button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/animated-landing/${page.slug}`); toast('Landing URL কপি হয়েছে'); }} className="flex items-center justify-center rounded-xl border border-border p-2 hover:bg-secondary" title="Copy URL"><Copy className="h-4 w-4" /></button><button onClick={() => openEdit(page)} className="flex items-center justify-center rounded-xl border border-border p-2 hover:bg-secondary" title="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => toggle(page)} className="flex items-center justify-center rounded-xl border border-border p-2 hover:bg-secondary" title="On/Off"><Power className="h-4 w-4" /></button><button onClick={() => remove(page)} className="flex items-center justify-center rounded-xl border border-border p-2 text-destructive hover:bg-destructive/10" title="Delete"><Trash2 className="h-4 w-4" /></button></div></div></div>)}</div>
      )}

      {builderOpen && <AnimatedBuilder page={editing} products={products} onClose={() => setBuilderOpen(false)} onSaved={() => { setBuilderOpen(false); load(); }} />}
    </div>
  );
}

function AnimatedBuilder({ page, products, onClose, onSaved }: { page: any | null; products: any[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!page;
  const [productMode, setProductMode] = useState<'existing' | 'new'>('existing');
  const [productId, setProductId] = useState(page?.product_id || '');
  const [newProduct, setNewProduct] = useState({ name_bn: '', name_en: '', sku: '', stock: 50, regular_price: 0, image: '' });
  const [form, setForm] = useState({
    landing_name: page?.landing_name || '',
    slug: page?.slug || '',
    hero_badge: page?.hero_badge || 'বিশেষ অফার',
    hero_title: page?.hero_title || '',
    hero_highlight: page?.hero_highlight || 'বেশি ফলন, বেশি লাভ!',
    hero_subtitle: page?.hero_subtitle || '',
    hero_image: page?.hero_image || '',
    announcement_text: page?.announcement_text || 'সীমিত সময়ের স্পেশাল অফার',
    cta_text: page?.cta_text || 'অর্ডার করুন এখনই',
    status: page?.status || 'draft',
  });
  const [packages, setPackages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [stories, setStories] = useState<StoryRow[]>(Array.isArray(page?.story_steps) && page.story_steps.length ? page.story_steps : defaultStory);

  type StoryRow = { title: string; text: string; icon: string };

  useEffect(() => {
    (async () => {
      if (!page) { setPackages([blankPackage(0), blankPackage(1), blankPackage(2)]); return; }
      const { data } = await supabase.from('animated_landing_packages').select('*').eq('landing_page_id', page.id).order('display_order');
      setPackages((data || []).map((p) => ({ ...p, custom_delivery_charge: p.custom_delivery_charge ?? '' })));
    })();
  }, [page]);

  const chosenProduct = products.find((p) => p.id === productId);

  const makeSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || `animated-${Date.now()}`;

  const save = async () => {
    if (!form.landing_name.trim()) { toast('Landing Page name দিন', 'error'); return; }
    setSaving(true);
    try {
      let finalProductId = productId;
      let createdProduct: any = null;
      if (!isEdit && productMode === 'new') {
        const slug = makeSlug(newProduct.name_en || newProduct.name_bn);
        const { data, error } = await supabase.from('products').insert({
          name_bn: newProduct.name_bn,
          name_en: newProduct.name_en,
          sku: newProduct.sku,
          stock: Number(newProduct.stock) || 0,
          regular_price: Number(newProduct.regular_price) || 0,
          image: newProduct.image,
          slug,
          is_active: true,
          is_ads_only: false,
        }).select().single();
        if (error) throw error;
        createdProduct = data;
        finalProductId = data.id;
      }
      if (!finalProductId) { toast('Product select করুন', 'error'); setSaving(false); return; }

      const payload = {
        product_id: finalProductId,
        landing_name: form.landing_name.trim(),
        slug: form.slug.trim() || makeSlug(form.landing_name),
        hero_badge: form.hero_badge,
        hero_title: form.hero_title,
        hero_highlight: form.hero_highlight,
        hero_subtitle: form.hero_subtitle,
        hero_image: form.hero_image || createdProduct?.image || chosenProduct?.image || '',
        announcement_text: form.announcement_text,
        cta_text: form.cta_text,
        status: form.status,
        story_steps: stories,
        benefits: [
          { title: 'উচ্চ ফলনশীল', text: 'সঠিক পরিচর্যায় ভালো ফলনের সম্ভাবনা', icon: '🌱' },
          { title: 'রোগ প্রতিরোধী', text: 'ভালো মানের গাছ তৈরিতে সহায়ক', icon: '🛡️' },
          { title: 'লম্বা ও সরস', text: 'আকর্ষণীয় উৎপাদনে সহায়ক', icon: '🥬' },
          { title: 'সারা বছর চাহিদায়', text: 'বাজারের চাহিদা মাথায় রেখে', icon: '🗓️' },
          { title: 'অর্থনৈতিক লাভ', text: 'সঠিক চাষে ভালো রিটার্নের সুযোগ', icon: '💰' },
        ],
        cultivation_steps: [
          { title: 'বীজ বপন', text: 'উপযুক্ত মাটিতে বীজ বপন করুন', icon: '01' },
          { title: 'সেচ দিন', text: 'প্রয়োজনমতো পানি দিন', icon: '02' },
          { title: 'সার প্রয়োগ', text: 'সঠিক সময়ে প্রয়োজনীয় সার দিন', icon: '03' },
          { title: 'পরিচর্যা', text: 'নিয়মিত গাছ দেখুন', icon: '04' },
          { title: 'ফলন সংগ্রহ', text: 'উপযুক্ত সময়ে ফলন সংগ্রহ করুন', icon: '05' },
        ],
        trust_items: [
          { title: 'সারা দেশে হোম ডেলিভারি', text: 'নিরাপদ ডেলিভারি', icon: '🚚' },
          { title: '100% আসল বীজ', text: 'অরিজিনাল পণ্য', icon: '🛡️' },
          { title: '7 দিনের রিপ্লেসমেন্ট', text: 'প্রযোজ্য ক্ষেত্রে', icon: '↺' },
          { title: 'নিরাপদ প্যাকেজিং', text: 'সুরক্ষিতভাবে পাঠানো', icon: '📦' },
        ],
        testimonials: Array.isArray(page?.testimonials) ? page.testimonials : [],
        updated_at: new Date().toISOString(),
      };

      let landingId = page?.id;
      if (isEdit) {
        const { error } = await supabase.from('animated_landing_pages').update(payload).eq('id', page.id);
        if (error) throw error;
        await supabase.from('animated_landing_packages').delete().eq('landing_page_id', page.id);
      } else {
        const { data, error } = await supabase.from('animated_landing_pages').insert(payload).select().single();
        if (error) throw error;
        landingId = data.id;
      }

      const cleaned = packages.filter((p) => Number(p.offer_price) > 0).map((p, index) => ({
        landing_page_id: landingId,
        product_id: finalProductId,
        package_name: p.package_name || `${Number(p.quantity) || index + 1} প্যাকেট`,
        quantity: Math.max(1, Number(p.quantity) || index + 1),
        offer_price: Number(p.offer_price),
        compare_price: Number(p.compare_price) || null,
        badge: p.badge || '',
        free_delivery: !!p.free_delivery,
        custom_delivery_charge: p.free_delivery ? null : (p.custom_delivery_charge === '' ? null : Number(p.custom_delivery_charge)),
        is_default_selected: index === 0 ? true : !!p.is_default_selected,
        is_active: p.is_active !== false,
        display_order: index,
      }));
      if (!cleaned.length) throw new Error('কমপক্ষে ১টি প্যাকেজের price দিন');
      const { error: packageError } = await supabase.from('animated_landing_packages').insert(cleaned);
      if (packageError) throw packageError;

      toast(isEdit ? 'Animated Landing Page আপডেট হয়েছে' : 'Animated Landing Page তৈরি হয়েছে');
      onSaved();
    } catch (error: any) {
      toast(error?.message || 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const updatePackage = (index: number, patch: any) => setPackages((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  const addPackage = () => setPackages((current) => [...current, blankPackage(current.length)]);
  const removePackage = (index: number) => setPackages((current) => current.filter((_, i) => i !== index));

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"><div className="mx-auto max-w-6xl rounded-[28px] border border-border bg-background shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[28px] border-b border-border bg-background/95 px-5 py-4 backdrop-blur"><div><h2 className="text-xl font-black">{isEdit ? 'Animated Page Edit' : 'নতুন Animated Landing Page'}</h2><p className="text-xs text-muted-foreground">Design + Story + Package + Order form</p></div><button onClick={onClose} className="rounded-xl border border-border p-2 hover:bg-secondary"><X className="h-5 w-5" /></button></div><div className="grid gap-6 p-5 lg:grid-cols-[1.05fr_.95fr]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-card p-4"><h3 className="font-bold">১. Product</h3>{!isEdit && <div className="mt-3 flex gap-2"><button onClick={() => setProductMode('existing')} className={`rounded-xl px-3 py-2 text-xs font-bold ${productMode === 'existing' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>Existing Product</button><button onClick={() => setProductMode('new')} className={`rounded-xl px-3 py-2 text-xs font-bold ${productMode === 'new' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>Add New Product</button></div>}{productMode === 'existing' || isEdit ? <select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"><option value="">Product select করুন</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name_bn || product.name_en} — Stock {product.stock}</option>)}</select> : <div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={newProduct.name_bn} onChange={(e) => setNewProduct({ ...newProduct, name_bn: e.target.value })} placeholder="Product Name (বাংলা)" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input value={newProduct.name_en} onChange={(e) => setNewProduct({ ...newProduct, name_en: e.target.value })} placeholder="Product Name (English)" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="SKU" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} placeholder="Stock" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input type="number" value={newProduct.regular_price} onChange={(e) => setNewProduct({ ...newProduct, regular_price: Number(e.target.value) })} placeholder="Regular Price" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input value={newProduct.image} onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })} placeholder="Product Image URL" className="rounded-xl border border-border bg-background px-3 py-3 text-sm sm:col-span-2" /></div>}</section>
        <section className="rounded-2xl border border-border bg-card p-4"><h3 className="font-bold">২. Hero Content</h3><div className="mt-3 grid gap-3"><input value={form.landing_name} onChange={(e) => setForm({ ...form, landing_name: e.target.value })} placeholder="Landing Page Name" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug (e.g. 12-mashi-borboti)" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-3 text-sm"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></div><input value={form.hero_badge} onChange={(e) => setForm({ ...form, hero_badge: e.target.value })} placeholder="Hero Badge" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} placeholder="Hero Main Title" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input value={form.hero_highlight} onChange={(e) => setForm({ ...form, hero_highlight: e.target.value })} placeholder="Hero Highlight" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><textarea value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} placeholder="Hero Subtitle" className="min-h-24 rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input value={form.hero_image} onChange={(e) => setForm({ ...form, hero_image: e.target.value })} placeholder="Hero Image URL (optional — product image used by default)" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /></div></section>
        <section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center justify-between"><h3 className="font-bold">৩. Storyboard Scenes</h3><button onClick={() => setStories([...stories, { title: 'নতুন Scene', text: 'Scene description', icon: String(stories.length + 1).padStart(2,'0') }])} className="rounded-xl bg-secondary px-3 py-2 text-xs font-bold">+ Scene</button></div><div className="mt-3 space-y-3">{stories.map((story, index) => <div key={index} className="rounded-xl border border-border p-3"><div className="grid gap-2 sm:grid-cols-[70px_1fr]"><input value={story.icon} onChange={(e) => setStories(stories.map((s, i) => i === index ? { ...s, icon: e.target.value } : s))} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" /><input value={story.title} onChange={(e) => setStories(stories.map((s, i) => i === index ? { ...s, title: e.target.value } : s))} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" /></div><textarea value={story.text} onChange={(e) => setStories(stories.map((s, i) => i === index ? { ...s, text: e.target.value } : s))} className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" /><button onClick={() => setStories(stories.filter((_, i) => i !== index))} className="mt-2 text-xs font-bold text-destructive">Scene delete</button></div>)}</div></section>
      </div>
      <div className="space-y-5"><section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">৪. Package Offers</h3><p className="mt-1 text-xs text-muted-foreground">Price admin থেকে নির্ধারিত হবে। Free Delivery ON হলে delivery 0.</p></div><button onClick={addPackage} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">+ Package</button></div><div className="mt-4 space-y-3">{packages.map((pkg, index) => <div key={index} className="rounded-2xl border border-border p-3"><div className="flex items-center justify-between"><span className="text-xs font-black">Package {index + 1}</span><button onClick={() => removePackage(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={pkg.package_name} onChange={(e) => updatePackage(index, { package_name: e.target.value })} placeholder="Package Name" className="rounded-lg border border-border bg-background px-2 py-2 text-sm" /><input type="number" value={pkg.quantity} onChange={(e) => updatePackage(index, { quantity: Number(e.target.value) })} placeholder="Quantity" className="rounded-lg border border-border bg-background px-2 py-2 text-sm" /><input type="number" value={pkg.offer_price} onChange={(e) => updatePackage(index, { offer_price: e.target.value })} placeholder="Offer Price" className="rounded-lg border border-border bg-background px-2 py-2 text-sm font-bold" /><input type="number" value={pkg.compare_price} onChange={(e) => updatePackage(index, { compare_price: e.target.value })} placeholder="Compare Price" className="rounded-lg border border-border bg-background px-2 py-2 text-sm" /><input value={pkg.badge || ''} onChange={(e) => updatePackage(index, { badge: e.target.value })} placeholder="Badge" className="rounded-lg border border-border bg-background px-2 py-2 text-sm" /><input type="number" value={pkg.custom_delivery_charge} onChange={(e) => updatePackage(index, { custom_delivery_charge: e.target.value })} disabled={!!pkg.free_delivery} placeholder="Custom Delivery Charge (optional)" className="rounded-lg border border-border bg-background px-2 py-2 text-sm disabled:opacity-50" /></div><div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold"><label className="flex items-center gap-2"><input type="checkbox" checked={!!pkg.free_delivery} onChange={(e) => updatePackage(index, { free_delivery: e.target.checked })} /> Free Delivery</label><label className="flex items-center gap-2"><input type="checkbox" checked={!!pkg.is_default_selected} onChange={(e) => setPackages(packages.map((p, i) => ({ ...p, is_default_selected: i === index ? e.target.checked : false })))} /> Default Selected</label></div></div>)}</div></section><section className="rounded-2xl border border-border bg-card p-4"><h3 className="font-bold">৫. Ads / CTA</h3><div className="mt-3 grid gap-3"><input value={form.announcement_text} onChange={(e) => setForm({ ...form, announcement_text: e.target.value })} placeholder="Announcement" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="CTA text" className="rounded-xl border border-border bg-background px-3 py-3 text-sm" /><p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">Generated URL: <span className="font-bold text-foreground">/animated-landing/{form.slug || 'your-slug'}</span></p></div></section><button onClick={save} disabled={saving} className="w-full rounded-2xl bg-gradient-to-r from-lime-300 to-amber-300 px-5 py-4 font-black text-[#06170f] shadow-xl disabled:opacity-60">{saving ? 'Save হচ্ছে...' : isEdit ? 'Save Changes' : 'Animated Landing Page তৈরি করুন'}</button></div>
    </div></div></div>;
}
