'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { toast } from '@/components/site/toast-provider';
import { Save, Eye, Copy, ChevronLeft, Plus, Trash2, CopyPlus } from 'lucide-react';
import { ImageUploader, VideoUploader, SingleImageUploader } from '@/components/admin/image-uploader';
import { RepeatableList } from '@/components/admin/repeatable-list';
import Link from 'next/link';

const TABS = ['Basic Info', 'Media', 'Offer', 'Bundles', 'Quantity Offers', 'Content', 'Order Form', 'Delivery', 'Reviews & FAQ', 'Tracking', 'SEO', 'Preview'] as const;
type Tab = typeof TABS[number];

export default function AdsLandingEditorPage() {
  const [tab, setTab] = useState<Tab>('Basic Info');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [landing, setLanding] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [quantityOffers, setQuantityOffers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({ views: 0, orders: 0, revenue: 0, units: 0 });

  const params = useParams<{ id: string }>();
  const id = params.id;

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    const { data: lp } = await supabase.from('landing_pages').select('*').eq('id', id).maybeSingle();
    if (!lp) { window.location.href = '/admin/ads-landing'; return; }
    setLanding(lp);
    const { data: prod } = await supabase.from('products').select('*').eq('id', lp.product_id).maybeSingle();
    setProduct(prod);
    const { data: b } = await supabase.from('bundle_offers').select('*').eq('product_id', lp.product_id).order('display_order');
    setBundles(b || []);
    const { data: qo } = await supabase.from('quantity_offers').select('*').eq('landing_page_id', id).order('display_order');
    setQuantityOffers(qo || []);
    const { data: r } = await supabase.from('landing_reviews').select('*').eq('landing_page_id', id).order('display_order');
    setReviews(r || []);
    const { data: f } = await supabase.from('landing_faqs').select('*').eq('landing_page_id', id).order('display_order');
    setFaqs(f || []);

    const { count: views } = await supabase.from('landing_page_views').select('id', { count: 'exact', head: true }).eq('landing_page_id', id);
    const { data: orders } = await supabase.from('orders').select('grand_total, status').eq('utm_campaign', lp.landing_slug).neq('status', 'cancelled');
    setAnalytics({
      views: views || 0,
      orders: orders?.length || 0,
      revenue: (orders || []).reduce((s: number, o: any) => s + Number(o.grand_total), 0),
      units: 0,
    });
    setLoading(false);
  }, []);

  const saveLanding = async () => {
    setSaving(true);
    const { error } = await supabase.from('landing_pages').update({
      landing_name: landing.landing_name, landing_slug: landing.landing_slug, title: landing.title,
      subtitle: landing.subtitle, status: landing.status, is_enabled: landing.status === 'active',
      compare_price: landing.compare_price ? Number(landing.compare_price) : null,
      offer_price: landing.offer_price ? Number(landing.offer_price) : null,
      cta_text: landing.cta_text, images: landing.images, video_url: landing.video_url,
      benefits: landing.benefits, features: landing.features, description: landing.description,
      growing_guide: landing.growing_guide, trust_text: landing.trust_text, cod_text: landing.cod_text,
      delivery_text: landing.delivery_text, faq: landing.faq, section_visibility: landing.section_visibility,
      offer_headline: landing.offer_headline, offer_badge: landing.offer_badge, discount_label: landing.discount_label,
      seo_title: landing.seo_title, meta_description: landing.meta_description,
      og_title: landing.og_title, og_description: landing.og_description, og_image: landing.og_image,
      landing_type: landing.landing_type || 'standard',
      combo_product_ids: landing.combo_product_ids || [],
      combo_quantities: landing.combo_quantities || [],
    }).eq('id', landing.id);
    setSaving(false);
    if (error) { toast('সেভ ব্যর্থ: ' + error.message, 'error'); return; }
    toast('Landing Page সেভ হয়েছে');
  };

  const saveProduct = async () => {
    if (!product) return;
    await supabase.from('products').update({
      name_bn: product.name_bn, name_en: product.name_en, sku: product.sku, stock: Number(product.stock),
      short_description: product.short_description, description: product.description,
      seed_type: product.seed_type, variety: product.variety, origin: product.origin,
      season: product.season, packet_weight: product.packet_weight, is_active: product.is_active,
    }).eq('id', product.id);
    toast('প্রোডাক্ট সেভ হয়েছে');
  };

  const saveAll = async () => {
    setSaving(true);
    await saveProduct();
    await saveLanding();
    // Save bundles
    for (const b of bundles) {
      const payload = { ...b, bundle_price: Number(b.bundle_price), compare_price: b.compare_price ? Number(b.compare_price) : null, quantity: Number(b.quantity), display_order: Number(b.display_order) };
      if (b.id && !b._new) {
        await supabase.from('bundle_offers').update(payload).eq('id', b.id);
      } else {
        const { id, _new, ...rest } = payload;
        await supabase.from('bundle_offers').insert({ ...rest, product_id: product.id });
      }
    }
    // Save quantity offers
    for (const qo of quantityOffers) {
      const payload = {
        ...qo,
        quantity: Number(qo.quantity),
        offer_price: Number(qo.offer_price),
        compare_price: qo.compare_price ? Number(qo.compare_price) : null,
        custom_delivery_charge: qo.custom_delivery_charge ? Number(qo.custom_delivery_charge) : null,
        display_order: Number(qo.display_order),
      };
      if (qo.id && !qo._new) {
        await supabase.from('quantity_offers').update(payload).eq('id', qo.id);
      } else {
        const { id, _new, ...rest } = payload;
        await supabase.from('quantity_offers').insert({ ...rest, landing_page_id: landing.id, product_id: product.id });
      }
    }
    // Save reviews
    for (const r of reviews) {
      const payload = { ...r, rating: Number(r.rating), display_order: Number(r.display_order) };
      if (r.id && !r._new) {
        await supabase.from('landing_reviews').update(payload).eq('id', r.id);
      } else {
        const { id, _new, ...rest } = payload;
        await supabase.from('landing_reviews').insert({ ...rest, landing_page_id: landing.id });
      }
    }
    // Save FAQs
    for (const f of faqs) {
      const payload = { ...f, display_order: Number(f.display_order) };
      if (f.id && !f._new) {
        await supabase.from('landing_faqs').update(payload).eq('id', f.id);
      } else {
        const { id, _new, ...rest } = payload;
        await supabase.from('landing_faqs').insert({ ...rest, landing_page_id: landing.id });
      }
    }
    setSaving(false);
    toast('সব পরিবর্তন সেভ হয়েছে');
    loadData();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  const comparePrice = Number(landing.compare_price) || 0;
  const offerPrice = Number(landing.offer_price) || 0;
  const discountAmount = comparePrice > offerPrice ? comparePrice - offerPrice : 0;
  const discountPercent = comparePrice > 0 ? Math.round((discountAmount / comparePrice) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/ads-landing" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-4 w-4" /> Ads Landing Pages
        </Link>
        <div className="flex gap-2">
          <a href={`/offer/${landing.landing_slug}?preview=1`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"><Eye className="h-4 w-4" /> Preview</a>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/offer/${landing.landing_slug}`); toast('লিংক কপি হয়েছে'); }} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"><Copy className="h-4 w-4" /> Copy Link</button>
          <button onClick={saveAll} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</button>
        </div>
      </div>

      <h1 className="mb-2 text-xl font-bold">{landing.landing_name || landing.title || 'Untitled'}</h1>
      {product && <p className="mb-4 text-sm text-muted-foreground">Product: {product.name_bn || product.name_en} {product.is_ads_only && <span className="text-purple-600">(Ads Only)</span>}</p>}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border no-scrollbar">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
      </div>

      {/* Basic Info */}
      {tab === 'Basic Info' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">Landing Page তথ্য</h3>
          <div><label className="mb-1 block text-sm font-medium">Landing Page Type</label>
            <select value={landing.landing_type || 'standard'} onChange={(e) => setLanding({ ...landing, landing_type: e.target.value })} className="input-bangla">
              <option value="standard">Standard Product Offer</option>
              <option value="combo">Combo / Multi-Product Offer</option>
            </select>
          </div>
          {(landing.landing_type === 'combo') && (
            <div className="rounded-xl bg-purple-50 p-4">
              <h4 className="mb-2 font-medium text-purple-700">Combo Products</h4>
              <ComboProductEditor landing={landing} setLanding={setLanding} />
            </div>
          )}
          <div><label className="mb-1 block text-sm font-medium">Landing Page Name</label><input value={landing.landing_name || ''} onChange={(e) => setLanding({ ...landing, landing_name: e.target.value })} className="input-bangla" placeholder="Tomato Seed Facebook Offer August" /></div>
          <div><label className="mb-1 block text-sm font-medium">Landing Page Slug</label><input value={landing.landing_slug || ''} onChange={(e) => setLanding({ ...landing, landing_slug: e.target.value })} className="input-bangla" placeholder="tomato-seed-offer" /></div>
          {landing.landing_slug && <p className="text-xs text-muted-foreground">URL: /offer/{landing.landing_slug}</p>}
          <div><label className="mb-1 block text-sm font-medium">টাইটেল</label><input value={landing.title || ''} onChange={(e) => setLanding({ ...landing, title: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">সাবটাইটেল</label><input value={landing.subtitle || ''} onChange={(e) => setLanding({ ...landing, subtitle: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Status</label>
            <select value={landing.status} onChange={(e) => setLanding({ ...landing, status: e.target.value })} className="input-bangla">
              <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option>
            </select>
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 font-semibold">প্রোডাক্ট তথ্য</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-sm font-medium">নাম (বাংলা)</label><input value={product?.name_bn || ''} onChange={(e) => setProduct({ ...product, name_bn: e.target.value })} className="input-bangla" /></div>
              <div><label className="mb-1 block text-sm font-medium">নাম (English)</label><input value={product?.name_en || ''} onChange={(e) => setProduct({ ...product, name_en: e.target.value })} className="input-bangla" /></div>
              <div><label className="mb-1 block text-sm font-medium">SKU</label><input value={product?.sku || ''} onChange={(e) => setProduct({ ...product, sku: e.target.value })} className="input-bangla" /></div>
              <div><label className="mb-1 block text-sm font-medium">স্টক</label><input type="number" value={product?.stock || 0} onChange={(e) => setProduct({ ...product, stock: e.target.value })} className="input-bangla" /></div>
            </div>
            <div className="mt-3"><label className="mb-1 block text-sm font-medium">সংক্ষিপ্ত বিবরণ</label><textarea value={product?.short_description || ''} onChange={(e) => setProduct({ ...product, short_description: e.target.value })} className="input-bangla min-h-[60px]" /></div>
            <div className="mt-2"><label className="mb-1 block text-sm font-medium">বিস্তারিত বিবরণ</label><textarea value={product?.description || ''} onChange={(e) => setProduct({ ...product, description: e.target.value })} className="input-bangla min-h-[100px]" /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-muted-foreground">Product Type</label><input value={product?.seed_type || ''} onChange={(e) => setProduct({ ...product, seed_type: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Variety</label><input value={product?.variety || ''} onChange={(e) => setProduct({ ...product, variety: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Origin</label><input value={product?.origin || ''} onChange={(e) => setProduct({ ...product, origin: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Season</label><input value={product?.season || ''} onChange={(e) => setProduct({ ...product, season: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Packet Weight</label><input value={product?.packet_weight || ''} onChange={(e) => setProduct({ ...product, packet_weight: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" /></div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={product?.is_active ?? true} onChange={(e) => setProduct({ ...product, is_active: e.target.checked })} className="accent-primary" /> প্রোডাক্ট সক্রিয়</label>
          </div>
          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Save className="mr-2 inline h-4 w-4" /> সেভ করুন</button>
        </div>
      )}

      {/* Media */}
      {tab === 'Media' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <ImageUploader images={landing.images || []} onChange={(imgs) => setLanding({ ...landing, images: imgs })} label="Gallery Images" max={10} recommendation="800 × 800 px" />
          <VideoUploader videoUrl={landing.video_url || ''} onChange={(url) => setLanding({ ...landing, video_url: url })} label="Product Video" />
          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Offer */}
      {tab === 'Offer' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">Offer & Pricing</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-medium">Compare Price (৳)</label><input type="number" value={landing.compare_price || ''} onChange={(e) => setLanding({ ...landing, compare_price: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">Offer Price (৳)</label><input type="number" value={landing.offer_price || ''} onChange={(e) => setLanding({ ...landing, offer_price: e.target.value })} className="input-bangla" /></div>
          </div>
          {discountAmount > 0 && (
            <div className="rounded-lg bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-700">Save {formatPrice(discountAmount)} ({discountPercent}% OFF)</p>
            </div>
          )}
          <div><label className="mb-1 block text-sm font-medium">Discount Label (override)</label><input value={landing.discount_label || ''} onChange={(e) => setLanding({ ...landing, discount_label: e.target.value })} className="input-bangla" placeholder="Auto-calculated if empty" /></div>
          <div><label className="mb-1 block text-sm font-medium">Offer Headline</label><input value={landing.offer_headline || ''} onChange={(e) => setLanding({ ...landing, offer_headline: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Offer Badge</label><input value={landing.offer_badge || ''} onChange={(e) => setLanding({ ...landing, offer_badge: e.target.value })} className="input-bangla" placeholder="BEST OFFER" /></div>
          <div><label className="mb-1 block text-sm font-medium">CTA Text</label><input value={landing.cta_text || ''} onChange={(e) => setLanding({ ...landing, cta_text: e.target.value })} className="input-bangla" /></div>
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">এই দাম শুধমাত্র Ads Landing Page-এর জন্য। সাধারণ ওয়েবসাইট প্রাইস পরিবর্তিত হবে না।</div>
          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Bundles */}
      {tab === 'Bundles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Bundle Offers</h3>
            <button onClick={() => setBundles([...bundles, { _new: true, id: `new-${Date.now()}`, bundle_name: '', quantity: 1, bundle_price: 0, compare_price: '', savings: '', badge: '', free_delivery: false, is_default_selected: false, display_order: bundles.length, is_active: true }])} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> নতুন Bundle</button>
          </div>
          {bundles.map((b, idx) => (
            <BundleCard key={b.id || idx} bundle={b} onChange={(updated) => setBundles(bundles.map((item, i) => i === idx ? updated : item))} onDelete={() => { if (b.id && !b._new) supabase.from('bundle_offers').delete().eq('id', b.id); setBundles(bundles.filter((_, i) => i !== idx)); }} onDuplicate={() => setBundles([...bundles.slice(0, idx + 1), { ...b, _new: true, id: `new-${Date.now()}`, bundle_name: b.bundle_name + ' (Copy)' }, ...bundles.slice(idx + 1)])} />
          ))}
          {bundles.length === 0 && <p className="text-sm text-muted-foreground">কোন বান্ডল নেই। "+ নতুন Bundle" বাটনে ক্লিক করে যোগ করুন।</p>}
          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Quantity Offers */}
      {tab === 'Quantity Offers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">পরিমাণ অনুযায়ী অফার মূল্য</h3>
              <p className="text-sm text-muted-foreground">প্রতিটি পরিমাণের জন্য আলাদা মূল্য নির্ধারণ করুন। দাম স্বয়ংক্রিয় গণনা করা হবে না।</p>
            </div>
            <button onClick={() => setQuantityOffers([...quantityOffers, { _new: true, id: `new-${Date.now()}`, quantity: 1, offer_price: 0, compare_price: '', badge: '', free_delivery: false, custom_delivery_charge: '', is_default_selected: false, is_active: true, display_order: quantityOffers.length }])} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> নতুন Quantity Offer</button>
          </div>
          {quantityOffers.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/20 text-left text-xs text-muted-foreground">
                  <th className="p-2">পরিমাণ</th><th className="p-2">সাধারণ মূল্য</th><th className="p-2">অফার মূল্য</th><th className="p-2">সাশ্রয়</th><th className="p-2">Badge</th><th className="p-2">Free Delivery</th><th className="p-2">Action</th>
                </tr></thead>
                <tbody>
                  {quantityOffers.map((qo, idx) => {
                    const offer = Number(qo.offer_price) || 0;
                    const compare = Number(qo.compare_price) || 0;
                    const savings = compare > offer ? compare - offer : 0;
                    return (
                      <tr key={qo.id || idx} className="border-b border-border/50">
                        <td className="p-2 font-medium">{qo.quantity}টি</td>
                        <td className="p-2 text-muted-foreground">{compare > 0 ? formatPrice(compare) : '—'}</td>
                        <td className="p-2 font-bold text-primary">{formatPrice(offer)}</td>
                        <td className="p-2 text-green-600">{savings > 0 ? formatPrice(savings) : '—'}</td>
                        <td className="p-2">{qo.badge || '—'}</td>
                        <td className="p-2">{qo.free_delivery ? 'হ্যাঁ' : 'না'}</td>
                        <td className="p-2"><div className="flex gap-1"><button onClick={() => { if (qo.id && !qo._new) supabase.from('quantity_offers').delete().eq('id', qo.id); setQuantityOffers(quantityOffers.filter((_, i) => i !== idx)); }} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {quantityOffers.length === 0 && <p className="text-sm text-muted-foreground">কোন Quantity Offer নেই। "+ নতুন Quantity Offer" বাটনে ক্লিক করে যোগ করুন।</p>}
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">এই মূল্যগুলো শুধমাত্র Ads Landing Page-এর জন্য। সাধারণ ওয়েবসাইট প্রাইস পরিবর্তিত হবে না। কাস্টমার যে পরিমাণ বাছাই করবে, ঠিক সেই মূল্য চার্জ হবে — ইউনিট প্রাইস × পরিমাণ নয়।</div>
          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Content */}
      {tab === 'Content' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <div><label className="mb-1 block text-sm font-medium">Description</label><textarea value={landing.description || ''} onChange={(e) => setLanding({ ...landing, description: e.target.value })} className="input-bangla min-h-[100px]" /></div>

          <div>
            <label className="mb-2 block text-sm font-medium">Benefits</label>
            <RepeatableList
              items={(landing.benefits || []).map((b: string, i: number) => ({ id: `b-${i}`, text: b }))}
              onChange={(items) => setLanding({ ...landing, benefits: items.map((i) => i.text) })}
              newItem={() => ({ id: `new-${Date.now()}`, text: '' })}
              addLabel="+ Add Benefit"
              renderItem={(item, update) => <input value={item.text} onChange={(e) => update('text', e.target.value)} className="input-bangla" placeholder="✓ উন্নত মানের বীজ" />}
              itemLabel={(_, idx) => `Benefit ${idx + 1}`}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Features</label>
            <RepeatableList
              items={(landing.features || []).map((f: string, i: number) => ({ id: `f-${i}`, text: f }))}
              onChange={(items) => setLanding({ ...landing, features: items.map((i) => i.text) })}
              newItem={() => ({ id: `new-${Date.now()}`, text: '' })}
              addLabel="+ Add Feature"
              renderItem={(item, update) => <input value={item.text} onChange={(e) => update('text', e.target.value)} className="input-bangla" placeholder="উচ্চ ফলনশীল" />}
              itemLabel={(_, idx) => `Feature ${idx + 1}`}
            />
          </div>

          <div><label className="mb-1 block text-sm font-medium">Growing Guide</label><textarea value={landing.growing_guide || ''} onChange={(e) => setLanding({ ...landing, growing_guide: e.target.value })} className="input-bangla min-h-[80px]" /></div>
          <div><label className="mb-1 block text-sm font-medium">Trust Text</label><input value={landing.trust_text || ''} onChange={(e) => setLanding({ ...landing, trust_text: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">COD Text</label><input value={landing.cod_text || ''} onChange={(e) => setLanding({ ...landing, cod_text: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Delivery Text</label><input value={landing.delivery_text || ''} onChange={(e) => setLanding({ ...landing, delivery_text: e.target.value })} className="input-bangla" /></div>

          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Order Form */}
      {tab === 'Order Form' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">Direct Order Form</h3>
          <p className="text-sm text-muted-foreground">এই ফর্মটি Ads Landing Page-এ সরাসরি প্রদর্শিত হবে। কোন লগইন বা অ্যাকাউন্ট প্রয়োজন নেই।</p>
          <div className="space-y-2 rounded-lg bg-secondary/20 p-3 text-sm">
            <p>আপনার নাম *</p>
            <p>মোবাইল নম্বর *</p>
            <p>ডেলিভারি এলাকা *</p>
            <p>সম্পূর্ণ ঠিকানা *</p>
            <p>বিশেষ নির্দেশনা (ঐচ্ছিক)</p>
          </div>
          <div><label className="mb-1 block text-sm font-medium">CTA Text</label><input value={landing.cta_text || ''} onChange={(e) => setLanding({ ...landing, cta_text: e.target.value })} className="input-bangla" /></div>
          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Delivery */}
      {tab === 'Delivery' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">Delivery Settings</h3>
          <p className="text-sm text-muted-foreground">প্রতিটি বান্ডলে আলাদা ডেলিভারি সেটিংস কনফিগার করা যায় (Bundles ট্যাবে)। এখানে সাধারণ ডেলিভারি টেক্সট সেট করুন।</p>
          <div><label className="mb-1 block text-sm font-medium">Delivery Text</label><textarea value={landing.delivery_text || ''} onChange={(e) => setLanding({ ...landing, delivery_text: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          <div><label className="mb-1 block text-sm font-medium">COD Text</label><textarea value={landing.cod_text || ''} onChange={(e) => setLanding({ ...landing, cod_text: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">ডেলিভারি জোন Admin → Settings → Delivery থেকে ম্যানেজ করুন। প্রতিটি বান্ডলে Free Delivery বা Custom Delivery Charge সেট করা যায়।</div>
          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Reviews & FAQ */}
      {tab === 'Reviews & FAQ' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-3 font-semibold">Customer Reviews</h3>
            <RepeatableList
              items={reviews}
              onChange={setReviews}
              newItem={() => ({ _new: true, id: `new-${Date.now()}`, customer_name: '', rating: 5, review: '', customer_image: '', review_image: '', display_order: reviews.length, is_active: true })}
              addLabel="+ Add Review"
              renderItem={(item, update) => (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={item.customer_name} onChange={(e) => update('customer_name', e.target.value)} className="input-bangla" placeholder="Customer Name" />
                    <select value={item.rating} onChange={(e) => update('rating', Number(e.target.value))} className="input-bangla">
                      {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} ★</option>)}
                    </select>
                  </div>
                  <textarea value={item.review} onChange={(e) => update('review', e.target.value)} className="input-bangla min-h-[60px]" placeholder="Review text" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={item.customer_image} onChange={(e) => update('customer_image', e.target.value)} className="input-bangla" placeholder="Customer Image URL" />
                    <input value={item.review_image} onChange={(e) => update('review_image', e.target.value)} className="input-bangla" placeholder="Review Image URL" />
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.is_active} onChange={(e) => update('is_active', e.target.checked)} className="accent-primary" /> Active</label>
                </div>
              )}
              itemLabel={(item, idx) => `${item.customer_name || `Review ${idx + 1}`}`}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-3 font-semibold">FAQ</h3>
            <RepeatableList
              items={faqs}
              onChange={setFaqs}
              newItem={() => ({ _new: true, id: `new-${Date.now()}`, question: '', answer: '', display_order: faqs.length, is_active: true })}
              addLabel="+ Add FAQ"
              renderItem={(item, update) => (
                <div className="space-y-2">
                  <input value={item.question} onChange={(e) => update('question', e.target.value)} className="input-bangla" placeholder="Question" />
                  <textarea value={item.answer} onChange={(e) => update('answer', e.target.value)} className="input-bangla min-h-[60px]" placeholder="Answer" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.is_active} onChange={(e) => update('is_active', e.target.checked)} className="accent-primary" /> Active</label>
                </div>
              )}
              itemLabel={(item, idx) => item.question || `FAQ ${idx + 1}`}
            />
          </div>

          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Tracking */}
      {tab === 'Tracking' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">Campaign & UTM Tracking</h3>
          <div className="rounded-lg bg-secondary/30 p-3 text-sm">
            <p className="font-medium">Ad URL:</p>
            <p className="mt-1 break-all text-primary">{window.location.origin}/offer/{landing.landing_slug}?utm_source=facebook&utm_medium=paid&utm_campaign={landing.landing_slug}</p>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/offer/${landing.landing_slug}?utm_source=facebook&utm_medium=paid&utm_campaign=${landing.landing_slug}`); toast('Ad URL কপি হয়েছে'); }} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Copy className="h-4 w-4" /> Copy Ad URL</button>
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Pixel আইডি Admin → Settings → Marketing-এ কনফিগার করা আছে। সব Ads অর্ডারের সাথে UTM প্যারামিটার স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।</div>
        </div>
      )}

      {/* SEO */}
      {tab === 'SEO' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">SEO & Social Sharing</h3>
          <div><label className="mb-1 block text-sm font-medium">SEO Title</label><input value={landing.seo_title || ''} onChange={(e) => setLanding({ ...landing, seo_title: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Meta Description</label><textarea value={landing.meta_description || ''} onChange={(e) => setLanding({ ...landing, meta_description: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          <div><label className="mb-1 block text-sm font-medium">Open Graph Title</label><input value={landing.og_title || ''} onChange={(e) => setLanding({ ...landing, og_title: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Open Graph Description</label><textarea value={landing.og_description || ''} onChange={(e) => setLanding({ ...landing, og_description: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          <SingleImageUploader imageUrl={landing.og_image || ''} onChange={(url) => setLanding({ ...landing, og_image: url })} label="Open Graph Image" recommendation="1200 × 630 px" />
          <button onClick={saveAll} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">সেভ করুন</button>
        </div>
      )}

      {/* Preview */}
      {tab === 'Preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-3 font-semibold">Desktop Preview</h3>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="aspect-video bg-secondary/20 p-4">
                  <div className="flex h-full items-center justify-center">
                    <a href={`/offer/${landing.landing_slug}?preview=1`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Eye className="mr-1 inline h-4 w-4" /> Open Preview</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-3 font-semibold">Mobile Preview</h3>
              <div className="mx-auto max-w-[200px] overflow-hidden rounded-2xl border-4 border-foreground/20">
                <div className="aspect-[9/16] bg-secondary/20 p-2">
                  <div className="flex h-full items-center justify-center">
                    <a href={`/offer/${landing.landing_slug}?preview=1`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"><Eye className="mr-1 inline h-3 w-3" /> Preview</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-2 font-semibold">Analytics</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-secondary/20 p-3 text-center"><p className="text-xs text-muted-foreground">Views</p><p className="text-lg font-bold">{analytics.views}</p></div>
              <div className="rounded-lg bg-secondary/20 p-3 text-center"><p className="text-xs text-muted-foreground">Orders</p><p className="text-lg font-bold">{analytics.orders}</p></div>
              <div className="rounded-lg bg-secondary/20 p-3 text-center"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-lg font-bold">{formatPrice(analytics.revenue)}</p></div>
              <div className="rounded-lg bg-secondary/20 p-3 text-center"><p className="text-xs text-muted-foreground">Conv. Rate</p><p className="text-lg font-bold">{analytics.views > 0 ? ((analytics.orders / analytics.views) * 100).toFixed(1) : 0}%</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComboProductEditor({ landing, setLanding }: { landing: any; setLanding: (v: any) => void }) {
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('products').select('id, name_bn, name_en, slug, image, stock, regular_price').eq('is_active', true).eq('is_ads_only', false).order('name_bn').then(({ data }) => setAllProducts(data || []));
  }, []);

  const comboIds: string[] = landing.combo_product_ids || [];
  const comboQtys: number[] = landing.combo_quantities || [];

  const addProduct = (p: any) => {
    if (comboIds.includes(p.id)) return;
    setLanding({ ...landing, combo_product_ids: [...comboIds, p.id], combo_quantities: [...comboQtys, 1] });
  };
  const removeProduct = (idx: number) => {
    setLanding({ ...landing, combo_product_ids: comboIds.filter((_, i) => i !== idx), combo_quantities: comboQtys.filter((_, i) => i !== idx) });
  };
  const updateQty = (idx: number, qty: number) => {
    setLanding({ ...landing, combo_quantities: comboQtys.map((q, i) => i === idx ? Math.max(1, qty) : q) });
  };

  return (
    <div className="space-y-2">
      {comboIds.map((id, idx) => {
        const p = allProducts.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div key={id} className="flex items-center gap-2 rounded-lg bg-white p-2 text-sm">
            {p.image && <img src={p.image} alt="" className="h-10 w-10 rounded object-cover" />}
            <span className="flex-1">{p.name_bn || p.name_en}</span>
            <input type="number" min="1" value={comboQtys[idx] || 1} onChange={(e) => updateQty(idx, Number(e.target.value))} className="w-16 rounded border px-2 py-1 text-sm" />
            <button onClick={() => removeProduct(idx)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        );
      })}
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন..." className="input-bangla" />
      {search && (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-white">
          {allProducts.filter((p) => !comboIds.includes(p.id) && (p.name_bn?.toLowerCase().includes(search.toLowerCase()) || p.name_en?.toLowerCase().includes(search.toLowerCase()))).slice(0, 10).map((p) => (
            <button key={p.id} onClick={() => { addProduct(p); setSearch(''); }} className="block w-full border-b border-border/50 px-3 py-2 text-left text-sm hover:bg-secondary">{p.name_bn || p.name_en}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function BundleCard({ bundle, onChange, onDelete, onDuplicate }: { bundle: any; onChange: (b: any) => void; onDelete: () => void; onDuplicate: () => void }) {
  const compare = Number(bundle.compare_price) || 0;
  const total = Number(bundle.bundle_price) || 0;
  const savings = compare > total ? compare - total : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><label className="mb-1 block text-xs text-muted-foreground">Bundle Name</label><input value={bundle.bundle_name} onChange={(e) => onChange({ ...bundle, bundle_name: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" placeholder="২ প্যাকেট" /></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Quantity</label><input type="number" value={bundle.quantity} onChange={(e) => onChange({ ...bundle, quantity: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Bundle Price (৳)</label><input type="number" value={bundle.bundle_price} onChange={(e) => onChange({ ...bundle, bundle_price: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Compare Price (৳)</label><input type="number" value={bundle.compare_price} onChange={(e) => onChange({ ...bundle, compare_price: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Badge</label><input value={bundle.badge} onChange={(e) => onChange({ ...bundle, badge: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" placeholder="MOST POPULAR" /></div>
        <div><label className="mb-1 block text-xs text-muted-foreground">Custom Delivery (৳)</label><input type="number" value={bundle.custom_delivery_charge || ''} onChange={(e) => onChange({ ...bundle, custom_delivery_charge: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" placeholder="Default zone" /></div>
      </div>
      {savings > 0 && <p className="mt-2 text-sm font-medium text-green-600">Save {formatPrice(savings)}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bundle.free_delivery} onChange={(e) => onChange({ ...bundle, free_delivery: e.target.checked })} className="accent-primary" /> Free Delivery</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bundle.is_default_selected} onChange={(e) => onChange({ ...bundle, is_default_selected: e.target.checked })} className="accent-primary" /> Default Selected</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bundle.is_active} onChange={(e) => onChange({ ...bundle, is_active: e.target.checked })} className="accent-primary" /> Active</label>
        <div className="flex-1" />
        <button onClick={onDuplicate} className="rounded-lg p-2 hover:bg-secondary" title="Duplicate"><CopyPlus className="h-4 w-4" /></button>
        <button onClick={onDelete} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function QuantityOfferCard({ offer, basePrice, onChange, onDelete, onDuplicate }: { offer: any; basePrice: number; onChange: (o: any) => void; onDelete: () => void; onDuplicate: () => void }) {
  const qty = Number(offer.quantity) || 1;
  const offerPrice = Number(offer.offer_price) || 0;
  const comparePrice = offer.compare_price ? Number(offer.compare_price) : basePrice * qty;
  const savings = comparePrice > offerPrice ? comparePrice - offerPrice : 0;
  const discountPercent = comparePrice > 0 ? Math.round((savings / comparePrice) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Quantity</label>
          <input type="number" min="1" value={offer.quantity} onChange={(e) => {
            const newQty = Number(e.target.value);
            const newCompare = offer.compare_price ? Number(offer.compare_price) : basePrice * newQty;
            onChange({ ...offer, quantity: e.target.value, compare_price: offer.compare_price || String(basePrice * newQty) });
          }} className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Offer Price (৳)</label>
          <input type="number" value={offer.offer_price} onChange={(e) => onChange({ ...offer, offer_price: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Compare Price (৳) — auto: {formatPrice(basePrice * qty)}</label>
          <input type="number" value={offer.compare_price || ''} onChange={(e) => onChange({ ...offer, compare_price: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" placeholder={String(basePrice * qty)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Badge</label>
          <input value={offer.badge || ''} onChange={(e) => onChange({ ...offer, badge: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" placeholder="জনপ্রিয় / BEST VALUE" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Custom Delivery (৳)</label>
          <input type="number" value={offer.custom_delivery_charge || ''} onChange={(e) => onChange({ ...offer, custom_delivery_charge: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm" placeholder="Zone default" />
        </div>
      </div>
      {savings > 0 && <p className="mt-2 text-sm font-medium text-green-600">Save {formatPrice(savings)} ({discountPercent}% OFF)</p>}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offer.free_delivery} onChange={(e) => onChange({ ...offer, free_delivery: e.target.checked })} className="accent-primary" /> Free Delivery</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offer.is_default_selected} onChange={(e) => onChange({ ...offer, is_default_selected: e.target.checked })} className="accent-primary" /> Default Selected</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offer.is_active} onChange={(e) => onChange({ ...offer, is_active: e.target.checked })} className="accent-primary" /> Active</label>
        <div className="flex-1" />
        <button onClick={onDuplicate} className="rounded-lg p-2 hover:bg-secondary" title="Duplicate"><CopyPlus className="h-4 w-4" /></button>
        <button onClick={onDelete} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
