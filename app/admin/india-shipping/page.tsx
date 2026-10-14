'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase/client';
type Order={id:string;order_number:string|null;customer_name:string|null;delivery_address:string|null;status:string|null;payment_status:string|null;grand_total:number|null;created_at:string};
type Shipment={id:string;order_id:string;external_shipment_id:string|null;awb:string|null;courier_company_id:number|null;tracking_status:string|null;pickup_approved_at:string|null};
type Event={shipment_id:string;event_status:string|null;received_at:string;event_occurred_at:string|null};
const formatDate=(s:string)=>new Date(s).toLocaleString('en-IN');
export default function IndiaShippingDashboard(){
 const [orders,setOrders]=useState<Order[]>([]),[shipments,setShipments]=useState<Shipment[]>([]),[events,setEvents]=useState<Event[]>([]);
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let alive=true;(async()=>{try{
 const {data:session}=await supabase.auth.getSession();
 if(!session.session?.access_token)throw new Error('India Admin login required');
 const {data,error:invokeError}=await supabase.functions.invoke('india-shipping-admin-overview',{
 method:'POST',body:{},headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
 if(invokeError||data?.ok!==true||!Array.isArray(data.orders))throw new Error('Cannot load India shipping data. Verify India Admin access.');
 if(alive){setOrders(data.orders);setShipments(data.shipments??[]);setEvents(data.events??[]);}
 }catch(e){if(alive)setError(e instanceof Error?e.message:'Unable to load shipping data');}
 finally{if(alive)setLoading(false);}})();return()=>{alive=false};},[]);
 const filtered=orders.filter(x=>([x.order_number,x.customer_name,x.id].join(' ').toLowerCase().includes(search.toLowerCase())));
 const order=orders.find(x=>x.id===selected)??null;
 const shipment=shipments.find(x=>x.order_id===selected);
 const history=events.filter(x=>x.shipment_id===shipment?.id);
 return <main className="mx-auto max-w-6xl space-y-5 p-5 sm:p-7">
  <div className="space-y-2"><h1 className="text-2xl font-bold">India Shipping Management</h1>
   <p className="text-sm text-gray-600">Read-only preparation dashboard. Shiprocket KYC is under review. No shipment booking, AWB generation, courier assignment or pickup is enabled.</p></div>
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