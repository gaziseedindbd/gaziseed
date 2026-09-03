'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Country = 'BD' | 'IN';
type Row = { id: string; name: string; sku: string; stock: number; threshold: number; type: 'Product' | 'Variant' | 'Combo' };

export default function InventorySummary() {
  const [country, setCountry] = useState<Country>('BD');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const s = createClient();
    const [p, v, c] = await Promise.all([
      s.from('products').select('id,name_bn,name_en,sku,stock,low_stock_threshold').eq('country', country).eq('active', true).limit(1000),
      s.from('product_variants').select('id,name,sku,stock,product_id,products!inner(country,name_bn,name_en)').eq('active', true).eq('products.country', country).limit(1000),
      s.from('combos').select('id,name_bn,name_en,sku,low_stock_threshold').eq('country', country).eq('active', true).limit(1000),
    ]);
    if (p.error || v.error || c.error) {
      setError(p.error?.message || v.error?.message || c.error?.message || 'Unable to load inventory summary.');
      setLoading(false); return;
    }
    const combos = await Promise.all((c.data || []).map(async (x: any) => {
      const r = await s.rpc('admin_combo_available_stock', { p_combo_id: x.id });
      return { id: x.id, name: x.name_en || x.name_bn || 'Combo', sku: x.sku || '', stock: Number(r.data ?? 0), threshold: Number(x.low_stock_threshold ?? 5), type: 'Combo' as const };
    }));
    const products: Row[] = (p.data || []).map((x: any) => ({ id: x.id, name: x.name_en || x.name_bn || 'Product', sku: x.sku || '', stock: Number(x.stock || 0), threshold: Number(x.low_stock_threshold ?? 5), type: 'Product' }));
    const variants: Row[] = (v.data || []).map((x: any) => ({ id: x.id, name: x.name || 'Variant', sku: x.sku || '', stock: Number(x.stock || 0), threshold: 5, type: 'Variant' }));
    setRows([...products, ...variants, ...combos]);
    setLastUpdated(new Date());
    setLoading(false);
  }, [country]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => `${r.name} ${r.sku} ${r.type}`.toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => ({
    products: rows.filter(r => r.type === 'Product').length,
    variants: rows.filter(r => r.type === 'Variant').length,
    combos: rows.filter(r => r.type === 'Combo').length,
    totalStock: rows.filter(r => r.type !== 'Combo').reduce((n, r) => n + r.stock, 0),
    lowProducts: rows.filter(r => r.type === 'Product' && r.stock > 0 && r.stock <= r.threshold).length,
    lowVariants: rows.filter(r => r.type === 'Variant' && r.stock > 0 && r.stock <= r.threshold).length,
    lowCombos: rows.filter(r => r.type === 'Combo' && r.stock > 0 && r.stock <= r.threshold).length,
    outProducts: rows.filter(r => r.type === 'Product' && r.stock <= 0).length,
    outVariants: rows.filter(r => r.type === 'Variant' && r.stock <= 0).length,
    outCombos: rows.filter(r => r.type === 'Combo' && r.stock <= 0).length,
  }), [rows]);

  const cards = [
    ['Active Products', stats.products, 'text-emerald-700'], ['Active Variants', stats.variants, 'text-blue-700'], ['Active Combos', stats.combos, 'text-purple-700'], ['Total Stock Units', stats.totalStock, 'text-slate-800'],
    ['Product Low Stock', stats.lowProducts, 'text-amber-600'], ['Variant Low Stock', stats.lowVariants, 'text-amber-600'], ['Combo Low Stock', stats.lowCombos, 'text-amber-600'],
    ['Product Out of Stock', stats.outProducts, 'text-red-600'], ['Variant Out of Stock', stats.outVariants, 'text-red-600'], ['Combo Out of Stock', stats.outCombos, 'text-red-600'],
  ];

  return <main className="p-5 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-black">Inventory Summary</h1><p className="mt-1 text-gray-500">Country-wise inventory health at a glance.</p></div>
      <div className="flex flex-wrap gap-2">
        <select value={country} onChange={e => setCountry(e.target.value as Country)} className="rounded-xl border bg-white px-4 py-3 font-semibold"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
        <button onClick={load} disabled={loading} className="rounded-xl border bg-white px-4 py-3 font-semibold hover:bg-gray-50 disabled:opacity-60">{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, variant, combo or SKU…" className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:ring-2 sm:max-w-xl" />
      <div className="text-sm text-gray-500">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'} · {filtered.length} shown</div>
    </div>
    {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}<button onClick={load} className="ml-3 font-bold underline">Retry</button></div>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{cards.map(([label, value, cls]) => <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500">{label}</p><p className={`mt-2 text-3xl font-black ${cls}`}>{loading ? '—' : value}</p></div>)}</div>
    <div className="mt-6 rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-bold">Inventory Search Results</h2></div>{loading ? <div className="p-8 text-center text-gray-500">Refreshing inventory…</div> : filtered.length === 0 ? <div className="p-8 text-center text-gray-500">No inventory items found.</div> : <div className="divide-y">{filtered.slice(0, 100).map(r => <div key={`${r.type}-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold">{r.name}</p><p className="text-xs text-gray-500">{r.type} · {r.sku || 'No SKU'}</p></div><div className="text-right"><p className={`font-black ${r.stock <= 0 ? 'text-red-600' : r.stock <= r.threshold ? 'text-amber-600' : 'text-gray-800'}`}>{r.stock}</p><p className="text-xs text-gray-500">threshold {r.threshold}</p></div></div>)}</div>}</div>
  </main>;
}
