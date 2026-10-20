import { bookIndiaShipment, type BookingPorts, type BookingSnapshot } from './india-orchestrator.ts';
import {verifyIndiaPrepaidReadback} from './india-provider-readback.ts';
import { prepareIndiaShipment } from './india-prepare.ts';
import { IndiaCourierClient, loginIndiaCourier, INDIA_SANDBOX_COURIER_BASE } from './india-client.ts';

type Database = { rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:any;error:any}> };
type Environment = Record<string,string|undefined>;
const SBX='https://qqehtphbpypcmxliaiqd.supabase.co', PROD='https://ufxsthshyebahkwbmioe.supabase.co';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type,x-gazi-country,x-supabase-api-version,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:object,status=200)=>Response.json(data,{status,headers:cors});
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export function createIndiaBookingApi(deps:{db:Database;authenticate(req:Request):Promise<string|null>;env:Environment;fetch?:typeof fetch}) {
 return async(req:Request):Promise<Response>=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({ok:false,code:'method_not_allowed'},405);
  const sandbox=deps.env.SUPABASE_URL===SBX;
  if(!sandbox&&deps.env.SUPABASE_URL!==PROD)return reply({ok:false,code:'project_unavailable'},503);
  const simulated=sandbox&&deps.env.INDIA_SHIPPING_BOOKING_MODE==='sandbox_simulated';
  const realSandbox=sandbox&&deps.env.INDIA_SHIPPING_BOOKING_MODE==='sandbox_provider';
  // Both settings remain absent/off in Production. Enable only after account contract/E2E review.
  const live=!sandbox&&deps.env.INDIA_SHIPPING_BOOKING_MODE==='live_prepaid'&&deps.env.INDIA_SHIPPING_PROVIDER_CONTRACT==='prepaid_v1_verified';
  let actor:string|null;
  try{actor=await deps.authenticate(req)}catch{return reply({ok:false,code:'authentication_unavailable'},503)}
  if(!actor)return reply({ok:false,code:'india_admin_required'},403);
  let body:Record<string,unknown>;
  try {const text=await req.text();if(text.length>8192)return reply({ok:false,code:'request_too_large'},413);
   body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();
  }catch{return reply({ok:false,code:'invalid_request'},400)}
  const allowed=body.action==='confirm_destination'?['action','orderId','city','state','postcode']:['action','orderId'];
  if(Object.keys(body).some(k=>!allowed.includes(k))||!validId(body.orderId)||!['preview','book','confirm_destination'].includes(String(body.action)))return reply({ok:false,code:'invalid_request'},400);
  const rpc=async(name:string,args:Record<string,unknown>)=>{const r=await deps.db.rpc(name,args);if(r.error)throw Error('database_operation_failed');return r.data;};
  const f=deps.fetch??fetch;
  try {
   if(body.action==='confirm_destination'){
    if(!simulated&&!realSandbox&&!live)return reply({ok:false,code:'destination_workflow_disabled'},503);
    if(typeof body.city!=='string'||typeof body.state!=='string'||typeof body.postcode!=='string')return reply({ok:false,code:'invalid_destination'},400);
    await rpc('confirm_india_shipping_destination',{p_order:body.orderId,p_actor:actor,p_city:body.city,p_state:body.state,p_pin:body.postcode});
    return reply({ok:true,confirmed:true,test_only:sandbox});
   }
   if(!simulated&&!realSandbox&&!live)return reply({ok:false,code:'live_booking_disabled'},503);
   const load=async(id:string):Promise<BookingSnapshot|null>=>{
    const context=await rpc('get_india_shipping_booking_context',{p_order:id,p_actor:actor});
    if(!context)return null;
    const pickup=deps.env.SHIPROCKET_PICKUP_POSTCODE,location=deps.env.SHIPROCKET_PICKUP_LOCATION;
    if(!pickup||!/^[1-9][0-9]{5}$/.test(pickup)||!location)return null;
    return {...context,revision:JSON.stringify(context),pickupLocation:location,parcel:{...context.parcel,pickupPostcode:pickup}};
   };
   const verify:BookingPorts['verifyCashfree']=async s=>{
    if(!s.intent||!Number.isFinite(Number(s.intent.amount)))return null;
    const app=deps.env[sandbox?'STEP22_CASHFREE_SANDBOX_APP_ID':'CASHFREE_APP_ID'];
    const secret=deps.env[sandbox?'STEP22_CASHFREE_SANDBOX_SECRET_KEY':'CASHFREE_SECRET_KEY'];
    if(!app||!secret)return null;
    const root=(sandbox?'https://sandbox.cashfree.com':'https://api.cashfree.com')+'/pg/orders/'+encodeURIComponent(s.intent.providerOrderId);
    const get=async(path:string)=>{const r=await f(root+path,{headers:{'x-api-version':'2025-01-01','x-client-id':app,'x-client-secret':secret},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('gateway_unavailable');return r.json()};
    const [order,payments,refunds]=await Promise.all([get(''),get('/payments'),get('/refunds')]);
    const amount=Number(s.order.final_amount);
    if(order.order_id!==s.intent.providerOrderId||order.order_status!=='PAID'||order.order_currency!=='INR'||!Number.isFinite(amount)||!Number.isFinite(Number(order.order_amount))||Math.abs(Number(order.order_amount)-amount)>0.01||Math.abs(Number(s.intent.amount)-amount)>0.01||
      !Array.isArray(refunds)||refunds.some(r=>!r||!['FAILED','CANCELLED'].includes(String(r.refund_status).toUpperCase()))||
      !Array.isArray(payments))return null;
    const paid=payments.filter(p=>p&&p.payment_status==='SUCCESS');
    if(paid.length!==1||paid[0].order_id!==s.intent.providerOrderId||paid[0].payment_currency!=='INR'||!Number.isFinite(Number(paid[0].payment_amount))||Math.abs(Number(paid[0].payment_amount)-amount)>0.01||!((typeof paid[0].cf_payment_id==='string'&&paid[0].cf_payment_id.length>0)||(typeof paid[0].cf_payment_id==='number'&&Number.isSafeInteger(paid[0].cf_payment_id)&&paid[0].cf_payment_id>0)))return null;
    return {verified:true,gatewayOrderStatus:'PAID',currency:'INR',paidAmount:amount,refundClear:true,completedIntentCount:1};
   };
   let courier:IndiaCourierClient|undefined;
   const provider=async()=>courier??=await loginIndiaCourier(deps.env[realSandbox?'SHIPROCKET_SANDBOX_API_EMAIL':'SHIPROCKET_API_EMAIL']??'',deps.env[realSandbox?'SHIPROCKET_SANDBOX_API_PASSWORD':'SHIPROCKET_API_PASSWORD']??'',realSandbox?INDIA_SANDBOX_COURIER_BASE:undefined);
   const quote:BookingPorts['quote']=async s=>simulated?{data:{available_courier_companies:[{courier_company_id:900001,courier_name:'Sandbox simulated courier',rate:25,pickup_availability:1}]}}:(await provider()).serviceability(s.parcel);
   if(body.action==='preview'){
    const s=await load(body.orderId);if(!s)return reply({ok:false,code:'authoritative_context_incomplete'},409);
    const evidence=await verify(s),q=await quote(s);
    const plan=prepareIndiaShipment({...s,sourceOrderNumber:s.orderNumber,immutableRequestKey:s.requestKey,verifiedGateway:evidence,serviceabilityResponse:q,invoice:s.invoice});
    if(!plan)return reply({ok:false,code:'payment_parcel_or_provider_contract_blocked'},409);
    return reply({ok:true,ready:true,test_only:sandbox,provider_mode:simulated?'simulated':realSandbox?'shiprocket_sandbox':'live',courierId:plan.courierCompanyId,estimatedCost:plan.estimatedCourierCost,collectOnDelivery:plan.collectOnDelivery,bookingEnabled:simulated||realSandbox||live,shipmentCreated:false});
   }
   const s=await load(body.orderId);if(!s)return reply({ok:false,code:'authoritative_context_incomplete'},409);
   const numericId=Number.parseInt(s.orderId.replace(/-/g,'').slice(-10),16)+90000000;
   const ports:BookingPorts={enabled:simulated||realSandbox||live,
    authorizeIndiaAdmin:async()=>{try{await rpc('get_india_shipping_booking_context',{p_order:body.orderId,p_actor:actor});return actor}catch{return null}},
    loadOrder:load,verifyCashfree:verify,quote,
    reserve:async snapshot=>rpc('reserve_india_shipping_booking',{p_order:snapshot.orderId,p_actor:actor,p_key:snapshot.requestKey}),
    claim:async id=>rpc('claim_india_shipping_booking',{p_id:id,p_actor:actor}),
    createOrder:async payload=>simulated?{order_id:numericId,shipment_id:numericId+1}:(await provider()).createOrder(payload),
    recordExternal:async(id,order,shipment,c)=>rpc('record_india_shipping_external_order',{p_shipment_id:id,p_external_order_id:String(order),p_external_shipment_id:String(shipment),p_courier_company_id:c}),
    verifyExternalOrder:async(order,shipment,snapshot)=>{
     if(simulated)return true;
     const result=await (await provider()).getOrder(order);
     return verifyIndiaPrepaidReadback(result,order,shipment,snapshot);
    },
    assignAwb:async(id,c)=>simulated?{awb_assign_status:1,response:{data:{shipment_id:id,courier_company_id:c,awb_code:'SBX-'+id}}}:(await provider()).assignAwb(id,c),
    recordAwb:async(id,shipment,awb)=>rpc('record_india_shipping_awb',{p_shipment_id:id,p_external_shipment_id:String(shipment),p_awb:awb}),
    markReconcile:async id=>{await rpc('reconcile_india_shipping_booking',{p_id:id})},
   };
   const result=await bookIndiaShipment(body.orderId,ports);
   return reply({...result,test_only:sandbox,provider_mode:simulated?'simulated':realSandbox?'shiprocket_sandbox':'live',live_shipment_created:live&&result.ok,pickup_requested:false},result.ok?200:409);
  }catch{return reply({ok:false,code:'shipping_operation_unavailable'},503)}
 };
}
