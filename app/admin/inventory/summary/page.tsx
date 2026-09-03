'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Country='BD'|'IN';

export default function InventorySummary(){
 const [country,setCountry]=useState<Country>('BD'); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 const [data,setData]=useState({products:0,variants:0,combos:0,lowProducts:0,lowVariants:0,lowCombos:0,outProducts:0,outVariants:0,outCombos:0,totalStock:0});
 const load=useCallback(async()=>{setLoading(true);setError('');const s=createClient();
  const [p,v,c]=await Promise.all([
   s.from('products').select('stock,low_stock_threshold').eq('country',country).eq('active',true).limit(1000),
   s.from('product_variants').select('stock,products!inner(country)').eq('active',true).eq('products.country',country).limit(1000),
   s.from('combos').select('id,low_stock_threshold').eq('country',country).eq('active',true).limit(1000)
  ]);
  if(p.error||v.error||c.error){setError(p.error?.message||v.error?.message||c.error?.message||'Unable to load inventory summary.');setLoading(false);return;}
  const combos=await Promise.all((c.data||[]).map(async(x:any)=>{const r=await s.rpc('admin_combo_available_stock',{p_combo_id:x.id});return {stock:Number(r.data??0),threshold:Number(x.low_stock_threshold??5)}}));
  const products=p.data||[],variants=v.data||[];
  setData({products:products.length,variants:variants.length,combos:combos.length,lowProducts:products.filter((x:any)=>x.stock>0&&x.stock<=Number(x.low_stock_threshold??5)).length,lowVariants:variants.filter((x:any)=>x.stock>0&&x.stock<=5).length,lowCombos:combos.filter(x=>x.stock>0&&x.stock<=x.threshold).length,outProducts:products.filter((x:any)=>Number(x.stock)<=0).length,outVariants:variants.filter((x:any)=>Number(x.stock)<=0).length,outCombos:combos.filter(x=>x.stock<=0).length,totalStock:products.reduce((n:number,x:any)=>n+Number(x.stock||0),0)+variants.reduce((n:number,x:any)=>n+Number(x.stock||0),0)});
  setLoading(false);
 },[country]);
 useEffect(()=>{load()},[load]);
 const cards=[['Active Products',data.products,'text-emerald-700'],['Active Variants',data.variants,'text-blue-700'],['Active Combos',data.combos,'text-purple-700'],['Total Stock Units',data.totalStock,'text-slate-800'],['Product Low Stock',data.lowProducts,'text-amber-600'],['Variant Low Stock',data.lowVariants,'text-amber-600'],['Combo Low Stock',data.lowCombos,'text-amber-600'],['Product Out of Stock',data.outProducts,'text-red-600'],['Variant Out of Stock',data.outVariants,'text-red-600'],['Combo Out of Stock',data.outCombos,'text-red-600']];
 return <main className="p-5 md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black">Inventory Summary</h1><p className="mt-1 text-gray-500">Country-wise inventory health at a glance.</p></div><div className="flex gap-2"><select value={country} onChange={e=>setCountry(e.target.value as Country)} className="rounded-xl border bg-white px-4 py-3 font-semibold"><option value="BD">Bangladesh</option><option value="IN">India</option></select><button onClick={load} disabled={loading} className="rounded-xl border bg-white px-4 py-3 font-semibold">{loading?'Refreshing…':'Refresh'}</button></div></div>{error&&<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{cards.map(([label,value,cls])=><div key={label} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500">{label}</p><p className={`mt-2 text-3xl font-black ${cls}`}>{loading?'—':value}</p></div>)}</div></main>;
}
