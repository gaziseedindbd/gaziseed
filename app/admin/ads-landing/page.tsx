'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { Plus, Edit, Eye, Copy, Trash2, Power, CopyPlus, X, Search, Megaphone, Upload, Link as LinkIcon } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';
import Link from 'next/link';

export default function AdminAdsLandingPage() {
  const [landings, setLandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadLandings(); }, []);

  const loadLandings = async () => {
    const { data } = await supabase
      .from('landing_pages')
      .select('*, products(name_bn, name_en, slug, image, is_ads_only, stock)')
      .order('created_at', { ascending: false });
    setLandings(data || []);
    setLoading(false);
  };

  const filtered = landings.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.landing_name?.toLowerCase().includes(s) || l.title?.toLowerCase().includes(s) || l.landing_slug?.toLowerCase().includes(s);
  });

  const toggleStatus = async (l: any) => {
    const newStatus = l.status === 'active' ? 'paused' : 'active';
    await supabase.from('landing_pages').update({ status: newStatus, is_active: newStatus === 'active' }).eq('id', l.id);
    toast(newStatus === 'active' ? 'ল্যান্ডিং পেজ চালু হয়েছে' : 'ল্যান্ডিং পেজ বিরতি দেওয়া হয়েছে');
    loadLandings();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('এই Ads Landing Page মুছতে চান?')) return;
    await supabase.from('landing_pages').delete().eq('id', id);
    toast('Landing Page মুছে ফেলা হয়েছে');
    loadLandings();
  };

  const duplicate = async (l: any) => {
    const { landing_name, landing_slug, title, subtitle, images, video_url, compare_price, offer_price,
      benefits, features, description, growing_guide, trust_text, cod_text, delivery_text, faq,
      cta_text, section_visibility, product_id, pricing_tiers, tiers } = l;
    const newSlug = (landing_slug || 'landing') + '-copy';
    const { error } = await supabase.from('landing_pages').insert({
      product_id, landing_name: (landing_name || title) + ' (Copy)', landing_slug: newSlug, slug: newSlug,
      title, subtitle, images, video_url, compare_price, offer_price, benefits, features,
      description, growing_guide, trust_text, cod_text, delivery_text, faq, cta_text,
      pricing_tiers: pricing_tiers || tiers || [], tiers: pricing_tiers || tiers || [],
      section_visibility, status: 'draft', is_active: false
    });
    if (error) { toast('ডুপ্লিকেট ব্যর্থ: ' + error.message, 'error'); return; }
    toast('Landing Page ডুপ্লিকেট করা হয়েছে');
    loadLandings();
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/offer/${slug}`;
    navigator.clipboard.writeText(url);
    toast('লিংক কপি হয়েছে: ' + url);
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ads Landing Pages</h1>
          <p className="text-sm text-muted-foreground">Facebook/Instagram বিজ্ঞাপনের জন্য ল্যান্ডিং পেজ ম্যানেজ করুন</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> নতুন Ads Landing Page
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Landing page খুঁজুন..." className="input-bangla pl-10" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Megaphone className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
          <p className="text-muted-foreground">কোন Ads Landing Page নেই। নতুন তৈরি করতে উপরের বাটনে ক্লিক করুন।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <div key={l.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative aspect-video bg-secondary/30">
                {l.images && l.images.length > 0 ? (
                  <img src={l.images[0]} alt={l.landing_name || l.title} className="h-full w-full object-cover" />
                ) : l.products?.image ? (
                  <img src={l.products.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">🌱</div>
                )}
                <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  l.status === 'active' ? 'bg-green-500 text-white' :
                  l.status === 'paused' ? 'bg-orange-500 text-white' :
                  l.status === 'archived' ? 'bg-gray-500 text-white' : 'bg-blue-500 text-white'
                }`}>{l.status}</span>
                {l.products?.is_ads_only && (
                  <span className="absolute left-2 top-2 rounded-full bg-purple-500 px-2 py-0.5 text-xs font-medium text-white">Ads Only</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{l.landing_name || l.title || 'Untitled'}</h3>
                <p className="text-xs text-muted-foreground">Product: {l.products?.name_bn || l.products?.name_en || '—'}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {l.offer_price && <span className="rounded bg-secondary px-2 py-0.5">Offer: {formatPrice(l.offer_price)}</span>}
                  <span className="rounded bg-secondary px-2 py-0.5">URL: /offer/{l.landing_slug || l.slug || '—'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Link href={`/admin/ads-landing/${l.id}`} className="rounded-lg p-2 hover:bg-secondary" title="এডিট"><Edit className="h-4 w-4" /></Link>
                  <a href={`/offer/${l.landing_slug || l.slug}?preview=1`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 hover:bg-secondary" title="প্রিভিউ"><Eye className="h-4 w-4" /></a>
                  <button onClick={() => copyLink(l.landing_slug || l.slug)} className="rounded-lg p-2 hover:bg-secondary" title="লিংক কপি"><Copy className="h-4 w-4" /></button>
                  <button onClick={() => duplicate(l)} className="rounded-lg p-2 hover:bg-secondary" title="ডুপ্লিকেট"><CopyPlus className="h-4 w-4" /></button>
                  <button onClick={() => toggleStatus(l)} className="rounded-lg p-2 hover:bg-secondary" title="চালু/বন্ধ"><Power className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(l.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="মুছুন"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateLandingModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadLandings(); }} />}
    </div>
  );
}

function CreateLandingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<'select' | 'existing' | 'new'>('select');
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loading, setLoading] = useState(false);

  // New ads-only product form
  const [newProduct, setNewProduct] = useState({
    name_bn: '', name_en: '', sku: '', stock: 0,
    short_description: '', description: '', regular_price: 0,
  });
  // Landing page form
  const [landing, setLanding] = useState({
    landing_name: '', landing_slug: '', title: '', subtitle: '',
    compare_price: '', offer_price: '', cta_text: 'অর্ডার কনফার্ম করুন',
    status: 'active', description: '', trust_text: '', cod_text: '', delivery_text: '',
    growing_guide: '',
  });
  // Images
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  
  // Quantity offers (Default ৩টি প্যাকেজ)
  const [quantityOffers, setQuantityOffers] = useState<any[]>([
    { quantity: '1', offer_price: '300', compare_price: '500', badge: 'BEST', free_delivery: true, is_default_selected: true },
    { quantity: '2', offer_price: '500', compare_price: '1000', badge: 'POPULAR', free_delivery: true, is_default_selected: false },
    { quantity: '3', offer_price: '700', compare_price: '1500', badge: 'MEGA DEAL', free_delivery: true, is_default_selected: false },
  ]);

  useEffect(() => {
    if (mode === 'existing') {
      supabase.from('products').select('*').eq('is_active', true).eq('is_ads_only', false).order('name_bn').then(({ data }) => setProducts(data || []));
    }
  }, [mode]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      let productId = selectedProductId;

      if (mode === 'new') {
        const slug = (newProduct.name_en || newProduct.name_bn).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ads-product';
        const { data: prod, error: prodError } = await supabase.from('products').insert({
          name_bn: newProduct.name_bn, name_en: newProduct.name_en, sku: newProduct.sku,
          stock: Number(newProduct.stock) || 0, short_description: newProduct.short_description,
          description: newProduct.description, regular_price: Number(newProduct.regular_price) || 0,
          slug, is_active: true, is_ads_only: true, image: images[0] || '',
        }).select().single();
        if (prodError) throw prodError;
        productId = prod.id;
      }

      if (!productId) { toast('প্রোডাক্ট নির্বাচন করুন', 'error'); setLoading(false); return; }

      const landingSlug = landing.landing_slug || (landing.landing_name || 'offer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'offer';
      
      // নির্ভুলভাবে টিয়ার্স ফরম্যাট করা
      const formattedTiers = quantityOffers.map((qo, idx) => ({
        quantity: Number(qo.quantity) || idx + 1,
        offer_price: Number(qo.offer_price) || 0,
        price: Number(qo.offer_price) || 0,
        compare_price: Number(qo.compare_price) || 0,
        regular_price: Number(qo.compare_price) || 0,
        badge: qo.badge || '',
        free_delivery: Boolean(qo.free_delivery),
        is_free_delivery: Boolean(qo.free_delivery),
        is_default_selected: Boolean(qo.is_default_selected),
        default_selected: Boolean(qo.is_default_selected),
        display_order: idx
      }));

      const { data: lpData, error: lpError } = await supabase.from('landing_pages').insert({
        product_id: productId,
        landing_name: landing.landing_name,
        landing_slug: landingSlug,
        slug: landingSlug,
        title: landing.title || landing.landing_name,
        subtitle: landing.subtitle,
        compare_price: Number(landing.compare_price) || null,
        offer_price: Number(landing.offer_price) || null,
        cta_text: landing.cta_text,
        status: landing.status,
        is_active: landing.status === 'active',
        is_enabled: landing.status === 'active',
        images: images.length > 0 ? images : null,
        description: landing.description || null,
        benefits: benefits.filter(b => b && b.trim() !== ''),
        features: features.filter(f => f && f.trim() !== ''),
        trust_text: landing.trust_text || null,
        cod_text: landing.cod_text || null,
        delivery_text: landing.delivery_text || null,
        growing_guide: landing.growing_guide || null,
        pricing_tiers: formattedTiers,
        tiers: formattedTiers
      }).select().single();

      if (lpError) throw lpError;

      // quantity_offers টেবিলে প্রতিটি প্যাকেজ ইনসার্ট করা
      if (formattedTiers.length > 0) {
        const inserts = formattedTiers.map((qo, idx) => ({
          landing_page_id: lpData.id,
          product_id: productId,
          quantity: qo.quantity,
          offer_price: qo.offer_price,
          compare_price: qo.compare_price,
          badge: qo.badge,
          free_delivery: qo.free_delivery,
          custom_delivery_charge: null,
          is_default_selected: qo.is_default_selected,
          is_active: true,
          display_order: idx,
        }));
        await supabase.from('quantity_offers').insert(inserts);
      }

      toast('Ads Landing Page সফলভাবে তৈরি হয়েছে');
      onCreated();
    } catch (err: any) {
      toast('তৈরি ব্যর্থ: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">নতুন Ads Landing Page তৈরি করুন</h2>
          <button onClick={onClose}><X className="h-6 w-6" /></button>
        </div>

        {mode === 'select' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">আপনি কি বিদ্যমান প্রোডাক্ট ব্যবহার করবেন নাকি শুধু Ads-এর জন্য নতুন প্রোডাক্ট তৈরি করবেন?</p>
            <button onClick={() => setMode('existing')} className="flex w-full items-start gap-3 rounded-xl border-2 border-border p-4 text-left hover:border-primary/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Megaphone className="h-5 w-5" /></div>
              <div>
                <p className="font-semibold">বিদ্যমান ওয়েবসাইট প্রোডাক্ট লিংক করুন</p>
                <p className="text-sm text-muted-foreground">স্টক শেয়ার করা হবে, কিন্তু Ads প্রাইস আলাদা</p>
              </div>
            </button>
            <button onClick={() => setMode('new')} className="flex w-full items-start gap-3 rounded-xl border-2 border-border p-4 text-left hover:border-primary/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600"><Plus className="h-5 w-5" /></div>
              <div>
                <p className="font-semibold">শুধু Ads-এর জন্য নতুন প্রোডাক্ট তৈরি করুন</p>
                <p className="text-sm text-muted-foreground">ওয়েবসাইটে দেখাবে না, শুধমাত্র Ads Landing Page-এ</p>
              </div>
            </button>
          </div>
        )}

        {mode === 'existing' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">প্রোডাক্ট নির্বাচন করুন</label>
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="input-bangla">
                <option value="">প্রোডাক্ট বাছাই করুন</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name_bn || p.name_en} — {formatPrice(p.sale_price || p.regular_price)} (Stock: {p.stock})</option>)}
              </select>
            </div>
            <LandingFields landing={landing} setLanding={setLanding} />
            <MediaUploader images={images} setImages={setImages} imageUrl={imageUrl} setImageUrl={setImageUrl} uploading={uploading} setUploading={setUploading} />
            <DescriptionFields landing={landing} setLanding={setLanding} benefits={benefits} setBenefits={setBenefits} features={features} setFeatures={setFeatures} />
            <QuantityOfferEditor offers={quantityOffers} setOffers={setQuantityOffers} basePrice={Number(landing.offer_price) || 0} />
            <div className="flex gap-2">
              <button onClick={() => setMode('select')} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary">← পেছনে</button>
              <button onClick={handleCreate} disabled={loading} className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {loading ? 'তৈরি হচ্ছে...' : 'Landing Page তৈরি করুন'}
              </button>
            </div>
          </div>
        )}

        {mode === 'new' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-purple-50 p-3 text-sm text-purple-700">এই প্রোডাক্টটি শুধমাত্র Ads-এর জন্য — সাধারণ ওয়েবসাইটে প্রদর্শিত হবে না।</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-sm font-medium">নাম (বাংলা)</label><input value={newProduct.name_bn} onChange={(e) => setNewProduct({ ...newProduct, name_bn: e.target.value })} className="input-bangla" /></div>
              <div><label className="mb-1 block text-sm font-medium">নাম (English)</label><input value={newProduct.name_en} onChange={(e) => setNewProduct({ ...newProduct, name_en: e.target.value })} className="input-bangla" /></div>
              <div><label className="mb-1 block text-sm font-medium">SKU</label><input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} className="input-bangla" /></div>
              <div><label className="mb-1 block text-sm font-medium">স্টক</label><input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} className="input-bangla" /></div>
              <div><label className="mb-1 block text-sm font-medium">দাম (৳)</label><input type="number" value={newProduct.regular_price} onChange={(e) => setNewProduct({ ...newProduct, regular_price: Number(e.target.value) })} className="input-bangla" /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium">সংক্ষিপ্ত বিবরণ</label><textarea value={newProduct.short_description} onChange={(e) => setNewProduct({ ...newProduct, short_description: e.target.value })} className="input-bangla min-h-[60px]" /></div>
            <div><label className="mb-1 block text-sm font-medium">পণ্যের বিস্তারিত বিবরণ</label><textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} className="input-bangla min-h-[120px]" placeholder="🌱 পণ্যের বিস্তারিত বিবরণ লিখুন..." /></div>
            <LandingFields landing={landing} setLanding={setLanding} />
            <MediaUploader images={images} setImages={setImages} imageUrl={imageUrl} setImageUrl={setImageUrl} uploading={uploading} setUploading={setUploading} />
            <DescriptionFields landing={landing} setLanding={setLanding} benefits={benefits} setBenefits={setBenefits} features={features} setFeatures={setFeatures} />
            <QuantityOfferEditor offers={quantityOffers} setOffers={setQuantityOffers} basePrice={Number(landing.offer_price) || Number(newProduct.regular_price) || 0} />
            <div className="flex gap-2">
              <button onClick={() => setMode('select')} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary">← পেছনে</button>
              <button onClick={handleCreate} disabled={loading} className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {loading ? 'তৈরি হচ্ছে...' : 'প্রোডাক্ট ও Landing Page তৈরি করুন'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LandingFields({ landing, setLanding }: { landing: any; setLanding: (v: any) => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">Landing Page তথ্য</h3>
      <div><label className="mb-1 block text-sm font-medium">Landing Page Name</label><input value={landing.landing_name} onChange={(e) => setLanding({ ...landing, landing_name: e.target.value })} className="input-bangla" placeholder="Tomato Seed Facebook Offer August" /></div>
      <div><label className="mb-1 block text-sm font-medium">Landing Page Slug</label><input value={landing.landing_slug} onChange={(e) => setLanding({ ...landing, landing_slug: e.target.value })} className="input-bangla" placeholder="tomato-seed-offer" /></div>
      {landing.landing_slug && <p className="text-xs text-muted-foreground">URL: /offer/{landing.landing_slug}</p>}
      <div><label className="mb-1 block text-sm font-medium">টাইটেল</label><input value={landing.title} onChange={(e) => setLanding({ ...landing, title: e.target.value })} className="input-bangla" /></div>
      <div><label className="mb-1 block text-sm font-medium">সাবটাইটেল</label><input value={landing.subtitle} onChange={(e) => setLanding({ ...landing, subtitle: e.target.value })} className="input-bangla" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="mb-1 block text-sm font-medium">Compare Price (৳)</label><input type="number" value={landing.compare_price} onChange={(e) => setLanding({ ...landing, compare_price: e.target.value })} className="input-bangla" /></div>
        <div><label className="mb-1 block text-sm font-medium">Offer Price (৳)</label><input type="number" value={landing.offer_price} onChange={(e) => setLanding({ ...landing, offer_price: e.target.value })} className="input-bangla" /></div>
      </div>
      <div><label className="mb-1 block text-sm font-medium">CTA Text</label><input value={landing.cta_text} onChange={(e) => setLanding({ ...landing, cta_text: e.target.value })} className="input-bangla" /></div>
      <div><label className="mb-1 block text-sm font-medium">Status</label>
        <select value={landing.status} onChange={(e) => setLanding({ ...landing, status: e.target.value })} className="input-bangla">
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>
  );
}

function QuantityOfferEditor({ offers, setOffers, basePrice }: { offers: any[]; setOffers: (o: any[]) => void; basePrice: number }) {
  const addOffer = () => {
    setOffers([...offers, { quantity: offers.length + 1, offer_price: '', compare_price: '', badge: '', free_delivery: true, is_default_selected: false }]);
  };
  const removeOffer = (idx: number) => setOffers(offers.filter((_, i) => i !== idx));
  const updateOffer = (idx: number, field: string, value: any) => {
    const updated = [...offers];
    updated[idx] = { ...updated[idx], [field]: value };
    setOffers(updated);
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary">পরিমাণ অনুযায়ী অফার মূল্য</h3>
        <button type="button" onClick={addOffer} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> নতুন পরিমাণ যোগ করুন
        </button>
      </div>
      <p className="text-xs text-muted-foreground">প্রতিটি পরিমাণের জন্য আলাদা মূল্য নির্ধারণ করুন। দাম স্বয়ংক্রিয়ভাবে গণনা করা হবে না — আপনি যা লিখবেন ঠিক তাই চার্জ হবে।</p>
      <div className="space-y-2">
        {offers.map((qo, idx) => {
          const offer = Number(qo.offer_price) || 0;
          const compare = Number(qo.compare_price) || (basePrice * (Number(qo.quantity) || 1));
          const savings = compare > offer ? compare - offer : 0;
          const percent = compare > 0 ? Math.round((savings / compare) * 100) : 0;
          return (
            <div key={idx} className="rounded-lg border border-border bg-background p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <label className="mb-0.5 block text-xs text-muted-foreground">পরিমাণ</label>
                  <input type="number" min="1" value={qo.quantity} onChange={(e) => updateOffer(idx, 'quantity', e.target.value)} className="w-full rounded-lg border border-input px-2 py-1.5 text-sm" placeholder="1" />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs text-muted-foreground">সাধারণ মূল্য (৳)</label>
                  <input type="number" value={qo.compare_price} onChange={(e) => updateOffer(idx, 'compare_price', e.target.value)} className="w-full rounded-lg border border-input px-2 py-1.5 text-sm" placeholder="500" />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs text-muted-foreground">অফার মূল্য (৳)</label>
                  <input type="number" value={qo.offer_price} onChange={(e) => updateOffer(idx, 'offer_price', e.target.value)} className="w-full rounded-lg border border-input px-2 py-1.5 text-sm" placeholder="300" />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs text-muted-foreground">Badge</label>
                  <input value={qo.badge} onChange={(e) => updateOffer(idx, 'badge', e.target.value)} className="w-full rounded-lg border border-input px-2 py-1.5 text-sm" placeholder="BEST" />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={qo.free_delivery} onChange={(e) => updateOffer(idx, 'free_delivery', e.target.checked)} className="accent-primary" /> Free Delivery</label>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={qo.is_default_selected} onChange={(e) => {
                  const updated = offers.map((o, i) => ({ ...o, is_default_selected: i === idx }));
                  setOffers(updated);
                }} className="accent-primary" /> Default Selected</label>
                {savings > 0 && <span className="text-xs font-medium text-green-600">সাশ্রয় {formatPrice(savings)} ({percent}%)</span>}
                <div className="flex-1" />
                <button type="button" onClick={() => removeOffer(idx)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> মুছুন
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MediaUploader({ images, setImages, imageUrl, setImageUrl, uploading, setUploading }: {
  images: string[]; setImages: (v: string[]) => void;
  imageUrl: string; setImageUrl: (v: string) => void;
  uploading: boolean; setUploading: (v: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const newImages: string[] = [];
      for (const file of Array.from(files)) {
        const processed = await processLocalImage(file);
        const url = await uploadProcessedFile(processed, 'product-images', supabase);
        newImages.push(url);
      }
      setImages([...images, ...newImages]);
      if (newImages.length > 0) toast(`${newImages.length} টি ছবি প্রসেস ও আপলোড হয়েছে`);
    } catch (err: any) { toast(`আপলোড ব্যর্থ: ${err.message}`, 'error'); }
    finally { setUploading(false); }
  };

  const addUrlImage = async () => {
    if (!imageUrl.trim()) return;
    setUploading(true);
    try {
      const processed = await processUrlImage(imageUrl.trim());
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      setImages([...images, url]);
      setImageUrl('');
      toast('ছবি ইম্পোর্ট ও ওয়াটারমার্ক হয়েছে');
    } catch (err: any) { toast(`ইম্পোর্ট ব্যর্থ: ${err.message}`, 'error'); }
    finally { setUploading(false); }
  };

  const removeImage = (idx: number) => setImages(images.filter((_, i) => i !== idx));
  const setMain = (idx: number) => {
    const updated = [...images];
    const [img] = updated.splice(idx, 1);
    updated.unshift(img);
    setImages(updated);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">পণ্যের ছবি</h3>
      <p className="text-xs text-muted-foreground">Recommended: 800 × 800 px — Best for display</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Upload className="h-4 w-4" /> {uploading ? 'আপলোড হচ্ছে...' : 'ডিভাইস থেকে ছবি আপলোড করুন'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }} />
        <div className="flex flex-1 gap-1">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1 rounded-lg border border-input px-3 py-2 text-sm" placeholder="অথবা ছবি URL দিন" />
          <button type="button" onClick={addUrlImage} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"><LinkIcon className="h-4 w-4" /> যোগ করুন</button>
        </div>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((img, idx) => (
            <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/20">
              <img src={img} alt="" className="h-full w-full object-cover" />
              {idx === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Main</span>}
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {idx !== 0 && <button type="button" onClick={() => setMain(idx)} className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Main</button>}
                <button type="button" onClick={() => removeImage(idx)} className="rounded bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DescriptionFields({ landing, setLanding, benefits, setBenefits, features, setFeatures }: {
  landing: any; setLanding: (v: any) => void;
  benefits: string[]; setBenefits: (v: string[]) => void;
  features: string[]; setFeatures: (v: string[]) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">পণ্যের বিবরণ ও বৈশিষ্ট্য</h3>
      <div>
        <label className="mb-1 block text-sm font-medium">পণ্যের বিস্তারিত বিবরণ (Landing Page Description)</label>
        <textarea value={landing.description} onChange={(e) => setLanding({ ...landing, description: e.target.value })} className="input-bangla min-h-[120px]" placeholder="🌱 পণ্যের বিস্তারিত বিবরণ লিখুন... (এন্টার দিয়ে নতুন লাইন তৈরি করুন)" />
        <p className="mt-1 text-xs text-muted-foreground">এন্টার দিয়ে নতুন লাইন, প্যারাগ্রাফ, ✅ চিহ্ন, ইমোজি — সব ফরম্যাটিং সংরক্ষিত থাকবে।</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Product Benefits</label>
        <div className="space-y-2">
          {benefits.map((b, idx) => (
            <div key={idx} className="flex gap-1">
              <input value={b} onChange={(e) => setBenefits(benefits.map((item, i) => i === idx ? e.target.value : item))} className="input-bangla" placeholder="✓ উন্নত মানের বীজ" />
              <button type="button" onClick={() => setBenefits(benefits.filter((_, i) => i !== idx))} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setBenefits([...benefits, ''])} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-4 w-4" /> নতুন Feature যোগ করুন</button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Product Features</label>
        <div className="space-y-2">
          {features.map((f, idx) => (
            <div key={idx} className="flex gap-1">
              <input value={f} onChange={(e) => setFeatures(features.map((item, i) => i === idx ? e.target.value : item))} className="input-bangla" placeholder="উন্নত জাত" />
              <button type="button" onClick={() => setFeatures(features.filter((_, i) => i !== idx))} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setFeatures([...features, ''])} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-4 w-4" /> নতুন Feature যোগ করুন</button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Trust Text</label>
        <input value={landing.trust_text} onChange={(e) => setLanding({ ...landing, trust_text: e.target.value })} className="input-bangla" placeholder="✅ উচ্চ গুণমানের পণ্য" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">COD Text</label>
        <input value={landing.cod_text} onChange={(e) => setLanding({ ...landing, cod_text: e.target.value })} className="input-bangla" placeholder="📦 অর্ডার করার পর আমরা আপনাকে কল করে জানিয়ে দেব" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Delivery Text</label>
        <input value={landing.delivery_text} onChange={(e) => setLanding({ ...landing, delivery_text: e.target.value })} className="input-bangla" placeholder="🚚 সারাদেশে হোম ডেলিভারি" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Growing Guide / চাষের নির্দেশনা</label>
        <textarea value={landing.growing_guide} onChange={(e) => setLanding({ ...landing, growing_guide: e.target.value })} className="input-bangla min-h-[80px]" />
      </div>
    </div>
  );
}
