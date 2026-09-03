'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Country = 'BD' | 'IN';
type Tab = 'all' | 'low' | 'out';
type Combo = { id: string; name: string; sku: string; country: Country; stock: number; threshold: number };

export default function ComboStockAlerts() {
  const [country, setCountry] = useState<Country>('BD');
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const s = createClient();
    const { data, error: e } = await s.from('combos')
      .select('id,name_en,name_bn,sku,country,active,low_stock_threshold')
      .eq('country', country).eq('active', true).order('name_en').limit(500);
    if (e) { setError(e.message); setLoading(false); return; }
    const rows = await Promise.all((data || []).map(async (c: any) => {
      const { data: stock, error: se } = await s.rpc('admin_combo_available_stock', { p_combo_id: c.id });
      if (se) return null;
      return { id: c.id, name: c.name_en || c.name_bn || 'Unnamed combo', sku: c.sku || '—', country: c.country, stock: Number(stock ?? 0), threshold: Number(c.low_stock_threshold ?? 5) } as Combo;
    }));
    setCombos(rows.filter(Boolean) as Combo[]); setLoading(false);
  }, [country]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: combos.length,
    low: combos.filter(x => x.stock > 0 && x.stock <= x.threshold).length,
    out: combos.filter(x => x.stock <= 0).length,
  }), [combos]);

  const filtered = useMemo(() => {
    const source = tab === 'low' ? combos.filter(x => x.stock > 0 && x.stock <= x.threshold) : tab === 'out' ? combos.filter(x => x.stock <= 0) : combos;
    const q = query.trim().toLowerCase();
    return q ? source.filter(x => `${x.name} ${x.sku}`.toLowerCase().includes(q)) : source;
  }, [combos, tab, query]);

  const cards: { key: Tab; label: string; value: number; tone: string }[] = [
    { key: 'all', label: 'Total Active Combos', value: counts.all, tone: 'text-[#1f6b3b]' },
    { key: 'low', label: 'Low Stock Alerts', value: counts.low, tone: 'text-amber-600' },
    { key: 'out', label: 'Out of Stock Alerts', value: counts.out, tone: 'text-red-600' },
  ];

  return <main className="p-5 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-black">Combo Stock Alerts</h1><p className="mt-1 text-gray-500">Available combo stock is calculated from the limiting component.</p></div>
      <select value={country} onChange={e => setCountry(e.target.value as Country)} className="rounded-xl border bg-white px-4 py-3 font-semibold"><option value="BD">🇧🇩 Bangladesh</option><option value="IN">🇮🇳 India</option></select>
    </div>

    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      {cards.map(c => <button key={c.key} onClick={() => setTab(c.key)} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${tab === c.key ? 'ring-2 ring-[#1f6b3b]' : ''}`}><p className="text-sm font-semibold text-gray-500">{c.label}</p><p className={`mt-2 text-3xl font-black ${c.tone}`}>{loading ? '—' : c.value}</p></button>)}
    </div>

    <div className="mt-6 flex flex-wrap gap-3"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search combo / SKU" className="min-w-[260px] flex-1 rounded-xl border bg-white px-4 py-3"/><button onClick={load} disabled={loading} className="rounded-xl border bg-white px-5 py-3 font-semibold disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4 font-bold">{tab === 'low' ? 'Low-stock combos' : tab === 'out' ? 'Out-of-stock combos' : 'All active combos'}</div>
      {loading ? <div className="p-8 text-center text-gray-500">Loading combo alerts…</div> : filtered.length === 0 ? <div className="p-10 text-center text-gray-500">No matching combos in {country === 'BD' ? 'Bangladesh' : 'India'}.</div> : <div className="divide-y">{filtered.map(x => <div key={x.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${x.stock <= 0 ? 'bg-red-50 text-red-700' : x.stock <= x.threshold ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{x.stock <= 0 ? 'OUT' : x.stock <= x.threshold ? 'LOW' : 'OK'}</span><b>{x.name}</b></div><p className="mt-1 text-sm text-gray-500">SKU: {x.sku} · {x.country}</p></div><div className="text-right"><b className={x.stock <= 0 ? 'text-red-600' : x.stock <= x.threshold ? 'text-amber-600' : 'text-[#1f6b3b]'}>{x.stock} available</b><p className="text-xs text-gray-500">Alert threshold: {x.threshold}</p></div></div>)}</div>}
    </div>
  </main>;
}
