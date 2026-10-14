'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase/client';
type Order={id:string;order_number:string|null;customer_name:string|null;delivery_address:string|null;status:string|null;payment_status:string|null;grand_total:number|null;created_at:string};
type Shipment={id:string;order_id:string;external_shipment_id:string|null;awb:string|null;courier_company_id:number|null;tracking_status:string|null;pickup_approved_at:string|null};
type Preparation={order_id:string;delivery_pin:string;weight_kg:number;length_cm:number;breadth_cm:number;height_cm:number;packing_notes:string;updated_at:string};
type Event={shipment_id:string;event_status:string|null;received_at:string;event_occurred_at:string|null};
const formatDate=(s:string)=>new Date(s).toLocaleString('en-IN');
export default function IndiaShippingDashboard(){
 const [orders,setOrders]=useState<Order[]>([]),[shipments,setShipments]=useState<Shipment[]>([]),[events,setEvents]=useState<Event[]>([]);
 const [preparations,setPreparations]=useState<Preparation[]>([]);
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [pin,setPin]=useState(''),[weight,setWeight]=useState(''),[length,setLength]=useState(''),[breadth,setBreadth]=useState(''),[height,setHeight]=useState(''),[notes,setNotes]=useState('');
 const [saving,setSaving]=useState(false),[saveMessage,setSaveMessage]=useState('');
 useEffect(()=>{let alive=true;(async()=>{try{
 const {data:session}=await supabase.auth.getSession();
 if(!session.session?.access_token)throw new Error('India Admin login required');
 const {data,error:invokeError}=await supabase.functions.invoke('india-shipping-admin-overview',{
 method:'POST',body:{},headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
 if(invokeError||data?.ok!==true||!Array.isArray(data.orders))throw new Error('Cannot load India shipping data. Verify India Admin access.');
 if(alive){setOrders(data.orders);setShipments(data.shipments??[]);setEvents(data.events??[]);setPreparations(data.preparations??[]);}
 }catch(e){if(alive)setError(e instanceof Error?e.message:'Unable to load shipping data');}
 finally{if(alive)setLoading(false);}})();return()=>{alive=false};},[]);
 useEffect(()=>{const saved=preparations.find(p=>p.order_id===selected);setPin(saved?.delivery_pin??'');setWeight(saved?String(saved.weight_kg):'');setLength(saved?String(saved.length_cm):'');setBreadth(saved?String(saved.breadth_cm):'');setHeight(saved?String(saved.height_cm):'');setNotes(saved?.packing_notes??'');setSaveMessage('');},[selected,preparations]);
 async function savePreparation(){
  setSaving(true);setSaveMessage('');
  try{
   if(!selected||!/^[1-9][0-9]{5}$/.test(pin))throw new Error('Enter a valid 6-digit delivery PIN');
   const dimensions=[weight,length,breadth,height].map(Number);
   if(dimensions.some((n,i)=>!Number.isFinite(n)||n<=0||n>(i===0?100:200)))throw new Error('Enter valid positive parcel measurements');
   if(notes.length>500)throw new Error('Packing notes cannot exceed 500 characters');
   const {data:session}=await supabase.auth.getSession();
   if(!session.session?.access_token)throw new Error('India Admin login required');
   const {data,error:saveError}=await supabase.functions.invoke('india-shipping-preparation',{method:'POST',
    body:{order_id:selected,delivery_pin:pin,weight_kg:dimensions[0],length_cm:dimensions[1],breadth_cm:dimensions[2],height_cm:dimensions[3],packing_notes:notes},
    headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
   if(saveError||data?.ok!==true)throw new Error('Could not save preparation. Verify India Admin access and shipment state.');
   setPreparations(old=>[...old.filter(p=>p.order_id!==selected),{order_id:selected,delivery_pin:pin,weight_kg:dimensions[0],length_cm:dimensions[1],breadth_cm:dimensions[2],height_cm:dimensions[3],packing_notes:notes,updated_at:new Date().toISOString()}]);
   setSaveMessage('Draft saved securely. No shipment or AWB was created.');
  }catch(e){setSaveMessage(e instanceof Error?e.message:'Unable to save');}finally{setSaving(false);}
 }
 const filtered=orders.filter(x=>([x.order_number,x.customer_name,x.id].join(' ').toLowerCase().includes(search.toLowerCase())));
 const order=orders.find(x=>x.id===selected)??null;
 const shipment=shipments.find(x=>x.order_id===selected);
 const history=events.filter(x=>x.shipment_id===shipment?.id);
 return <main className="mx-auto max-w-6xl space-y-5 p-5 sm:p-7">
  <div className="space-y-2"><h1 className="text-2xl font-bold">India Shipping Management</h1>
   <p className="text-sm text-gray-600">India-only order preparation drafts. Shiprocket KYC is under review. No shipment booking, AWB generation, courier assignment or pickup is enabled.</p></div>
  <div className="flex flex-wrap gap-3"><Link className="rounded-lg bg-emerald-700 px-4 py-3 text-white" href="/admin/india-shipping/rates">Check Courier Rates</Link>
   <Link className="rounded-lg border px-4 py-3" href="/admin/india-shipping/connection">Test API Connection</Link></div>
  {loading&&<p role="status">Loading India orders…</p>}
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {!loading&&!error&&<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
   <section className="space-y-3"><h2 className="text-lg font-semibold">Select India Order</h2>
    <input aria-label="Search India orders" placeholder="Search order number or customer" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-lg border p-3" />
    <p className="text-xs text-gray-500">Most recent 60 India orders, read-only</p>
    <div className="max-h-[550px] space-y-2 overflow-auto">{filtered.map(o=><button type="button" key={o.id} onClick={()=>setSelected(o.id)}
     className={`w-full rounded-lg border p-3 text-left ${selected===o.id?'border-emerald-700 bg-emerald-50':''}`}>
      <span className="block font-semibold">{o.order_number||o.id.slice(0,8)} · {o.customer_name||'Customer'}</span>
      <span className="text-sm text-gray-600">{o.status||'Status unavailable'} · ₹{Number(o.grand_total??0).toFixed(2)} · {formatDate(o.created_at)}</span>
     </button>)}
     {filtered.length===0&&<p className="text-sm">No matching India orders found.</p>}</div>
   </section>
   <section className="space-y-4"><h2 className="text-lg font-semibold">Shipment Details & Tracking</h2>
    {!order?<p className="rounded-lg border p-5 text-sm">Choose an India order to view shipping details.</p>:<>
     <div className="space-y-2 rounded-lg border p-4 text-sm">
      <p><strong>Order:</strong> {order.order_number||order.id}</p>
      <p><strong>Customer:</strong> {order.customer_name||'Not available'}</p>
      <p><strong>Delivery address:</strong> {order.delivery_address||'Missing — must verify before booking'}</p>
      <p><strong>Order status:</strong> {order.status||'Unknown'}</p>
      <p><strong>Payment status (display only):</strong> {order.payment_status||'Unknown'} — dispatch still requires server-side Cashfree verification</p>
      <p><strong>External shipment:</strong> {shipment?.external_shipment_id||'Not created'}</p>
      <p><strong>AWB:</strong> {shipment?.awb||'Not assigned'}</p>
      <p><strong>Courier ID:</strong> {shipment?.courier_company_id??'Not selected'}</p>
      <p><strong>Tracking status:</strong> {shipment?.tracking_status||'No tracking yet'}</p>
      <p><strong>Pickup approval:</strong> {shipment?.pickup_approved_at?'Recorded':'Not approved'}</p>
     </div>
     <div className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Shipping Preparation · Save Draft</h3>
      <p className="text-xs text-gray-600">Check the customer address before entering the PIN. Draft measurements do not confirm payment or authorize dispatch.</p>
      <div className="grid gap-3 sm:grid-cols-2">
       {([["Delivery PIN",pin,setPin,"700016"],["Weight (kg)",weight,setWeight,"0.5"],["Length (cm)",length,setLength,"15"],["Breadth (cm)",breadth,setBreadth,"10"],["Height (cm)",height,setHeight,"5"]] as const).map(([title,value,setter,placeholder])=><label key={title} className="flex flex-col gap-1 text-sm">{title}<input className="w-full rounded-lg border p-3" value={value} onChange={e=>setter(e.target.value)} placeholder={placeholder} inputMode={title==="Delivery PIN"?"numeric":"decimal"}/></label>)}
      </div>
      <label className="flex flex-col gap-1 text-sm">Packing notes (optional)<textarea className="rounded-lg border p-3" maxLength={500} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <button type="button" onClick={savePreparation} disabled={saving||Boolean(shipment?.awb||shipment?.external_shipment_id)} className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving?"Saving…":"Save Preparation Draft"}</button>
      {saveMessage&&<p role="status" className="text-sm">{saveMessage}</p>}
      {preparations.some(p=>p.order_id===selected)&&<p className="text-xs text-emerald-700">Saved draft available for this India order.</p>}
     </div>
     <div className="rounded-lg border p-4"><h3 className="font-semibold">Courier Selection</h3>
      <p className="mt-2 text-sm">Use the rate-check page to compare eligible couriers. Selection/booking is disabled until KYC approval, verified payment, shipping data and duplicate safeguards are operational.</p>
      <Link href="/admin/india-shipping/rates" className="mt-3 inline-block rounded-lg border px-4 py-2 text-sm">Compare Rates</Link>
     </div>
     <div className="rounded-lg border p-4"><h3 className="font-semibold">Tracking History</h3>
      {history.length===0?<p className="mt-2 text-sm">No events recorded for this order.</p>:<ol className="mt-3 space-y-2">{history.map((e,i)=><li key={i} className="border-l-2 pl-3 text-sm"><strong>{e.event_status||'Status update'}</strong><div className="text-gray-500">{formatDate(e.event_occurred_at||e.received_at)}</div></li>)}</ol>}
     </div>
    </>}
   </section>
  </div>}
 </main>;
}