'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
type Quote = { courierId: number; name: string; estimatedCost: number };
export default function IndiaShippingRatesPage() {
 const [pin,setPin]=useState(''); const [pickup,setPickup]=useState('783124');
 const [weight,setWeight]=useState('0.5'); const [length,setLength]=useState('15');
 const [breadth,setBreadth]=useState('10'); const [height,setHeight]=useState('5');
 const [mode,setMode]=useState<'prepaid'|'cod'>('prepaid');
 const [rates,setRates]=useState<Quote[]>([]); const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 async function check() {
  setLoading(true);setMessage('');setRates([]);
  try {
   if(!/^[1-9][0-9]{5}$/.test(pin)||!/^[1-9][0-9]{5}$/.test(pickup))
    throw new Error('Enter valid 6-digit India PIN codes');
   const dims=[weight,length,breadth,height].map(Number);
   if(dims.some(n=>!Number.isFinite(n)||n<=0||n>100))throw new Error('Enter valid positive parcel measurements');
   const {data:session}=await supabase.auth.getSession();
   if(!session.session?.access_token)throw new Error('India Admin login required');
   const [admin,country]=await Promise.all([supabase.rpc('is_admin'),supabase.rpc('current_admin_country')]);
   if(admin.error||country.error||admin.data!==true||String(country.data).toUpperCase()!=='IN')
    throw new Error('Only India Admin can check shipping rates');
   const {data,error}=await supabase.functions.invoke('india-shipping-rates',{
     body:{pickupPostcode:pickup,deliveryPostcode:pin,weightKg:dims[0],
      lengthCm:dims[1],breadthCm:dims[2],heightCm:dims[3],paymentMode:mode},
     headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
   if(error||data?.ok!==true) {
    let payload: { code?: string; diagnostic?: { stage?: string; upstreamStatus?: number; returnedCouriers?: number; rejectedCouriers?: number } } | null = data;
    if(error && 'context' in error && error.context instanceof Response) {
      try { payload = await error.context.clone().json(); } catch { /* Unreadable error body */ }
    }
    const code = typeof payload?.code === 'string' ? payload.code : 'request_failed';
    const stage = typeof payload?.diagnostic?.stage === 'string' ? payload.diagnostic.stage : (error ? 'network_or_cors' : 'unknown');
    const upstream = typeof payload?.diagnostic?.upstreamStatus === 'number' ? ' / Shiprocket HTTP '+payload.diagnostic.upstreamStatus : '';
    throw new Error('Courier rate check failed: '+code+' ('+stage+upstream+'). No shipment created.');
   }
   setRates(Array.isArray(data.couriers)?data.couriers:[]);
   setMessage(data.couriers?.length?'Available courier estimates (not a booking)':'No eligible couriers for these details');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to check rates');}
  finally{setLoading(false);}
 }
 const field=(name:string,value:string,change:(s:string)=>void,placeholder:string)=>
  <label className="flex flex-col gap-1 text-sm font-medium">{name}<input value={value} onChange={e=>change(e.target.value)}
   placeholder={placeholder} className="rounded-lg border p-3 text-base" /></label>;
 return <main className="mx-auto max-w-3xl space-y-5 p-6">
  <h1 className="text-2xl font-bold">India Shipping Management — Rate Check</h1>
  <p className="text-sm text-gray-600">Estimate courier rates without creating orders, AWBs or pickups. Shiprocket KYC is verified; courier coverage must be checked per route. Quoted cost is charged by the courier, independent of your customer delivery-fee policy.</p>
  <section className="grid gap-4 sm:grid-cols-2">
   {field('Verified pickup PIN',pickup,setPickup,'783124')}
   {field('Delivery PIN (6 digits)',pin,setPin,'110001')}
   {field('Packed weight (kg)',weight,setWeight,'0.5')}
   {field('Length (cm)',length,setLength,'15')}
   {field('Breadth (cm)',breadth,setBreadth,'10')}
   {field('Height (cm)',height,setHeight,'5')}
   <label className="flex flex-col gap-1 text-sm font-medium">Payment type
    <select className="rounded-lg border p-3" value={mode} onChange={e=>setMode(e.target.value as 'prepaid'|'cod')}>
     <option value="prepaid">Prepaid</option><option value="cod">COD (courier capability only)</option>
    </select>
   </label>
  </section>
  <button onClick={check} disabled={loading} className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60">
   {loading?'Checking couriers…':'Check Courier Availability & Charges'}
  </button>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {rates.length>0&&<div className="space-y-2">{rates.map((r,i)=>
   <div key={r.courierId} className="flex justify-between rounded-lg border p-3">
    <span>{r.name}{i===0?' — Lowest estimate':''}</span><strong>₹{r.estimatedCost.toFixed(2)}</strong>
   </div>)}</div>}
  <p className="text-xs text-gray-600">Manual PINs and dimensions are for quotations only. Actual booking requires verified order address, Cashfree checks, package measurements, and KYC approval.</p>
 </main>;
}
