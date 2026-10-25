'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase/client';
type Order={id:string;order_number:string|null;customer_name:string|null;delivery_address:string|null;status:string|null;payment_status:string|null;payment_method:string|null;payment_advance_amount:number|null;payment_due_amount:number|null;cashfree_dispatch_verified_at:string|null;grand_total:number|null;created_at:string};
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
 const [mobileDetails,setMobileDetails]=useState(false);
 const [preflightLoading,setPreflightLoading]=useState(false),[preflightResult,setPreflightResult]=useState('');
 const [quoteLoading,setQuoteLoading]=useState(false),[quoteMessage,setQuoteMessage]=useState(''),[quote,setQuote]=useState<{name:string;estimatedCost:number;courierId:number}|null>(null);
 const [pickupPin,setPickupPin]=useState('783124');
 function chooseOrder(id:string){if(saving||preflightLoading||quoteLoading)return;setSelected(id);setQuote(null);setQuoteMessage('');setPreflightResult('');setSaveMessage('');setMobileDetails(true);window.scrollTo({top:0,behavior:'smooth'});}
 function backToOrders(){if(saving||preflightLoading||quoteLoading)return;setMobileDetails(false);window.scrollTo({top:0,behavior:'smooth'});}
 useEffect(()=>{let alive=true;(async()=>{try{
 const {data:session}=await supabase.auth.getSession();
 if(!session.session?.access_token)throw new Error('India Admin login required');
 const {data,error:invokeError}=await supabase.functions.invoke('india-shipping-admin-overview',{
 method:'POST',body:{},headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
 if(invokeError||data?.ok!==true||!Array.isArray(data.orders))throw new Error('Cannot load India shipping data. Verify India Admin access.');
 if(alive){setOrders(data.orders);setShipments(data.shipments??[]);setEvents(data.events??[]);setPreparations(data.preparations??[]);}
 }catch(e){if(alive)setError(e instanceof Error?e.message:'Unable to load shipping data');}
 finally{if(alive)setLoading(false);}})();return()=>{alive=false};},[]);
 useEffect(()=>{const saved=preparations.find(p=>p.order_id===selected);setPin(saved?.delivery_pin??'');setWeight(saved?String(saved.weight_kg):'');setLength(saved?String(saved.length_cm):'');setBreadth(saved?String(saved.breadth_cm):'');setHeight(saved?String(saved.height_cm):'');setNotes(saved?.packing_notes??'');},[selected,preparations]);
 async function checkPaymentPreflight(){
  if(!selected||preflightLoading)return;
  setPreflightLoading(true);setPreflightResult('');
  try{
   const {data:session}=await supabase.auth.getSession();
   if(!session.session?.access_token)throw new Error('India Admin login required');
   const {data,error:invokeError}=await supabase.functions.invoke('cashfree-verify-dispatch',{
    method:'POST',body:{orderId:selected,status:'verify_only'},headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
   if(invokeError||data?.ok!==true||data?.verified!==true){
    let reason=typeof data?.error==='string'?data.error:'Cashfree verification unavailable or order not eligible';
    if(invokeError?.context instanceof Response){try{const errorBody=await invokeError.context.clone().json();if(typeof errorBody?.error==='string')reason=errorBody.error;}catch{/* Preserve generic failure */}}
    throw new Error(reason);
   }
   setPreflightResult('Cashfree gateway verified for this check. Type: '+String(data.payment_type)+'; balance at delivery ₹'+Number(data.due_amount??0).toFixed(2)+'. Booking and dispatch remain disabled; verify again at booking.');
  }catch(e){setPreflightResult('Not verified: '+(e instanceof Error?e.message:'Unknown payment verification error'));}
  finally{setPreflightLoading(false);}
 }
 async function quoteSelectedOrder(){
  if(!selected||quoteLoading)return;
  const orderId=selected;
  setQuoteLoading(true);setQuote(null);setQuoteMessage('');
  try{
   const selectedOrder=orders.find(x=>x.id===orderId);
   const parcel=preparations.find(x=>x.order_id===orderId);
   if(!selectedOrder||!parcel)throw new Error('Select an order with saved parcel preparation');
   if(!/^[1-9][0-9]{5}$/.test(pickupPin)||!/^[1-9][0-9]{5}$/.test(parcel.delivery_pin))throw new Error('Valid pickup and delivery PINs required');
   const dims=[Number(parcel.weight_kg),Number(parcel.length_cm),Number(parcel.breadth_cm),Number(parcel.height_cm)];
   if(dims.some((n,i)=>!Number.isFinite(n)||n<(i===0?0.01:1)||n>(i===0?100:200)))throw new Error('Saved parcel measurements are invalid');
   const total=Number(selectedOrder.grand_total);
   const isCod=selectedOrder.payment_method?.toLowerCase()==='cod';
   const advance=Number(selectedOrder.payment_advance_amount??0);
   const due=Number(selectedOrder.payment_due_amount);
   const fullCod=isCod&&selectedOrder.payment_status==='unpaid'&&advance===0;
   const collect=isCod?(fullCod?total:due):0;
   if(!Number.isFinite(total)||total<=0||!Number.isFinite(collect)||collect<0||collect>total||
     (isCod&&collect<=0)||(isCod&&!fullCod&&Math.abs(advance+due-total)>0.01)||
     (!isCod&&selectedOrder.payment_method!=='cashfree'))throw new Error('Payment collection figures require manual reconciliation before quoting');
   const {data:session}=await supabase.auth.getSession();
   if(!session.session?.access_token)throw new Error('India Admin login required');
   const {data,error:invokeError}=await supabase.functions.invoke('india-shipping-rates',{
    body:{pickupPostcode:pickupPin,deliveryPostcode:parcel.delivery_pin,
     weightKg:dims[0],lengthCm:dims[1],breadthCm:dims[2],heightCm:dims[3],
     paymentMode:isCod?'cod':'prepaid',shipmentValue:total,codCollectionAmount:collect},
    headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
   if(invokeError||data?.ok!==true)throw new Error('Courier quotation unavailable. Do not book or retry a shipment.');
   const q=data.recommendedCourier;
   if(!q||!Number.isSafeInteger(q.courierId)||!Number.isFinite(q.estimatedCost)||q.estimatedCost<0)
    throw new Error('No eligible courier for these order details');
   if(orderId===selected){setQuote(q);setQuoteMessage('Read-only quote; requires live payment verification and booking-time price check.'+(fullCod?' Full COD balance is calculated from order total; stored due requires correction before booking.':''));}
  }catch(e){if(orderId===selected)setQuoteMessage(e instanceof Error?e.message:'Unable to quote order');}
  finally{setQuoteLoading(false);}
 }
 async function savePreparation(){
  if(saving)return;
  const draftOrderId=selected;
  setSaving(true);setSaveMessage('');
  try{
   if(!selected||!/^[1-9][0-9]{5}$/.test(pin))throw new Error('Enter a valid 6-digit delivery PIN');
   const dimensions=[weight,length,breadth,height].map(Number);
   if(dimensions.some((n,i)=>!Number.isFinite(n)||n<(i===0?0.01:1)||n>(i===0?100:200)))throw new Error('Enter valid weight (0.01–100 kg) and dimensions (1–200 cm)');
   if(notes.length>500)throw new Error('Packing notes cannot exceed 500 characters');
   const {data:session}=await supabase.auth.getSession();
   if(!session.session?.access_token)throw new Error('India Admin login required');
   const {data,error:saveError}=await supabase.functions.invoke('india-shipping-preparation',{method:'POST',
    body:{order_id:draftOrderId,delivery_pin:pin,weight_kg:dimensions[0],length_cm:dimensions[1],breadth_cm:dimensions[2],height_cm:dimensions[3],packing_notes:notes},
    headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
   if(saveError||data?.ok!==true){
    let code:unknown=data?.code;
    if(saveError?.context instanceof Response){try{const body=await saveError.context.json();code=body?.code;}catch{/* Network or invalid response */}}
    const messages:Record<string,string>={
     invalid_pin:'Delivery PIN must contain six digits.',
     invalid_dimensions:'Check parcel weight and dimensions.',
     invalid_notes:'Packing notes are too long.',
     shipment_already_created:'This order already has a shipment. Editing is disabled.',
     draft_save_failed:'Database could not save the draft. Please retry or ask admin to check logs.',
    };
    throw new Error(typeof code==='string'&&messages[code]?messages[code]:'Save failed. Please confirm India Admin access and retry.');
   }
   const {data:confirmed,error:refreshError}=await supabase.functions.invoke('india-shipping-admin-overview',{
    method:'POST',body:{},headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
   if(refreshError||confirmed?.ok!==true||!Array.isArray(confirmed.preparations)){
    throw new Error('Save response received, but draft could not be rechecked. Refresh the page before making further changes.');
   }
   setPreparations(confirmed.preparations);
   const saved=confirmed.preparations.find((p:Preparation)=>p.order_id===draftOrderId);
   const isPersisted=saved&&saved.delivery_pin===pin&&Number(saved.weight_kg)===dimensions[0]&&
    Number(saved.length_cm)===dimensions[1]&&Number(saved.breadth_cm)===dimensions[2]&&Number(saved.height_cm)===dimensions[3]&&
    saved.packing_notes===notes;
   if(!isPersisted)throw new Error('Draft not confirmed in database. Refresh and check the saved values.');
   setSaveMessage('Draft saved and verified from database. No shipment or AWB was created.');
  }catch(e){setSaveMessage(e instanceof Error?e.message:'Unable to save');}finally{setSaving(false);}
 }
 const filtered=orders.filter(x=>([x.order_number,x.customer_name,x.id].join(' ').toLowerCase().includes(search.toLowerCase())));
 const order=orders.find(x=>x.id===selected)??null;
 const shipment=shipments.find(x=>x.order_id===selected);
 const history=events.filter(x=>x.shipment_id===shipment?.id);
 const preparation=preparations.find(x=>x.order_id===selected);
 const isCod=order?.payment_method?.toLowerCase()==='cod';
 const total=Number(order?.grand_total??0);
 const isFullCod=Boolean(isCod&&order?.payment_status==='unpaid'&&Number(order?.payment_advance_amount??0)===0);
 const expectedCodAmount=isFullCod?Number(order?.grand_total??0):Number(order?.payment_due_amount);
 const due=Number(order?.payment_due_amount);
 const advance=Number(order?.payment_advance_amount??0);
 const paymentNeedsVerification=Boolean(order&&(order.payment_method==='cashfree'||(isCod&&advance>0)));
 const dispatchVerified=Boolean(order?.cashfree_dispatch_verified_at);
 const preparationReady=Boolean(preparation&&/^[1-9][0-9]{5}$/.test(preparation.delivery_pin)&&
  [Number(preparation.weight_kg),Number(preparation.length_cm),Number(preparation.breadth_cm),Number(preparation.height_cm)].every((n,i)=>Number.isFinite(n)&&n>=(i===0?0.01:1)));
 const preflightBlocks=order?[
  ...(!order.delivery_address?.trim()?['Customer address missing']:[]),
  ...(!preparationReady?['Save valid parcel preparation measurements']:[]),
  ...(shipment?.awb||shipment?.external_shipment_id?['External shipment already exists — duplicate booking prohibited']:[]),
  ...(paymentNeedsVerification&&!dispatchVerified?['Server-side Cashfree verification required for collected payments']:[]),
  ...(isCod&&(!Number.isFinite(expectedCodAmount)||expectedCodAmount<=0)?['COD amount cannot be determined safely']:[]),
  ...(isCod&&!isFullCod&&(Math.abs(advance+due-total)>0.01)?['Partial COD advance and due do not match order total']:[]),
  ...(isFullCod&&due===0?['Full COD database due is zero; normalize COD amount server-side before booking']:[]),
  ...(!isCod&&order.payment_method!=='cashfree'?['Unsupported payment method — manual review']:[]),
 ]:[];

 return <main className="mx-auto max-w-6xl space-y-5 p-5 sm:p-7">
  <div className="space-y-2"><h1 className="text-2xl font-bold">India Shipping Management</h1>
   <p className="text-sm text-gray-600">India-only order preparation drafts. Shiprocket KYC verified. No shipment booking, AWB generation, courier assignment or pickup is enabled.</p></div>
  <div className="flex flex-wrap gap-3"><Link className="rounded-lg bg-emerald-700 px-4 py-3 text-white" href="/admin/india-shipping/rates">Check Courier Rates</Link>
   <Link className="rounded-lg border px-4 py-3" href="/admin/india-shipping/delhivery">Delhivery Setup & Test</Link>
   <Link className="rounded-lg border px-4 py-3" href="/admin/india-shipping/connection">Test API Connection</Link></div>
  {loading&&<p role="status">Loading India orders…</p>}
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {!loading&&!error&&<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
   <section className={`${mobileDetails ? "hidden lg:block" : "block"} space-y-3 min-w-0`}><h2 className="text-lg font-semibold">Select India Order</h2>
    <input aria-label="Search India orders" placeholder="Search order number or customer" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-lg border p-3" />
    <p className="text-xs text-gray-500">Most recent 60 India orders, read-only</p>
    <div className="max-h-[550px] space-y-2 overflow-auto">{filtered.map(o=><button type="button" key={o.id} onClick={()=>chooseOrder(o.id)} disabled={saving}
     className={`w-full rounded-lg border p-3 text-left ${selected===o.id?'border-emerald-700 bg-emerald-50':''}`}>
      <span className="block font-semibold">{o.order_number||o.id.slice(0,8)} · {o.customer_name||'Customer'}</span>
      <span className="text-sm text-gray-600">{o.status||'Status unavailable'} · ₹{Number(o.grand_total??0).toFixed(2)} · {formatDate(o.created_at)}</span>
     </button>)}
     {filtered.length===0&&<p className="text-sm">No matching India orders found.</p>}</div>
   </section>
   <section id="shipping-order-details" className={`${mobileDetails ? "block" : "hidden lg:block"} min-w-0 space-y-4 break-words`}><button type="button" onClick={backToOrders} disabled={saving} className="rounded-lg border px-4 py-3 text-sm font-semibold lg:hidden">← Back to Orders</button><h2 className="text-lg font-semibold">Shipment Details & Tracking</h2>
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
     <div className="space-y-3 rounded-lg border p-4" role="region" aria-label="Phase 4 dispatch safety preflight">
      <h3 className="font-semibold">Phase 4 · Dispatch Safety Preflight</h3>
      <p className="text-sm">Payment mode: <strong>{order.payment_method||'Unknown'}</strong> · Advance recorded: ₹{advance.toFixed(2)} · Database due: ₹{Number.isFinite(due)?due.toFixed(2):'Unknown'} · Calculated COD collection: ₹{isCod&&Number.isFinite(expectedCodAmount)?expectedCodAmount.toFixed(2):'0.00'}</p>
      <p className="text-sm">Server-side Cashfree dispatch verification: <strong>{dispatchVerified?'Recorded (recheck at booking)':'Not recorded'}</strong></p>
      {preflightBlocks.length>0?<ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">{preflightBlocks.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p className="text-sm text-emerald-800">Preliminary data checks pass; live payment re-verification, courier quote, duplicate lock and admin consent still required.</p>}
      <button type="button" onClick={checkPaymentPreflight} disabled={preflightLoading||saving||!(order.payment_method==='cashfree'||(isCod&&advance>0))} className="rounded-lg border border-emerald-700 px-4 py-3 text-sm font-semibold disabled:opacity-50">{preflightLoading?'Checking Cashfree…':'Verify Cashfree Payment (read only)'}</button>
      {preflightResult&&<p role="status" aria-live="polite" className="rounded-lg border p-3 text-sm">{preflightResult}</p>}
      <p className="text-xs font-medium text-red-700">Booking, AWB and pickup remain disabled. This preflight uses read-only order data and does not authorize dispatch.</p>
     </div>
     <div className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Shipping Preparation · Save Draft</h3>
      <p className="text-xs text-gray-600">Check the customer address before entering the PIN. Minimum parcel weight 0.01 kg and each dimension 1 cm. Draft measurements do not confirm payment or authorize dispatch.</p>
      <div className="grid gap-3 sm:grid-cols-2">
       {([["Delivery PIN",pin,setPin,"700016"],["Weight (kg)",weight,setWeight,"0.5"],["Length (cm)",length,setLength,"15"],["Breadth (cm)",breadth,setBreadth,"10"],["Height (cm)",height,setHeight,"5"]] as const).map(([title,value,setter,placeholder])=><label key={title} className="flex flex-col gap-1 text-sm">{title}<input className="w-full rounded-lg border p-3" value={value} onChange={e=>setter(e.target.value)} placeholder={placeholder} inputMode={title==="Delivery PIN"?"numeric":"decimal"}/></label>)}
      </div>
      <label className="flex flex-col gap-1 text-sm">Packing notes (optional)<textarea className="rounded-lg border p-3" maxLength={500} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <button type="button" onClick={savePreparation} disabled={saving||!selected||Boolean(shipment?.awb||shipment?.external_shipment_id)} className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving?"Saving…":"Save Preparation Draft"}</button>
      {saveMessage&&<p role="status" aria-live="polite" className="rounded-lg border p-3 text-sm">{saveMessage}</p>}
      {preparations.some(p=>p.order_id===selected)&&<p className="text-xs text-emerald-700">Saved draft available for this India order.</p>}
      {preparations.some(p=>p.order_id===selected&&(Number(p.weight_kg)<0.01||Number(p.length_cm)<1||Number(p.breadth_cm)<1||Number(p.height_cm)<1))&&<p role="alert" className="text-sm font-medium text-amber-700">Previously saved measurements are too small for a practical parcel. Correct and save them before any future shipment.</p>}
     </div>
     <div className="rounded-lg border p-4"><h3 className="font-semibold">Courier Selection</h3>
      <p className="mt-2 text-sm">Quote the selected India order using saved parcel measurements and server-stored payment amounts. Courier booking remains disabled.</p>
      <label className="mt-3 flex flex-col gap-1 text-sm">Verified pickup PIN<input inputMode="numeric" className="rounded-lg border p-3" value={pickupPin} onChange={e=>setPickupPin(e.target.value)} /></label>
      <button type="button" className="mt-3 rounded-lg border border-emerald-700 px-4 py-3 text-sm font-semibold disabled:opacity-50" onClick={quoteSelectedOrder} disabled={quoteLoading||saving||!preparationReady}>{quoteLoading?'Checking eligible couriers…':'Find Cheapest Courier for This Order (quote only)'}</button>
      {quote&&<p role="status" className="mt-3 font-semibold">Auto-recommended: {quote.name} · ₹{quote.estimatedCost.toFixed(2)}</p>}
      {quoteMessage&&<p role="status" className="mt-2 text-xs">{quoteMessage}</p>}
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