import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-gazi-country","Access-Control-Max-Age":"600"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
const isRecord=(v:unknown):v is Record<string,any>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const pinOk=(v:unknown):v is string=>typeof v==="string"&&/^[1-9][0-9]{5}$/.test(v);
const num=(v:unknown)=>Number(v);
const clean=(v:unknown,max=200)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
const states:Record<string,string>={AN:"Andaman and Nicobar Islands",AP:"Andhra Pradesh",AR:"Arunachal Pradesh",AS:"Assam",BR:"Bihar",CH:"Chandigarh",CT:"Chhattisgarh",CG:"Chhattisgarh",DN:"Dadra and Nagar Haveli and Daman and Diu",DD:"Dadra and Nagar Haveli and Daman and Diu",GA:"Goa",GJ:"Gujarat",HR:"Haryana",HP:"Himachal Pradesh",JK:"Jammu and Kashmir",JH:"Jharkhand",KA:"Karnataka",KL:"Kerala",LA:"Ladakh",LD:"Lakshadweep",MP:"Madhya Pradesh",MH:"Maharashtra",MN:"Manipur",ML:"Meghalaya",MZ:"Mizoram",NL:"Nagaland",OD:"Odisha",OR:"Odisha",PB:"Punjab",PY:"Puducherry",RJ:"Rajasthan",SK:"Sikkim",TN:"Tamil Nadu",TS:"Telangana",TR:"Tripura",UP:"Uttar Pradesh",UK:"Uttarakhand",UA:"Uttarakhand",WB:"West Bengal"};

function environmentFor(url:string){
  if(url.includes("ufxsthshyebahkwbmioe.supabase.co"))return "production";
  if(url.includes("qqehtphbpypcmxliaiqd.supabase.co"))return "staging";
  return "";
}
async function quote(token:string,base:string,pickupPin:string,deliveryPin:string,weightKg:number,dims:number[],cod:number){
  const headers={Authorization:`Token ${token}`,Accept:"application/json"};
  const pinUrl=new URL("/c/api/pin-codes/json/",base);pinUrl.searchParams.set("filter_codes",deliveryPin);
  const pr=await fetch(pinUrl,{headers,cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!pr.ok)throw new Error("delhivery_serviceability_unavailable");
  const pp:unknown=await pr.json();
  if(!isRecord(pp)||!Array.isArray(pp.delivery_codes))throw new Error("delhivery_response_invalid");
  const match=pp.delivery_codes.find((e:unknown)=>{
    if(!isRecord(e))return false;const pc=isRecord(e.postal_code)?e.postal_code:{};
    return String(pc.pin??"")===deliveryPin&&!String(pc.remark??e.remark??"").trim();
  });
  if(!isRecord(match))throw new Error("delhivery_pin_not_serviceable");
  const postal=isRecord(match.postal_code)?match.postal_code:{};
  const city=clean(postal.city??postal.district??postal.region,80),stateValue=clean(postal.state??postal.state_code,80);
  const state=/^[A-Za-z]{2,3}$/.test(stateValue)?states[stateValue.toUpperCase()]??"":stateValue;
  if(!city||!state)throw new Error("delhivery_destination_details_unavailable");
  const paymentMode=cod>0?"COD":"Pre-paid";
  const rateUrl=new URL("/api/kinko/v1/invoice/charges/.json",base);
  for(const [k,v] of Object.entries({md:"S",ss:"Delivered",o_pin:pickupPin,d_pin:deliveryPin,cgm:String(Math.round(weightKg*1000)),pt:paymentMode,cod:String(cod),l:String(dims[0]),b:String(dims[1]),h:String(dims[2])}))rateUrl.searchParams.set(k,v);
  const rr=await fetch(rateUrl,{headers,cache:"no-store",signal:AbortSignal.timeout(15000)});
  if(!rr.ok)throw new Error("delhivery_rate_unavailable");
  const rp:unknown=await rr.json();
  const rows=Array.isArray(rp)?rp:isRecord(rp)&&Array.isArray(rp.data)?rp.data:null;
  if(!rows?.length||!isRecord(rows[0]))throw new Error("delhivery_response_invalid");
  const amount=Number(rows[0].total_amount);
  if(!Number.isFinite(amount)||amount<0||amount>100000)throw new Error("delhivery_response_invalid");
  return {amount,city,state};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return reply(405,{ok:false,code:"method_not_allowed"});
  const jwt=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
  if(!jwt)return reply(401,{ok:false,code:"authentication_required"});
  const url=Deno.env.get("SUPABASE_URL")??"",publishable=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"",secrets=Deno.env.get("SUPABASE_SECRET_KEYS")??"";
  const env=environmentFor(url),configured=(Deno.env.get("DELHIVERY_API_ENVIRONMENT")??env).trim().toLowerCase();
  const token=Deno.env.get("DELHIVERY_API_TOKEN")??"",base=env==="production"?"https://track.delhivery.com":env==="staging"?"https://staging-express.delhivery.com":"";
  const enabled=Deno.env.get("DELHIVERY_BOOKING_ENABLED")==="true"||(env==="production"&&Deno.env.get("DELHIVERY_BOOKING_ENABLED")!=="false");
  const location=Deno.env.get("DELHIVERY_PICKUP_LOCATION")??"GAZISEEDB2C-B2C";
  if(!env||configured!==env||!enabled||!url||!publishable||!secrets||!token||!base)return reply(503,{ok:false,code:"delhivery_booking_not_configured"});
  let db:ReturnType<typeof createClient>|null=null;let shipmentId:string|null=null;let claimed=false;
  try{
    const keys:unknown=JSON.parse(publishable),secret:unknown=JSON.parse(secrets);
    if(!isRecord(keys)||typeof keys.default!=="string"||!isRecord(secret)||typeof secret.default!=="string")return reply(503,{ok:false,code:"supabase_configuration_unavailable"});
    const auth=createClient(url,keys.default,{global:{headers:{Authorization:`Bearer ${jwt}`,"x-gazi-country":"IN"}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:identity,error:authErr}=await auth.auth.getUser(jwt);
    if(authErr||!identity.user)return reply(401,{ok:false,code:"authentication_required"});
    const [admin,country]=await Promise.all([auth.rpc("is_admin"),auth.rpc("current_admin_country")]);
    if(admin.error||country.error||admin.data!==true||String(country.data??"").toUpperCase()!=="IN")return reply(403,{ok:false,code:"india_admin_only"});
    const input:unknown=await req.json();
    if(!isRecord(input)||typeof input.order_id!=="string"||!/^[0-9a-f-]{36}$/i.test(input.order_id)||
       !pinOk(input.pickup_pin)||!Number.isFinite(Number(input.accepted_charge))||Number(input.accepted_charge)<0||
       input.quote_environment!==env)return reply(400,{ok:false,code:"invalid_booking_request"});
    db=createClient(url,secret.default,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:snapshot,error:snapshotError}=await db.rpc("india_delhivery_booking_snapshot",{p_order:input.order_id});
    if(snapshotError||!isRecord(snapshot)||!isRecord(snapshot.order)||!isRecord(snapshot.parcel)||!Array.isArray(snapshot.items))return reply(409,{ok:false,code:"order_not_ready_for_delhivery"});
    const order=snapshot.order,parcel=snapshot.parcel,items=snapshot.items.filter(isRecord);
    const total=num(order.final_amount??order.grand_total),advance=num(order.payment_advance_amount??0),due=num(order.payment_due_amount??0);
    if(!Number.isFinite(total)||total<=0||total>50000)return reply(409,{ok:false,code:total>50000?"ewaybill_required":"invalid_order_total"});
    const cod=order.payment_method==="cod"?due:0;
    if(order.payment_method!="cod"&&order.payment_method!="cashfree")return reply(409,{ok:false,code:"unsupported_payment_mode"});
    if(order.payment_method==="cashfree"||advance>0){
      const {data:payment,error:paymentError}=await auth.functions.invoke("cashfree-verify-dispatch",{body:{orderId:order.id,status:"verify_only"}});
      if(paymentError||payment?.ok!==true||payment?.verified!==true)return reply(409,{ok:false,code:"cashfree_verification_required"});
    }
    const weight=num(parcel.weight_kg),dims=[num(parcel.length_cm),num(parcel.breadth_cm),num(parcel.height_cm)];
    if(!pinOk(parcel.delivery_pin)||!Number.isFinite(weight)||weight<0.01||weight>100||dims.some(x=>!Number.isFinite(x)||x<1||x>200)||!items.length)return reply(409,{ok:false,code:"invalid_parcel_snapshot"});
    const liveQuote=await quote(token,base,input.pickup_pin,parcel.delivery_pin,weight,dims,cod);
    const currentCharge=liveQuote.amount;
    const accepted=num(input.accepted_charge);
    if(currentCharge>accepted+1)return reply(409,{ok:false,code:"delhivery_quote_price_changed",current_charge:currentCharge,currency:"INR",environment:env});
    const productDesc=clean(items.map((i:Record<string,unknown>)=>`${clean(i.product_name,100)} x ${Math.max(0,Math.trunc(num(i.quantity)))}`).join(", "),250);
    if(!productDesc)return reply(409,{ok:false,code:"product_description_required"});
    const requestKey=crypto.randomUUID();
    const {data:reserved,error:reserveError}=await db.rpc("reserve_india_delhivery_booking",{p_order:order.id,p_actor:identity.user.id,p_key:requestKey});
    if(reserveError||typeof reserved!=="string")return reply(409,{ok:false,code:"shipment_already_exists_or_reservation_failed"});
    shipmentId=reserved;
    const {data:claimedResult,error:claimError}=await db.rpc("claim_india_delhivery_booking",{p_id:shipmentId,p_actor:identity.user.id});
    if(claimError||claimedResult!==true)return reply(409,{ok:false,code:"booking_claim_failed"});
    claimed=true;
    const orderRef=`GZ${String(order.id).replaceAll("-","").slice(0,32)}`;
    // Delhivery supplies seller GST from this account's Company Details default.
    // Active India catalog items are vegetable/flower seeds for sowing (CBIC heading 1209).
    const shipment={name:clean(order.customer_name,100),add:clean(order.delivery_address,250),pin:parcel.delivery_pin,
      city:liveQuote.city,state:liveQuote.state,country:"India",phone:String(order.customer_phone).replace(/\D/g,"").slice(-12),order:orderRef,
      payment_mode:cod>0?"COD":"Pre-paid",products_desc:productDesc,quantity:items.reduce((sum:number,i:Record<string,unknown>)=>sum+Math.max(0,Math.trunc(num(i.quantity))),0),
      invoice_reference:orderRef,
      hsn_code:"1209",
      total_amount:total,cod_amount:cod,weight:Math.round(weight*1000),shipment_length:dims[0],shipment_width:dims[1],shipment_height:dims[2]};
    const body=new URLSearchParams({format:"json",data:JSON.stringify({pickup_location:{name:location},shipments:[shipment],...(parcel.fragile_shipment===true?{fragile_shipment:true}:{})})});
    const response=await fetch(new URL("/api/cmu/create.json",base),{method:"POST",headers:{Authorization:`Token ${token}`,Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store",signal:AbortSignal.timeout(20000)});
    const payload:unknown=await response.json().catch(()=>null);
    if(!response.ok||!isRecord(payload)||payload.success!==true||!Array.isArray(payload.packages)||payload.packages.length!==1||!isRecord(payload.packages[0]))throw new Error("manifest_outcome_uncertain");
    const waybill=String(payload.packages[0].waybill??"").trim();
    if(!/^[A-Za-z0-9-]{4,64}$/.test(waybill))throw new Error("manifest_outcome_uncertain");
    const {data:recorded,error:recordError}=await db.rpc("record_india_delhivery_manifest",{p_id:shipmentId,p_actor:identity.user.id,p_order_ref:orderRef,p_awb:waybill});
    if(recordError||recorded!==true)throw new Error("manifest_persistence_uncertain");
    return reply(200,{ok:true,environment:env,shipment_id:shipmentId,order_reference:orderRef,awb:waybill,accepted_charge:accepted,current_charge:currentCharge,currency:"INR",state:"awb_assigned"});
  }catch(e){
    if(claimed&&db&&shipmentId){try{await db.rpc("reconcile_india_delhivery_booking",{p_id:shipmentId,p_reason:e instanceof Error?e.message:"external_outcome_uncertain"});}catch{/* A submitting row stays locked if reconciliation persistence fails. */}return reply(409,{ok:false,code:"manual_shipment_reconciliation_required"});}
    return reply(503,{ok:false,code:e instanceof Error&&/^delhivery_/.test(e.message)?e.message:"delhivery_booking_failed"});
  }
});
