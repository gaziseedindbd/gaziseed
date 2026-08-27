'use client';

import { useState } from 'react';
import { Sparkles, Play, Loader2, BarChart3, ShoppingCart, Package, Megaphone, Target, MessageCircle, Sprout, Search } from 'lucide-react';

const modules = [
  { key: 'business_analysis', label: 'Business Analysis', icon: BarChart3, hint: 'ব্যবসার সামগ্রিক performance বিশ্লেষণ' },
  { key: 'sales_analysis', label: 'Sales Analysis', icon: ShoppingCart, hint: 'Sales trend, revenue ও best sellers' },
  { key: 'inventory_assistant', label: 'Inventory Assistant', icon: Package, hint: 'Stock ও reorder risk বিশ্লেষণ' },
  { key: 'marketing_assistant', label: 'Marketing Assistant', icon: Megaphone, hint: 'Marketing insight ও campaign ideas' },
  { key: 'ads_assistant', label: 'Facebook/Instagram Ads Assistant', icon: Target, hint: 'Available ad/source data বিশ্লেষণ' },
  { key: 'customer_support_ai', label: 'Customer Support AI', icon: MessageCircle, hint: 'Customer প্রশ্নের উত্তর তৈরি' },
  { key: 'seed_expert', label: 'Seed Expert', icon: Sprout, hint: 'SEED BARI product catalogue ভিত্তিক guidance' },
  { key: 'seo_aeo_assistant', label: 'SEO/AEO Assistant', icon: Search, hint: 'Product SEO, FAQ ও AEO content' },
] as const;

export default function AdminAIPage() {
  const [module, setModule] = useState<(typeof modules)[number]['key']>('business_analysis');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);

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
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6 text-primary" /> SEED BARI AI Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Settings-এর AI module flag ON করলে সংশ্লিষ্ট module এখান থেকে বাস্তবে চালানো যাবে।</p>
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
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="input-bangla min-h-[130px]" placeholder={`যেমন: ${module === 'inventory_assistant' ? 'কোন stock আগে reorder করা উচিত?' : module === 'sales_analysis' ? 'গত ৩০ দিনের sales থেকে ৫টি গুরুত্বপূর্ণ insight দাও।' : 'SEED BARI-এর জন্য গুরুত্বপূর্ণ insight এবং action plan দাও।'}`} />
          <button onClick={runModule} disabled={running} className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? 'Running...' : 'Run AI Module'}</button>
          {status && <p className={`mt-3 text-sm ${status.includes('Completed') ? 'text-green-600' : 'text-muted-foreground'}`}>{status}</p>}
          {result && <div className="mt-5 whitespace-pre-wrap rounded-xl border border-border bg-secondary/20 p-5 text-sm leading-7">{result}</div>}
        </div>
      </div>
    </div>
  );
}
