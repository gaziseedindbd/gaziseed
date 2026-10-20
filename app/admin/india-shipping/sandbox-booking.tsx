'use client';
import {useRef,useState} from 'react';
import {supabase,cashfreeEnvironmentLabel} from '@/lib/supabase/client';

type Preview={orderId:string;courierId:number;estimatedCost:number};
export default function SandboxBooking({orderId,pin,address,hasShipment,blocked,onBusy,onBooked}:{orderId:string;pin:string;address:string;hasShipment:boolean;blocked:boolean;onBusy:(busy:boolean)=>void;onBooked:()=>Promise<void>}){
 const [city,setCity]=useState(''),[state,setState]=useState('');
 const [confirmed,setConfirmed]=useState(false),[preview,setPreview]=useState<Preview|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[consent,setConsent]=useState(false),[attempted,setAttempted]=useState(false);
 const inFlight=useRef(false);
 if(cashfreeEnvironmentLabel!=='Sandbox')return null;
 async function run(action:'confirm_destination'|'preview'|'book'){
  if(blocked||inFlight.current||hasShipment||attempted)return;
  if(action==='book'&&(!consent||!preview||preview.orderId!==orderId))return;
  inFlight.current=true;setBusy(true);onBusy(true);setMessage('');
  if(action==='book')setAttempted(true);
  try{
   const {data:session}=await supabase.auth.getSession();
   if(!session.session?.access_token)throw Error('India Admin login required.');
   const body=action==='confirm_destination'?{action,orderId,city:city.trim(),state:state.trim(),postcode:pin}:{action,orderId};
   const {data,error}=await supabase.functions.invoke('india-shipping-booking',{method:'POST',body,headers:{Authorization:'Bearer '+session.session.access_token,'x-gazi-country':'IN'}});
   if(error||data?.ok!==true){
    let code=data?.code||data?.state;
    if(error?.context instanceof Response){try{const result=await error.context.clone().json();code=result.code||result.state;}catch{/* Use generic message */}}
    const errors:Record<string,string>={duplicate:'Booking already reserved. Refresh and inspect its saved state; do not retry.',reconcile_required:'Booking outcome needs reconciliation. Do not retry or clear the reservation.',authoritative_context_incomplete:'Check packed status, paid prepaid order, saved parcel, confirmed address and invoice items.',payment_parcel_or_provider_contract_blocked:'Payment, refund, parcel or courier checks blocked booking.',live_booking_disabled:'Booking is disabled for this environment.',india_admin_required:'An active India Admin login is required.'};
    throw Error(errors[String(code)]||'Request failed. Refresh and inspect the order before any further booking attempt.');
   }
   if(data.test_only!==true)throw Error('Unexpected environment response. Stop and ask an administrator to inspect the order.');
   if(action==='confirm_destination'){setConfirmed(true);setPreview(null);setConsent(false);setMessage('Destination confirmed against this saved address and PIN.');}
   if(action==='preview'){
    if(data.ready!==true||data.bookingEnabled!==true||data.collectOnDelivery!==0||!Number.isSafeInteger(data.courierId)||!Number.isFinite(data.estimatedCost))throw Error('Booking preflight is incomplete.');
    setPreview({orderId,courierId:data.courierId,estimatedCost:data.estimatedCost});setConsent(false);setMessage('Prepaid preflight passed. Payment and saved details will be checked again when booking.');
   }
   if(action==='book'){
    if(data.state!=='awb_assigned'||data.live_shipment_created!==false||data.pickup_requested!==false)throw Error('Unexpected booking outcome. Inspect the saved shipment; do not retry.');
    await onBooked();setMessage('Sandbox booking saved. Simulated AWB assigned; no real shipment or pickup created.');
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Booking unavailable.');if(action!=='book')setPreview(null);}
  finally{inFlight.current=false;setBusy(false);onBusy(false);}
 }
 const locked=blocked||busy||hasShipment||attempted;
 return <section className="space-y-3 rounded-lg border border-amber-500 p-4" aria-label="Sandbox prepaid booking">
  <h3 className="font-semibold">Sandbox Prepaid Booking</h3>
  <p className="text-sm">Courier responses are simulated. Payment and database checks use Sandbox. No real parcel will be booked or collected.</p>
  <p className="text-sm"><strong>Saved address:</strong> {address||'Missing'} · <strong>PIN:</strong> {pin||'Missing'}</p>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="flex flex-col gap-1 text-sm">Delivery city<input value={city} maxLength={80} disabled={locked} onChange={e=>{setCity(e.target.value);setConfirmed(false);setPreview(null);setConsent(false);}} className="rounded-lg border p-3" /></label>
   <label className="flex flex-col gap-1 text-sm">Delivery state<input value={state} maxLength={80} disabled={locked} onChange={e=>{setState(e.target.value);setConfirmed(false);setPreview(null);setConsent(false);}} className="rounded-lg border p-3" /></label>
  </div>
  <p className="text-xs">Check city, state and PIN against the customer’s address before confirming. COD booking is unavailable.</p>
  <button type="button" disabled={locked||!city.trim()||!state.trim()||!pin||!address} onClick={()=>run('confirm_destination')} className="rounded-lg border px-4 py-3 text-sm disabled:opacity-50">Confirm Sandbox Destination</button>
  <button type="button" disabled={locked||!confirmed} onClick={()=>run('preview')} className="rounded-lg border px-4 py-3 text-sm disabled:opacity-50">Check Sandbox Booking</button>
  {preview&&<><p className="text-sm">Simulated courier {preview.courierId} · ₹{preview.estimatedCost.toFixed(2)} · collect at delivery ₹0.00</p><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} disabled={locked} onChange={e=>setConsent(e.target.checked)} />I checked this order and consent to one Sandbox booking attempt.</label></>}
  <button type="button" disabled={locked||!preview||!consent} onClick={()=>run('book')} className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?'Checking…':'Book Sandbox Shipment'}</button>
  {hasShipment&&<p className="text-sm">Shipment already exists. Duplicate booking is blocked.</p>}
  {message&&<p role="status" aria-live="polite" className="rounded-lg border p-3 text-sm">{message}</p>}
 </section>;
}
