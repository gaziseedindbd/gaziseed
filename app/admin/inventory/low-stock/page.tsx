'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Country = 'BD' | 'IN';
type Tab = 'all' | 'products' | 'variants' | 'combos';
type Item = { id: string; kind: 'Product' | 'Variant' | 'Combo'; name: string; sku: string; country: Country; stock: number; threshold: number; parent?: string; };

export default function LowStockDashboard() {
  const [country, setCountry] = useState<Country>('BD');
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Item[]>([]);
  const [variants, setVariants] = useState<Item[]>([]);
  const [combos, setCombos] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const s = createClient();
    const [pr, vr, cr] = await Promise.all([
      s.from('products').select('id,name_en,name_bn,sku,country,stock,low_stock_threshold,active').eq('country', country).gt('stock', 0).order('stock').limit(500),
      s.from('product_variants').select('id,name,sku,stock,active,product_id,products!inner(name_en,name_bn,country)').eq('products.country', country).gt('stock', 0).order('stock').limit(500),
      s.from('combos').select('id,name_en,name_bn,sku,country,active,low_stock_threshold').eq('country', country).eq('active', true).order('name_en').limit(500),
    ]);
    if (pr.error || vr.error || cr.error) { setError(pr.error?.message || vr.error?.message || cr.error?.message || 'Unable to load low-stock alerts.'); setLoading(false); return; }
    const comboRows = await Promise.all((cr.data || []).map(async (c: any) => {
      const { data, error: e } = await s.rpc('admin_combo_available_stock', { p_combo_id: c.id });
      return e ? null : { c, stock: Number(data ?? 0) };
    }));
    const ps = (pr.data || []).map((p: any) => ({ id:p.id, kind:'Product' as const, name:p.name_en||p.name_bn||'Unnamed product', sku:p.sku||'—', country:p.country, stock:Number(p.stock||0), threshold:Number(p.low_stock_threshold??5) })).filter(x => x.stock > 0 && x.stock <= x.threshold);
    const vs = (vr.data || []).map((v: any) => ({ id:v.id, kind:'Variant' as const, name:v.name||'Unnamed variant', sku:v.sku||'—', country, stock:Number(v.stock||0), threshold:5, parent:v.products?.name_en||v.products?.name_bn||'Product' })).filter(x => x.stock <= x.threshold);
    const cs = comboRows.filter(Boolean).map((x: any) => ({ id:x.c.id, kind:'Combo' as const, name:x.c.name_en||x.c.name_bn||'Unnamed combo', sku:x.c.sku||'—', country:x.c.country, stock:x.stock, threshold:Number(x.c.low_stock_threshold??5) })).filter(x => x.stock > 0 && x.stock <= x.threshold);
    setProducts(ps); setVariants(vs); setCombos(cs); setLoading(false);
  }, [country]);
  useEffect(() => { load(); }, [load]);
  const all = useMemo(() => [...products,...variants,...combos].sort((a,b)=>a.stock-b.stock), [products,variants,combos]);
  const filtered = useMemo(() => { const src=tab==='products'?products:tab==='variants'?variants:tab==='combos'?combos:all; const q=query.trim().toLowerCase(); return q?src.filter(x=>`${x.name} ${x.sku} ${x.parent||''}`.toLowerCase().includes(q)):src; }, [tab,query,products,variants,combos,all]);
  const cards=[{key:'all' as Tab,label:'Total Low Stock',value:all.length},{key:'products' as Tab,label:'Products',value:products.length},{key:'variants' as Tab,label:'Variants',value:variants.length},{key:'combos' as Tab,label:'Combo Packs',value:combos.length}];
  return <main className="p-5 md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black">Low Stock</h1><p className="mt-1 text-gray-500">Items at or below their configured restock threshold.</p></div><select value={country} onChange={e=>setCountry(e.target.value as Country)} className="rounded-xl border bg-white px-4 py-3 font-semibold"><option value="BD">Bangladesh</option><option value="IN">India</option></select></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(c=><button key={c.key} onClick={()=>setTab(c.key)} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${tab===c.key?'ring-2 ring-amber-500':''}`}><p className="text-sm font-semibold text-gray-500">{c.label}</p><p className="mt-2 text-3xl font-black text-amber-600">{loading?'—':c.value}</p></button>)}</div><div className="mt-6 flex flex-wrap gap-3"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product / SKU / variant" className="min-w-[260px] flex-1 rounded-xl border bg-white px-4 py-3"/><button onClick={load} disabled={loading} className="rounded-xl border bg-white px-5 py-3 font-semibold disabled:opacity-50">{loading?'Refreshing…':'Refresh'}</button></div>{error&&<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}<div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4 font-bold">Low-stock items</div>{loading?<div className="p-8 text-center text-gray-500">Loading inventory alerts…</div>:filtered.length===0?<div className="p-10 text-center text-gray-500">🎉 No low-stock items in {country==='BD'?'Bangladesh':'India'}.</div>:<div className="divide-y">{filtered.map(x=><div key={`${x.kind}-${x.id}`} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{x.kind}</span><b className="truncate">{x.name}</b></div><p className="mt-1 text-sm text-gray-500">SKU: {x.sku}{x.parent?` · ${x.parent}`:''} · {x.country}</p></div><div className="text-right"><b className="text-amber-600">{x.stock} in stock</b><p className="text-xs text-gray-500">Threshold: {x.threshold}</p></div></div>)}</div>}</div></main>;
}
