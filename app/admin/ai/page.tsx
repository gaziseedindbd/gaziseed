'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Play, Loader2, BarChart3, ShoppingCart, Package, Megaphone, Target, MessageCircle, Sprout, Search, CircleAlert, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

const modules = [
  { key: 'business_analysis', label: 'Business Analysis', icon: BarChart3, hint: 'ব্যবসার সামগ্রিক performance বিশ্লেষণ' },
  { key: 'sales_analysis', label: 'Sales Analysis', icon: ShoppingCart, hint: 'Sales trend, revenue ও best sellers' },
  { key: 'inventory_assistant', label: 'Inventory Assistant', icon: Package, hint: 'Stock ও reorder risk বিশ্লেষণ' },
  { key: 'marketing_assistant', label: 'Marketing Assistant', icon: Megaphone, hint: 'Marketing insight ও campaign ideas' },
  { key: 'ads_assistant', label: 'Facebook/Instagram Ads Assistant', icon: Target, hint: 'Available ad/source data বিশ্লেষণ' },
  { key: 'customer_support_ai', label: 'Customer Support AI', icon: MessageCircle, hint: 'Customer প্রশ্নের উত্তর তৈরি' },
  { key: 'seed_expert', label: 'Seed Expert', icon: Sprout, hint: 'GAZI SEED product catalogue ভিত্তিক guidance' },
  { key: 'seo_aeo_assistant', label: 'SEO/AEO Assistant', icon: Search, hint: 'Product SEO, FAQ ও AEO content' },
] as const;

export default function AdminAIPage() {
  const [module, setModule] = useState<(typeof modules)[number]['key']>('business_analysis');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [configState, setConfigState] = useState<{
    loading: boolean;
    country: 'BD' | 'IN';
    enabled: boolean;
    keyConfigured: boolean;
  }>({ loading: true, country: 'BD', enabled: false, keyConfigured: false });

  useEffect(() => {
    const loadConfig = async () => {
      const { data: countryData, error: countryError } = await supabase.rpc('current_admin_country');
      if (countryError) {
        setConfigState((current) => ({ ...current, loading: false }));
        return;
      }

      const country: 'BD' | 'IN' =
        String(countryData || '').toUpperCase() === 'IN' ? 'IN' : 'BD';

      const { data, error } = await supabase
        .from('ai_settings')
        .select('is_enabled,api_key_secret_id')
        .eq('id', 1)
        .eq('country_code', country)
        .maybeSingle();

      if (error || !data) {
        setConfigState({ loading: false, country, enabled: false, keyConfigured: false });
        return;
      }

      setConfigState({
        loading: false,
        country,
        enabled: Boolean(data.is_enabled),
        keyConfigured: Boolean(data.api_key_secret_id),
      });
    };

    void loadConfig();
  }, []);

  const genericAIReady =
    !configState.loading && configState.enabled && configState.keyConfigured;

  async function runModule() {
    setRunning(true); setResult(''); setStatus('Running...');
    try {
      const res = await fetch('/api/ai/module', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module, prompt }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'AI module failed');
      setResult(data.result || 'No result returned.');
      setStatus(`Completed • ${data.model || 'AI'}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'AI module failed');
    } finally { setRunning(false); }
  }

  const active = modules.find((m) => m.key === module)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6 text-primary" /> GAZI SEED AI Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Generic AI modules are branch-specific and separate from the live Facebook Messenger AI runtime.</p>
      </div>

      <div className={`rounded-2xl border p-4 ${genericAIReady ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-start gap-3">
          {genericAIReady ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-700" /> : <CircleAlert className="mt-0.5 h-5 w-5 text-amber-700" />}
          <div>
            <p className={`font-semibold ${genericAIReady ? 'text-green-800' : 'text-amber-900'}`}>
              {configState.loading
                ? 'Checking Generic AI configuration…'
                : genericAIReady
                  ? `Generic AI ready for ${configState.country}`
                  : `Generic AI not configured for ${configState.country}`}
            </p>
            {!configState.loading && !genericAIReady ? (
              <p className="mt-1 text-sm text-amber-800">
                Add a Generic AI provider key in Settings → AI and enable Generic AI Modules before running these tools. This does not affect Facebook Messenger AI.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          {modules.map((item) => {
            const Icon = item.icon;
            return <button key={item.key} onClick={() => { setModule(item.key); setResult(''); setStatus(''); }} className={`w-full rounded-xl p-3 text-left transition ${module === item.key ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
              <div className="flex items-center gap-3"><Icon className="h-5 w-5 shrink-0" /><div><div className="text-sm font-semibold">{item.label}</div><div className={`text-xs ${module === item.key ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{item.hint}</div></div></div>
            </button>;
          })}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold">{active.label}</h2><p className="text-sm text-muted-foreground">{active.hint}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">AI flag required</span></div>
          <label className="mb-2 block text-sm font-medium">আপনার প্রশ্ন / নির্দেশনা (ঐচ্ছিক)</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="input-bangla min-h-[130px]" placeholder={`যেমন: ${module === 'inventory_assistant' ? 'কোন stock আগে reorder করা উচিত?' : module === 'sales_analysis' ? 'গত ৩০ দিনের sales থেকে ৫টি গুরুত্বপূর্ণ insight দাও।' : 'GAZI SEED-এর জন্য গুরুত্বপূর্ণ insight এবং action plan দাও।'}`} />
          <button onClick={runModule} disabled={running || !genericAIReady} className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? 'Running...' : 'Run AI Module'}</button>
          {status && <p className={`mt-3 text-sm ${status.includes('Completed') ? 'text-green-600' : 'text-muted-foreground'}`}>{status}</p>}
          {result && <div className="mt-5 whitespace-pre-wrap rounded-xl border border-border bg-secondary/20 p-5 text-sm leading-7">{result}</div>}
        </div>
      </div>
    </div>
  );
}
