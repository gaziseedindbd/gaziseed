'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Country = 'BD' | 'IN';
type Tab = 'all' | 'products' | 'variants' | 'combos';

type Item = {
  id: string;
  kind: 'Product' | 'Variant' | 'Combo';
  name: string;
  sku: string;
  country: Country;
  stock: number;
  parent?: string;
};

export default function OutOfStockDashboard() {
  const [country, setCountry] = useState<Country>('BD');
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Item[]>([]);
  const [variants, setVariants] = useState<Item[]>([]);
  const [combos, setCombos] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const s = createClient();

    const [productResult, variantResult, comboResult] = await Promise.all([
      s.from('products').select('id,name_en,name_bn,sku,country,stock,active').eq('country', country).eq('stock', 0).order('name_en').limit(500),
      s.from('product_variants').select('id,name,sku,stock,active,product_id,products!inner(name_en,name_bn,country)').eq('stock', 0).eq('products.country', country).order('name').limit(500),
      s.from('combos').select('id,name_en,name_bn,sku,country,active').eq('country', country).eq('active', true).order('name_en').limit(500),
    ]);

    if (productResult.error || variantResult.error || comboResult.error) {
      setError(productResult.error?.message || variantResult.error?.message || comboResult.error?.message || 'Unable to load inventory alerts.');
      setLoading(false);
      return;
    }

    const comboRows = comboResult.data || [];
    const comboStock = await Promise.all(comboRows.map(async (c: any) => {
      const { data, error: stockError } = await s.rpc('admin_combo_available_stock', { p_combo_id: c.id });
      return { c, stock: stockError ? null : Number(data ?? 0) };
    }));

    setProducts((productResult.data || []).map((p: any) => ({
      id: p.id, kind: 'Product', name: p.name_en || p.name_bn || 'Unnamed product', sku: p.sku || '—', country: p.country, stock: Number(p.stock || 0),
    })));
    setVariants((variantResult.data || []).map((v: any) => ({
      id: v.id, kind: 'Variant', name: v.name || 'Unnamed variant', sku: v.sku || '—', country, stock: Number(v.stock || 0), parent: v.products?.name_en || v.products?.name_bn || 'Product',
    })));
    setCombos(comboStock.filter(x => x.stock !== null && x.stock <= 0).map(({ c, stock }) => ({
      id: c.id, kind: 'Combo', name: c.name_en || c.name_bn || 'Unnamed combo', sku: c.sku || '—', country: c.country, stock: Number(stock),
    })));
    setLoading(false);
  }, [country]);

  useEffect(() => { load(); }, [load]);

  const all = useMemo(() => [...products, ...variants, ...combos], [products, variants, combos]);
  const filtered = useMemo(() => {
    const source = tab === 'products' ? products : tab === 'variants' ? variants : tab === 'combos' ? combos : all;
    const q = query.trim().toLowerCase();
    return q ? source.filter(x => `${x.name} ${x.sku} ${x.parent || ''}`.toLowerCase().includes(q)) : source;
  }, [tab, query, products, variants, combos, all]);

  const cards = [
    { key: 'all' as Tab, label: 'Total Out of Stock', value: all.length },
    { key: 'products' as Tab, label: 'Products', value: products.length },
    { key: 'variants' as Tab, label: 'Variants', value: variants.length },
    { key: 'combos' as Tab, label: 'Combo Packs', value: combos.length },
  ];

  return (
    <main className="p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Out of Stock</h1>
          <p className="mt-1 text-gray-500">Products, variants and combo packs that currently cannot be sold from stock.</p>
        </div>
        <select value={country} onChange={e => setCountry(e.target.value as Country)} className="rounded-xl border bg-white px-4 py-3 font-semibold">
          <option value="BD">Bangladesh</option>
          <option value="IN">India</option>
        </select>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <button key={card.key} onClick={() => setTab(card.key)} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${tab === card.key ? 'ring-2 ring-[#1f6b3b]' : ''}`}>
            <p className="text-sm font-semibold text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-black text-red-600">{loading ? '—' : card.value}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search product / SKU / variant" className="min-w-[260px] flex-1 rounded-xl border bg-white px-4 py-3" />
        <button onClick={load} disabled={loading} className="rounded-xl border bg-white px-5 py-3 font-semibold disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 font-bold">Out-of-stock items</div>
        {loading ? <div className="p-8 text-center text-gray-500">Loading inventory alerts…</div> : filtered.length === 0 ? <div className="p-10 text-center text-gray-500">🎉 No out-of-stock items in {country === 'BD' ? 'Bangladesh' : 'India'}.</div> : (
          <div className="divide-y">
            {filtered.map(item => (
              <div key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{item.kind}</span>
                    <b className="truncate">{item.name}</b>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">SKU: {item.sku}{item.parent ? ` · ${item.parent}` : ''} · {item.country}</p>
                </div>
                <div className="text-right"><b className="text-red-600">0 in stock</b><p className="text-xs text-gray-500">Needs restock</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
