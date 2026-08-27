'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from '@/components/site/toast-provider';
import { Save, Sparkles, Zap, Users, Upload, Image as ImageIcon } from 'lucide-react';
import { AI_PROVIDER_OPTIONS, AI_FEATURE_FLAG_LIST, maskApiKey, isApiKeyMasked, DEFAULT_FEATURE_FLAGS } from '@/lib/ai';

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<'general' | 'marketing' | 'features' | 'integrations' | 'ai' | 'referral'>('general');
  const [siteForm, setSiteForm] = useState<any>(null);
  const [marketingForm, setMarketingForm] = useState<any>(null);
  const [aiForm, setAiForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [aiKeyEdited, setAiKeyEdited] = useState(false);
  const [referralForm, setReferralForm] = useState<any>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('marketing_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('ai_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('referral_settings').select('*').eq('id', 1).maybeSingle(),
    ]).then(([site, mkt, ai, ref]) => {
      setSiteForm(site.data || {});
      setMarketingForm(mkt.data || {});
      const aiData = ai.data || {};
      setAiForm({
        ...aiData,
        api_key: aiData.api_key ? maskApiKey(aiData.api_key) : '',
        feature_flags: { ...DEFAULT_FEATURE_FLAGS, ...(aiData.feature_flags || {}) },
      });
      setReferralForm(ref.data || { enabled: false, reward_type: 'fixed', reward_value: 0, min_order_amount: 0, max_reward_per_referral: null, terms: '' });
      setLoading(false);
    });
  }, []);

  const uploadLogo = async (file: File) => {
    setSaving(true);
    const ext = file.name.split('.').pop() || 'png';
    const path = `site-logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false });
    if (!error) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      setSiteForm({ ...siteForm, logo: data.publicUrl, logo_url: data.publicUrl });
      toast('লোগো আপলোড হয়েছে');
    } else toast(`আপলোড ব্যর্থ: ${error.message}`, 'error');
    setSaving(false);
  };

  const uploadWatermarkLogo = async (file: File) => {
    setSaving(true);
    const ext = file.name.split('.').pop() || 'png';
    const path = `watermark-logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false });
    if (!error) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      setSiteForm({ ...siteForm, watermark_logo_url: data.publicUrl });
      toast('ওয়াটারমার্ক লোগো আপলোড হয়েছে');
    } else toast(`আপলোড ব্যর্থ: ${error.message}`, 'error');
    setSaving(false);
  };

  const saveSite = async () => {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({
      ...siteForm,
      watermark_logo_url: siteForm.watermark_logo_url || null,
    }).eq('id', 1);
    setSaving(false);
    if (error) { toast('সেভ ব্যর্থ', 'error'); return; }
    toast('সেটিংস সেভ হয়েছে');
  };

  const saveMarketing = async () => {
    setSaving(true);
    const { error } = await supabase.from('marketing_settings').update(marketingForm).eq('id', 1);
    setSaving(false);
    if (error) { toast('সেভ ব্যর্থ', 'error'); return; }
    toast('মার্কেটিং সেটিংস সেভ হয়েছে');
  };

  const saveAI = async () => {
    setSaving(true);
    setAiTestResult(null);
    const payload: Record<string, unknown> = {
      is_enabled: aiForm.is_enabled ?? false,
      provider: aiForm.provider || 'openai',
      model: aiForm.model || '',
      base_url: aiForm.base_url || '',
      temperature: aiForm.temperature ?? null,
      max_tokens: aiForm.max_tokens ?? null,
      feature_flags: aiForm.feature_flags,
    };
    if (aiKeyEdited && aiForm.api_key && !isApiKeyMasked(aiForm.api_key)) {
      payload.api_key = aiForm.api_key;
    }
    const { error } = await supabase.from('ai_settings').update(payload).eq('id', 1);
    setSaving(false);
    if (error) { toast('AI settings save failed', 'error'); return; }
    toast('AI settings saved');
    setAiKeyEdited(false);
  };

  const saveReferral = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      enabled: referralForm.enabled ?? false,
      reward_type: referralForm.reward_type || 'fixed',
      reward_value: Number(referralForm.reward_value) || 0,
      min_order_amount: Number(referralForm.min_order_amount) || 0,
      max_reward_per_referral: referralForm.max_reward_per_referral ? Number(referralForm.max_reward_per_referral) : null,
      terms: referralForm.terms || null,
      updated_by: userData.user?.id || null,
    };
    const { error } = await supabase.from('referral_settings').update(payload).eq('id', 1);
    setSaving(false);
    if (error) { toast('সেভ ব্যর্থ', 'error'); return; }
    toast('রেফারেল সেটিংস সেভ হয়েছে');
  };

  const testAI = async () => {
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const apiKey = aiKeyEdited ? aiForm.api_key : '';
      if (!apiKey || isApiKeyMasked(apiKey)) {
        setAiTestResult('Please enter a valid API key to test (not masked)');
        setTestingAI(false);
        return;
      }
      const res = await fetch('/api/ai-test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiForm.provider,
          api_key: apiKey,
          model: aiForm.model,
          base_url: aiForm.base_url,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiTestResult(`Success: ${data.message}`);
      } else {
        setAiTestResult(`Failed: ${data.message}`);
      }
    } catch (err) {
      setAiTestResult(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setTestingAI(false);
  };

  if (loading || !siteForm) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">সেটিংস</h1>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('general')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'general' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}>সাধারণ</button>
        <button onClick={() => setTab('marketing')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'marketing' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}>মার্কেটিং</button>
        <button onClick={() => setTab('features')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'features' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}>ফিচার টগল</button>
        <button onClick={() => setTab('integrations')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'integrations' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}>ইন্টিগ্রেশন</button>
        <button onClick={() => setTab('ai')} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${tab === 'ai' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}><Sparkles className="h-4 w-4" /> AI</button>
        <button onClick={() => setTab('referral')} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${tab === 'referral' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}><Users className="h-4 w-4" /> রেফারেল</button>
      </div>

      {tab === 'general' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <div><label className="mb-1 block text-sm font-medium">ওয়েবসাইট নাম</label><input value={siteForm.website_name || ''} onChange={(e) => setSiteForm({ ...siteForm, website_name: e.target.value })} className="input-bangla" /></div>
          <div>
            <label className="mb-1 block text-sm font-medium">লোগো URL</label>
            <p className="mb-1 text-xs text-muted-foreground">Recommended: 800 × 240 px — Best for display</p>
            <div className="flex gap-2">
              <input value={siteForm.logo || siteForm.logo_url || ''} onChange={(e) => setSiteForm({ ...siteForm, logo: e.target.value, logo_url: e.target.value })} className="input-bangla flex-1" placeholder="https://..." />
              <button type="button" onClick={() => logoInputRef.current?.click()} className="rounded-lg border border-border px-3 text-sm hover:bg-secondary font-medium">লোকাল আপলোড</button>
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]); e.target.value = ''; }} />
            {(siteForm.logo || siteForm.logo_url) && <img src={siteForm.logo || siteForm.logo_url} alt="Logo preview" className="mt-2 h-12 max-w-[220px] object-contain rounded border border-border/50 p-1" />}
          </div>

          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">ইমেজ ব্র্যান্ডিং ওয়াটারমার্ক</h3>
                <p className="text-xs text-muted-foreground">ছবিতে ব্র্যান্ড লোগো ওয়াটারমার্ক প্রয়োগ হবে</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={siteForm.watermark_enabled ?? true} onChange={(e) => setSiteForm({ ...siteForm, watermark_enabled: e.target.checked })} className="h-5 w-5 accent-primary" /> চালু
              </label>
            </div>

            {/* ওয়াটারমার্ক লাইভ প্রিভিউ */}
            <div className="mb-3 flex items-center gap-3 rounded-lg bg-background p-3 border border-border">
              {siteForm.watermark_logo_url ? (
                <img src={siteForm.watermark_logo_url} alt="Watermark Preview" className="h-10 max-w-[180px] object-contain" />
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ImageIcon className="h-4 w-4" /> কোনো ওয়াটারমার্ক লোগো সেট করা নেই
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">লোগো URL বা লোকাল আপলোড</label>
                <div className="flex gap-2">
                  <input 
                    value={siteForm.watermark_logo_url || ''} 
                    onChange={(e) => setSiteForm({ ...siteForm, watermark_logo_url: e.target.value })} 
                    className="input-bangla flex-1" 
                    placeholder="লোগোর URL পেস্ট করুন অথবা লোকাল আপলোড করুন" 
                  />
                  <button 
                    type="button" 
                    onClick={() => watermarkInputRef.current?.click()} 
                    className="flex items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary shrink-0"
                  >
                    <Upload className="h-3.5 w-3.5" /> লোকাল আপলোড
                  </button>
                </div>
                <input 
                  ref={watermarkInputRef} 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => { if (e.target.files?.[0]) uploadWatermarkLogo(e.target.files[0]); e.target.value = ''; }} 
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">অবস্থান</label>
                <input value="Center" readOnly className="input-bangla bg-secondary/40" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">স্বচ্ছতা: {Math.round((siteForm.watermark_opacity ?? 0.25) * 100)}%</label>
                <input type="range" min="0.05" max="0.7" step="0.05" value={siteForm.watermark_opacity ?? 0.25} onChange={(e) => setSiteForm({ ...siteForm, watermark_opacity: Number(e.target.value) })} className="w-full accent-primary" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">লোগোর আকার: {Math.round((siteForm.watermark_size ?? 0.3) * 100)}%</label>
                <input type="range" min="0.1" max="0.6" step="0.05" value={siteForm.watermark_size ?? 0.3} onChange={(e) => setSiteForm({ ...siteForm, watermark_size: Number(e.target.value) })} className="w-full accent-primary" />
              </div>
            </div>
          </div>

          <div><label className="mb-1 block text-sm font-medium">ফেভিকন URL</label><input value={siteForm.favicon || ''} onChange={(e) => setSiteForm({ ...siteForm, favicon: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">ফোন</label><input value={siteForm.phone || ''} onChange={(e) => setSiteForm({ ...siteForm, phone: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">WhatsApp</label><input value={siteForm.whatsapp || ''} onChange={(e) => setSiteForm({ ...siteForm, whatsapp: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">ইমেইল</label><input value={siteForm.email || ''} onChange={(e) => setSiteForm({ ...siteForm, email: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">ঠিকানা</label><textarea value={siteForm.address || ''} onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          <div><label className="mb-1 block text-sm font-medium">ব্যবসায়িক সময়</label><input value={siteForm.business_hours || ''} onChange={(e) => setSiteForm({ ...siteForm, business_hours: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Facebook URL</label><input value={siteForm.facebook || ''} onChange={(e) => setSiteForm({ ...siteForm, facebook: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Instagram URL</label><input value={siteForm.instagram || ''} onChange={(e) => setSiteForm({ ...siteForm, instagram: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">YouTube URL</label><input value={siteForm.youtube || ''} onChange={(e) => setSiteForm({ ...siteForm, youtube: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">TikTok URL</label><input value={siteForm.tiktok || ''} onChange={(e) => setSiteForm({ ...siteForm, tiktok: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">WhatsApp মেসেজ</label><textarea value={siteForm.whatsapp_message || ''} onChange={(e) => setSiteForm({ ...siteForm, whatsapp_message: e.target.value })} className="input-bangla min-h-[60px]" /></div>
          <div>
            <label className="mb-1 block text-sm font-medium">Default Homepage Theme</label>
            <select value={siteForm.homepage_theme || 'theme1'} onChange={(e) => setSiteForm({ ...siteForm, homepage_theme: e.target.value })} className="input-bangla">
              <option value="theme1">Theme 1 — Classic</option>
              <option value="theme2">Theme 2 — Modern</option>
              <option value="theme3">Theme 3 — Bold</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={siteForm.whatsapp_enabled ?? true} onChange={(e) => setSiteForm({ ...siteForm, whatsapp_enabled: e.target.checked })} className="accent-primary" /> WhatsApp বাটন সক্রিয়</label>
          <button onClick={saveSite} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"><Save className="h-4 w-4" /> সেভ করুন</button>
        </div>
      )}

      {tab === 'marketing' && marketingForm && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <div><label className="mb-1 block text-sm font-medium">Meta Pixel ID</label><input value={marketingForm.meta_pixel_id || ''} onChange={(e) => setMarketingForm({ ...marketingForm, meta_pixel_id: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">GA4 Measurement ID</label><input value={marketingForm.ga4_measurement_id || ''} onChange={(e) => setMarketingForm({ ...marketingForm, ga4_measurement_id: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">Google Tag Manager ID</label><input value={marketingForm.gtm_id || ''} onChange={(e) => setMarketingForm({ ...marketingForm, gtm_id: e.target.value })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">TikTok Pixel ID</label><input value={marketingForm.tiktok_pixel_id || ''} onChange={(e) => setMarketingForm({ ...marketingForm, tiktok_pixel_id: e.target.value })} className="input-bangla" /></div>
          <button onClick={saveMarketing} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"><Save className="h-4 w-4" /> সেভ করুন</button>
        </div>
      )}

      {tab === 'features' && (
        <div className="max-w-2xl space-y-3 rounded-2xl border border-border bg-card p-6">
          {[
            { key: 'enable_variants', label: 'ভেরিয়েন্ট' },
            { key: 'enable_bundles', label: 'বান্ডল' },
            { key: 'enable_combos', label: 'কম্বো' },
            { key: 'enable_free_gifts', label: 'ফ্রি গিফট' },
            { key: 'enable_bulk_pricing', label: 'হোলসেল প্রাইসিং' },
            { key: 'enable_seasonal_finder', label: 'মৌসুমি সিড ফাইন্ডার' },
            { key: 'enable_recently_viewed', label: 'সম্প্রতি দেখেছেন' },
            { key: 'enable_wishlist', label: 'উইশলিস্ট' },
            { key: 'enable_coupons', label: 'কুপন' },
            { key: 'enable_order_again', label: 'আবার কিনুন' },
            { key: 'enable_support_tickets', label: 'সাপোর্ট টিকেট' },
            { key: 'enable_low_stock_msg', label: 'কাস্টমার লো স্টক মেসেজ' },
            { key: 'enable_guides', label: 'গাইড' },
            { key: 'enable_photo_reviews', label: 'ফটো রিভিউ' },
            { key: 'enable_reward_points', label: 'রিওয়ার্ড পয়েন্ট (ভবিষ্যৎ)' },
            { key: 'enable_referral', label: 'রেফারেল (ভবিষ্যৎ)' },
            { key: 'enable_abandoned_checkout', label: 'অ্যাবন্ডনড চেকআউট (ভবিষ্যৎ)' },
            { key: 'enable_online_payment', label: 'অনলাইন পেমেন্ট (ভবিষ্যৎ)' },
            { key: 'enable_courier', label: 'কুরিয়ার (ভবিষ্যৎ)' },
            { key: 'enable_sms', label: 'SMS (ভবিষ্যৎ)' },
            { key: 'enable_whatsapp_api', label: 'WhatsApp API (ভবিষ্যৎ)' },
            { key: 'enable_adsense', label: 'AdSense' },
          ].map((f) => (
            <label key={f.key} className="flex items-center justify-between rounded-lg bg-secondary/20 p-3">
              <span className="text-sm font-medium">{f.label}</span>
              <input type="checkbox" checked={siteForm[f.key] ?? false} onChange={(e) => setSiteForm({ ...siteForm, [f.key]: e.target.checked })} className="h-5 w-5 accent-primary" />
            </label>
          ))}
          <div><label className="mb-1 block text-sm font-medium">ডুপ্লিকেট অর্ডার সতর্কতা (ঘণ্টা)</label><input type="number" value={siteForm.duplicate_order_hours ?? 24} onChange={(e) => setSiteForm({ ...siteForm, duplicate_order_hours: Number(e.target.value) })} className="input-bangla" /></div>
          <div><label className="mb-1 block text-sm font-medium">AdSense Client ID</label><input value={siteForm.adsense_client_id || ''} onChange={(e) => setSiteForm({ ...siteForm, adsense_client_id: e.target.value })} className="input-bangla" placeholder="ca-pub-XXXX" /></div>
          <div><label className="mb-1 block text-sm font-medium">AdSense Slot ID</label><input value={siteForm.adsense_slot_id || ''} onChange={(e) => setSiteForm({ ...siteForm, adsense_slot_id: e.target.value })} className="input-bangla" /></div>
          <button onClick={saveSite} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"><Save className="h-4 w-4" /> সেভ করুন</button>
        </div>
      )}

      {tab === 'integrations' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">কুরিয়ার</h3>
          <div><label className="mb-1 block text-sm font-medium">কুরিয়ার প্রোভাইডার</label><input value={siteForm.courier_provider || ''} onChange={(e) => setSiteForm({ ...siteForm, courier_provider: e.target.value })} className="input-bangla" placeholder="Future" /></div>
          <div><label className="mb-1 block text-sm font-medium">কুরিয়ার API Key</label><input value={siteForm.courier_api_key || ''} onChange={(e) => setSiteForm({ ...siteForm, courier_api_key: e.target.value })} className="input-bangla" placeholder="Future" /></div>
          <h3 className="mt-4 font-semibold">SMS</h3>
          <div><label className="mb-1 block text-sm font-medium">SMS প্রোভাইডার</label><input value={siteForm.sms_provider || ''} onChange={(e) => setSiteForm({ ...siteForm, sms_provider: e.target.value })} className="input-bangla" placeholder="Future" /></div>
          <div><label className="mb-1 block text-sm font-medium">SMS API Key</label><input value={siteForm.sms_api_key || ''} onChange={(e) => setSiteForm({ ...siteForm, sms_api_key: e.target.value })} className="input-bangla" placeholder="Future" /></div>
          <h3 className="mt-4 font-semibold">WhatsApp API</h3>
          <div><label className="mb-1 block text-sm font-medium">WhatsApp API Key</label><input value={siteForm.whatsapp_api_key || ''} onChange={(e) => setSiteForm({ ...siteForm, whatsapp_api_key: e.target.value })} className="input-bangla" placeholder="Future" /></div>
          <h3 className="mt-4 font-semibold">পেমেন্ট গেটওয়ে</h3>
          <div><label className="mb-1 block text-sm font-medium">পেমেন্ট প্রোভাইডার</label><input value={siteForm.payment_provider || ''} onChange={(e) => setSiteForm({ ...siteForm, payment_provider: e.target.value })} className="input-bangla" placeholder="Future" /></div>
          <div><label className="mb-1 block text-sm font-medium">পেমেন্ট API Key</label><input value={siteForm.payment_api_key || ''} onChange={(e) => setSiteForm({ ...siteForm, payment_api_key: e.target.value })} className="input-bangla" placeholder="Future" /></div>
          <h3 className="mt-4 font-semibold">Google Ads</h3>
          <div><label className="mb-1 block text-sm font-medium">Google Ads ID</label><input value={siteForm.google_ads_id || ''} onChange={(e) => setSiteForm({ ...siteForm, google_ads_id: e.target.value })} className="input-bangla" placeholder="AW-XXXX" /></div>
          <p className="text-xs text-muted-foreground">এই ফিল্ডগুলো ভবিষ্যৎ ইন্টিগ্রেশনের জন্য। এখন কোন API কানেক্ট করা হবে না।</p>
          <button onClick={saveSite} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"><Save className="h-4 w-4" /> সেভ করুন</button>
        </div>
      )}

      {tab === 'ai' && aiForm && (
        <div className="max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary" /> AI Integration</h3>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={aiForm.is_enabled ?? false} onChange={(e) => setAiForm({ ...aiForm, is_enabled: e.target.checked })} className="h-5 w-5 accent-primary" />
              AI System ON
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Provider</label>
            <select value={aiForm.provider || 'openai'} onChange={(e) => setAiForm({ ...aiForm, provider: e.target.value })} className="input-bangla">
              {AI_PROVIDER_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">API Key</label>
            <input type="password" value={aiForm.api_key || ''} onChange={(e) => { setAiForm({ ...aiForm, api_key: e.target.value }); setAiKeyEdited(true); }} placeholder="Enter API key" className="input-bangla" />
            <p className="mt-1 text-xs text-muted-foreground">Stored securely server-side. Never exposed to frontend.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Model</label>
            <input value={aiForm.model || ''} onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })} placeholder="e.g. gpt-4o-mini, gemini-1.5-flash, claude-sonnet-4-20250514" className="input-bangla" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Base URL (optional)</label>
            <input value={aiForm.base_url || ''} onChange={(e) => setAiForm({ ...aiForm, base_url: e.target.value })} placeholder="For compatible/custom providers" className="input-bangla" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Temperature (optional)</label>
              <input type="number" step="0.1" min="0" max="2" value={aiForm.temperature ?? ''} onChange={(e) => setAiForm({ ...aiForm, temperature: e.target.value ? Number(e.target.value) : null })} className="input-bangla" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Max Tokens (optional)</label>
              <input type="number" value={aiForm.max_tokens ?? ''} onChange={(e) => setAiForm({ ...aiForm, max_tokens: e.target.value ? Number(e.target.value) : null })} className="input-bangla" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={testAI} disabled={testingAI} className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50 cursor-pointer"><Zap className="h-4 w-4" /> {testingAI ? 'Testing...' : 'Test Connection'}</button>
            <button onClick={saveAI} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"><Save className="h-4 w-4" /> Save Settings</button>
          </div>

          {aiTestResult && (
            <div className={`rounded-lg p-3 text-sm ${aiTestResult.startsWith('Success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{aiTestResult}</div>
          )}

          <div className="border-t border-border pt-4">
            <h4 className="mb-3 text-sm font-semibold text-muted-foreground">Future AI Module Flags (all OFF by default)</h4>
            <div className="space-y-2">
              {AI_FEATURE_FLAG_LIST.map((f) => (
                <label key={f.key} className="flex items-center justify-between rounded-lg bg-secondary/20 p-3">
                  <span className="text-sm font-medium">{f.label}</span>
                  <input type="checkbox" checked={aiForm.feature_flags?.[f.key] ?? false} onChange={(e) => setAiForm({ ...aiForm, feature_flags: { ...aiForm.feature_flags, [f.key]: e.target.checked } })} className="h-5 w-5 accent-primary" />
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">These flags prepare the architecture for future AI features. No AI features are implemented yet.</p>
          </div>
        </div>
      )}

      {tab === 'referral' && referralForm && (
        <div className="max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-primary" /> রেফারেল প্রোগ্রাম</h3>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={referralForm.enabled ?? false} onChange={(e) => setReferralForm({ ...referralForm, enabled: e.target.checked })} className="h-5 w-5 accent-primary" />
              {referralForm.enabled ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
            </label>
          </div>
          <p className="text-xs text-muted-foreground">ডিফল্ট: বন্ধ। চালু করলে কাস্টমার ড্যাশবোর্ডে রেফারেল সেকশন দেখাবে।</p>

          <div>
            <label className="mb-1 block text-sm font-medium">রিওয়ার্ড টাইপ</label>
            <select value={referralForm.reward_type || 'fixed'} onChange={(e) => setReferralForm({ ...referralForm, reward_type: e.target.value })} className="input-bangla">
              <option value="fixed">নির্দিষ্ট পরিমাণ (Fixed Amount)</option>
              <option value="percentage">শতকরা (Percentage)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">রিওয়ার্ড ভ্যালু {referralForm.reward_type === 'percentage' ? '(%)' : '(৳)'}</label>
            <input type="number" min="0" step="0.01" value={referralForm.reward_value ?? 0} onChange={(e) => setReferralForm({ ...referralForm, reward_value: e.target.value })} className="input-bangla" />
            <p className="mt-1 text-xs text-muted-foreground">{referralForm.reward_type === 'percentage' ? 'শতকরা হার (যেমন ১০ = ১০%)' : 'নির্দিষ্ট পরিমাণ (৳)'}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ন্যূনতম যোগ্য অর্ডার পরিমাণ (৳)</label>
            <input type="number" min="0" step="0.01" value={referralForm.min_order_amount ?? 0} onChange={(e) => setReferralForm({ ...referralForm, min_order_amount: e.target.value })} className="input-bangla" />
            <p className="mt-1 text-xs text-muted-foreground">রেফারেল রিওয়ার্ডের জন্য প্রয়োজনীয় ন্যূনতম অর্ডার মূল্য</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">সর্বোচ্চ রিওয়ার্ড (৳) <span className="text-muted-foreground">(ঐচ্ছিক)</span></label>
            <input type="number" min="0" step="0.01" value={referralForm.max_reward_per_referral ?? ''} onChange={(e) => setReferralForm({ ...referralForm, max_reward_per_referral: e.target.value })} className="input-bangla" placeholder="সর্বোচ্চ সীমা নেই" />
            <p className="mt-1 text-xs text-muted-foreground">প্রতি রেফারেলে সর্বোচ্চ রিওয়ার্ড সীমা (ঐচ্ছিক)</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">রেফারেল শর্তাবলী / বিবরণ</label>
            <textarea value={referralForm.terms || ''} onChange={(e) => setReferralForm({ ...referralForm, terms: e.target.value })} className="input-bangla min-h-[100px]" placeholder="রেফারেল প্রোগ্রামের শর্তাবলী লিখুন" />
          </div>

          <button onClick={saveReferral} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"><Save className="h-4 w-4" /> সেভ করুন</button>
        </div>
      )}
    </div>
  );
}
