'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Country = 'BD' | 'IN';
type Kind = 'Product' | 'Variant' | 'Combo';
type Item = { id:string; kind:Kind; name:string; sku:string; stock:number; threshold:number; parent?:string };

export default function InventoryAlertsPage() {
  const [country,setCountry]=useState<Country>('BD');
  const [products,setProducts]=useState<Item[]>([]);
  const [variants,setVariants]=useState<Item[]>([]);
  const [combos,setCombos]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');

  const load=useCallback(async()=>{
    setLoading(true); setError(''); const s=createClient();
    const [p,v,c]=await Promise.all([
      s.from('products').select('id,name_en,name_bn,sku,stock,low_stock_threshold').eq('country',country).eq('active',true).limit(500),
      s.from('product_variants').select('id,name,sku,stock,product_id,products!inner(name_en,name_bn,country)').eq('active',true).eq('products.country',country).limit(500),
      s.from('combos').select('id,name_en,name_bn,sku,country,active,low_stock_threshold').eq('country',country).eq('active',true).limit(500)
    ]);
    if(p.error||v.error||c.error){setError(p.error?.message||v.error?.message||c.error?.message||'Unable to load alerts.');setLoading(false);return;}
    const comboRows=await Promise.all((c.data||[]).map(async(x:any)=>{const r=await s.rpc('admin_combo_available_stock',{p_combo_id:x.id});return r.error?null:{x,stock:Number(r.data??0)};}));
    setProducts((p.data||[]).map((x:any)=>({id:x.id,kind:'Product',name:x.name_en||x.name_bn||'Unnamed product',sku:x.sku||'—',stock:Number(x.stock||0),threshold:Number(x.low_stock_threshold??5)})));
    setVariants((v.data||[]).map((x:any)=>({id:x.id,kind:'Variant',name:x.name||'Unnamed variant',sku:x.sku||'—',stock:Number(x.stock||0),threshold:5,parent:x.products?.name_en||x.products?.name_bn||'Product'})));
    setCombos(comboRows.filter(Boolean).map((r:any)=>({id:r.x.id,kind:'Combo',name:r.x.name_en||r.x.name_bn||'Unnamed combo',sku:r.x.sku||'—',stock:r.stock,threshold:Number(r.x.low_stock_threshold??5)})));
    setLoading(false);
  },[country]);
  useEffect(()=>{load()},[load]);

  const filter=(items:Item[])=>{const q=query.trim().toLowerCase();return q?items.filter(x=>`${x.name} ${x.sku} ${x.parent||''}`.toLowerCase().includes(q)):items};
  const sections=[
    {title:'Product Alerts',items:filter(products),low:products.filter(x=>x.stock>0&&x.stock<=x.threshold).length,out:products.filter(x=>x.stock<=0).length},
    {title:'Variant Alerts',items:filter(variants),low:variants.filter(x=>x.stock>0&&x.stock<=x.threshold).length,out:variants.filter(x=>x.stock<=0).length},
    {title:'Combo Alerts',items:filter(combos),low:combos.filter(x=>x.stock>0&&x.stock<=x.threshold).length,out:combos.filter(x=>x.stock<=0).length}
  ];
  const totals=useMemo(()=>({low:sections.reduce((n,s)=>n+s.low,0),out:sections.reduce((n,s)=>n+s.out,0)}),[sections]);

  return <main className="p-5 md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black">Inventory Alerts</h1><p className="mt-1 text-gray-500">Separate stock alerts for products, variants and combo packs.</p></div><select value={country} onChange={e=>setCountry(e.target.value as Country)} className="rounded-xl border bg-white px-4 py-3 font-semibold"><option value="BD">Bangladesh</option><option value="IN">India</option></select></div>
  <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border bg-white p-5"><p className="text-sm font-semibold text-gray-500">Total Low Stock Alerts</p><p className="mt-2 text-3xl font-black text-amber-600">{loading?'—':totals.low}</p></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm font-semibold text-gray-500">Total Out of Stock Alerts</p><p className="mt-2 text-3xl font-black text-red-600">{loading?'—':totals.out}</p></div></div>
  <div className="mt-6 flex gap-3"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name / SKU" className="min-w-[240px] flex-1 rounded-xl border bg-white px-4 py-3"/><button onClick={load} disabled={loading} className="rounded-xl border bg-white px-5 py-3 font-semibold">{loading?'Refreshing…':'Refresh'}</button></div>
  {error&&<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
  <div className="mt-6 grid gap-6 xl:grid-cols-3">{sections.map(sec=><section key={sec.title} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-black">{sec.title}</h2><div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">LOW {sec.low}</span><span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">OUT {sec.out}</span></div></div></div>{loading?<div className="p-6 text-gray-500">Loading…</div>:sec.items.length===0?<div className="p-6 text-gray-500">No alerts/items found.</div>:<div className="divide-y">{sec.items.filter(x=>x.stock<=x.threshold).map(x=><div key={x.id} className="p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><b className="block truncate">{x.name}</b><p className="text-xs text-gray-500">{x.sku}{x.parent?` · ${x.parent}`:''}</p></div><b className={x.stock<=0?'text-red-600':'text-amber-600'}>{x.stock<=0?'OUT':`LOW · ${x.stock}`}</b></div><p className="mt-1 text-xs text-gray-500">Threshold: {x.threshold} · {country}</p></div>)}</div>}</section>)}</div></main>;
}
