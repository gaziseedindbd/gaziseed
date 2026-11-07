import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-gazi-country","Access-Control-Max-Age":"600"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
const isRecord=(v:unknown):v is Record<string,any>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const clean=(v:unknown,max=240)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
const pinOk=(v:unknown):v is string=>typeof v==="string"&&/^[1-9][0-9]{5}$/.test(v);
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);
const todayIndia=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const base="https://app.elite.ekartlogistics.in";
let cachedToken="",tokenExpiry=0;

async function authToken(){
  if(cachedToken&&Date.now()<tokenExpiry)return cachedToken;
  const clientId=Deno.env.get("EKART_CLIENT_ID")??"",username=Deno.env.get("EKART_USERNAME")??"",password=Deno.env.get("EKART_PASSWORD")??"";
  if(!clientId||!username||!password)throw new Error("ekart_credentials_missing");
  const response=await fetch(`${base}/integrations/v2/auth/token/${encodeURIComponent(clientId)}`,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({username,password}),cache:"no-store",signal:AbortSignal.timeout(15000)});
  const payload:unknown=await response.json().catch(()=>null);
  if(!response.ok||!isRecord(payload)||typeof payload.access_token!=="string")throw new Error("ekart_auth_failed");
  cachedToken=payload.access_token;tokenExpiry=Date.now()+Math.max(60,Number(payload.expires_in||3600)-300)*1000;
  return cachedToken;
}
async function ekart(path:string,method="GET",token?:string,body?:unknown){
  const access=token??await authToken();
  const response=await fetch(new URL(path,base),{method,headers:{Authorization:`Bearer ${access}`,Accept:"application/json",...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(25000)});
  const type=response.headers.get("content-type")??"";
  const payload=type.includes("json")?await response.json().catch(()=>null):await response.text().catch(()=>"");
  if(!response.ok)throw new Error(`ekart_upstream_${response.status}`);
  return {payload,contentType:type,bytes:type.includes("pdf")?null:null};
}
type EkartAddress={alias:string;phone:string;address_line1:string;address_line2:string;pincode:string;city:string;state:string;country:string};
async function ekartAddresses():Promise<EkartAddress[]>{
  const {payload}=await ekart("/api/v2/addresses");
  if(!Array.isArray(payload))throw new Error("ekart_addresses_unavailable");
  return payload.filter(isRecord).map((a:any)=>({alias:clean(a.alias,80),phone:String(a.phone??""),address_line1:clean(a.address_line1,240),address_line2:clean(a.address_line2,240),pincode:String(a.pincode??""),city:clean(a.city,80),state:clean(a.state,80),country:clean(a.country||"India",20)})).filter(a=>a.alias&&pinOk(a.pincode)&&a.address_line1);
}
async function resolvePickup(input:Record<string,any>){
  const requestedAlias=clean(input.pickupAlias,80);
  if(requestedAlias){
    const matches=(await ekartAddresses()).filter(a=>a.alias.toLowerCase()===requestedAlias.toLowerCase());
    if(matches.length!==1)throw new Error("ekart_pickup_location_not_found");
    const a=matches[0];
    if(input.pickupPin&&String(input.pickupPin)!==a.pincode)throw new Error("ekart_pickup_pin_mismatch");
    return {...a,alias:a.alias};
  }
  const configuredPin=Deno.env.get("EKART_PICKUP_PIN")??"";
  if(!pinOk(configuredPin))throw new Error("ekart_pickup_location_required");
  // No alias keeps the existing single-location setup working. Confirm the
  // account does not have multiple choices before using that fallback.
  const saved=await ekartAddresses();
  if(saved.length>1)throw new Error("ekart_pickup_location_required");
  if(saved.length===1){const a=saved[0];if(input.pickupPin&&String(input.pickupPin)!==a.pincode)throw new Error("ekart_pickup_pin_mismatch");return a;}
  return {alias:"",phone:Deno.env.get("EKART_PICKUP_PHONE")??"",address_line1:Deno.env.get("EKART_PICKUP_ADDRESS")??Deno.env.get("EKART_SELLER_ADDRESS")??"",address_line2:"",pincode:configuredPin,city:Deno.env.get("EKART_PICKUP_CITY")??"",state:Deno.env.get("EKART_PICKUP_STATE")??"",country:"India"};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return reply(405,{ok:false,code:"method_not_allowed"});
  const jwt=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
  if(!jwt)return reply(401,{ok:false,code:"authentication_required"});
  const url=Deno.env.get("SUPABASE_URL")??"",publishable=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"",secrets=Deno.env.get("SUPABASE_SECRET_KEYS")??"";
  if(!url||!publishable||!secrets)return reply(503,{ok:false,code:"supabase_configuration_unavailable"});
  let db:ReturnType<typeof createClient>|null=null;
  try{
    const keys:unknown=JSON.parse(publishable),secret:unknown=JSON.parse(secrets);
    if(!isRecord(keys)||typeof keys.default!=="string"||!isRecord(secret)||typeof secret.default!=="string")return reply(503,{ok:false,code:"supabase_configuration_unavailable"});
    const auth=createClient(url,keys.default,{global:{headers:{Authorization:`Bearer ${jwt}`,"x-gazi-country":"IN"}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:identity,error:authErr}=await auth.auth.getUser(jwt);
    if(authErr||!identity.user)return reply(401,{ok:false,code:"authentication_required"});
    const [admin,country]=await Promise.all([auth.rpc("is_admin"),auth.rpc("current_admin_country")]);
    if(admin.error||country.error||admin.data!==true||String(country.data??"").toUpperCase()!=="IN")return reply(403,{ok:false,code:"india_admin_only"});
    const input:unknown=await req.json();if(!isRecord(input)||typeof input.action!=="string")return reply(400,{ok:false,code:"invalid_request"});
    db=createClient(url,secret.default,{auth:{persistSession:false,autoRefreshToken:false}});

    if(input.action==="overview"){
      const {data:orders,error:oe}=await db.from("orders").select("id,order_number,customer_name,customer_phone,delivery_address,special_instructions,status,payment_method,payment_status,payment_advance_amount,payment_due_amount,final_amount,grand_total,created_at").eq("country_code","IN").order("created_at",{ascending:false}).limit(120);
      if(oe)return reply(503,{ok:false,code:"orders_unavailable"});
      const ids=(orders??[]).map((o:any)=>o.id);
      const [s,p,profiles,items]=await Promise.all([
        db.from("india_shipping_shipments").select("id,order_id,provider,creation_state,external_shipment_id,external_order_id,awb,tracking_status,tracking_occurred_at,pickup_request_state,ekart_pickup_alias,ekart_manifest_number,ekart_manifest_url,ekart_tracking_payload,ekart_last_synced_at,ekart_picked_up_at,ekart_delivered_at,reconcile_reason,created_at,updated_at").eq("country_code","IN").order("updated_at",{ascending:false}).limit(300),
        ids.length?db.from("india_shipping_preparations").select("order_id,delivery_pin,weight_kg,length_cm,breadth_cm,height_cm,packing_notes").in("order_id",ids):Promise.resolve({data:[],error:null}),
        Promise.resolve({data:[],error:null}),
        ids.length?db.from("order_items").select("id,order_id,product_name,quantity,total_price").in("order_id",ids).gt("quantity",0):Promise.resolve({data:[],error:null}),
      ]);
      if(s.error||p.error||items.error)return reply(503,{ok:false,code:"shipping_data_unavailable"});
      const gstin=Deno.env.get("EKART_SELLER_GSTIN")??"";
      const sellerConfigured=!!Deno.env.get("EKART_SELLER_NAME")?.trim()&&!!Deno.env.get("EKART_SELLER_ADDRESS")?.trim(); // Ekart account accepts shipments without GSTIN; keep the payload field blank when unset.
      return reply(200,{ok:true,orders:orders??[],shipments:s.data??[],preparations:p.data??[],packageProfiles:profiles.data??[],items:items.data??[],credentialsConfigured:!!Deno.env.get("EKART_CLIENT_ID")&&!!Deno.env.get("EKART_USERNAME")&&!!Deno.env.get("EKART_PASSWORD"),sellerConfigured,pickupPin:Deno.env.get("EKART_PICKUP_PIN")??""});
    }

    if(input.action==="serviceability"){
      if(!pinOk(input.pickupPin)||!pinOk(input.dropPin)||!Number.isInteger(input.weightGrams)||input.weightGrams<1||input.weightGrams>50000||![input.lengthCm,input.widthCm,input.heightCm].every(x=>Number.isInteger(x)&&x>0&&x<=200)||!Number.isFinite(Number(input.invoiceAmount))||Number(input.invoiceAmount)<1||(input.paymentType!=="COD"&&input.paymentType!=="Prepaid"))return reply(400,{ok:false,code:"invalid_serviceability_request"});
      const pickup=await resolvePickup(input);if(input.pickupPin!==pickup.pincode)return reply(400,{ok:false,code:"pickup_pin_mismatch"});
      const payload={pickupPincode:pickup.pincode,dropPincode:input.dropPin,length:String(input.lengthCm),width:String(input.widthCm),height:String(input.heightCm),weight:String(input.weightGrams),paymentType:input.paymentType,serviceType:input.serviceType==="EXPRESS"?"EXPRESS":"SURFACE",invoiceAmount:String(input.invoiceAmount),...(input.paymentType==="COD"?{codAmount:String(input.codAmount)}:{})};
      if(input.paymentType==="COD"&&(!Number.isFinite(Number(input.codAmount))||Number(input.codAmount)<=0||Number(input.codAmount)>49999||Number(input.codAmount)>Number(input.invoiceAmount)))return reply(400,{ok:false,code:"invalid_cod_amount"});
      const {payload:result}=await ekart("/data/v3/serviceability","POST",undefined,payload);
      const row=Array.isArray(result)?result[0]:null;const amount=Number(isRecord(row)&&isRecord(row.forwardDeliveredCharges)?row.forwardDeliveredCharges.totalForwardDeliveredEstimate:NaN);
      if(!Array.isArray(result)||!result.length||!Number.isFinite(amount)||amount<0||amount>100000)return reply(409,{ok:false,code:"ekart_rate_quote_unavailable"});
      return reply(200,{ok:true,result,estimatedCharge:amount,currency:"INR"});
    }

    if(input.action==="pin_lookup"){
      if(!pinOk(input.pin))return reply(400,{ok:false,code:"invalid_pincode"});
      const {payload}=await ekart(`/api/v2/serviceability/${encodeURIComponent(input.pin)}`);
      if(!isRecord(payload)||payload.status!==true||!isRecord(payload.details))return reply(200,{ok:true,serviceable:false,details:null});
      return reply(200,{ok:true,serviceable:payload.details.forward_drop===true,details:{city:clean(payload.details.city,80),state:clean(payload.details.state,40),cod:payload.details.cod===true,maxCodAmount:Number(payload.details.max_cod_amount??0)}});
    }

    if(input.action==="book"){
      if(!uuid(input.orderId)||!isRecord(input.consignee)||!pinOk(input.consignee.pin)||!clean(input.consignee.name,100)||!clean(input.consignee.phone,20)||!clean(input.consignee.address,500)||!clean(input.consignee.city,100)||!clean(input.consignee.state,100)||!Number.isInteger(input.weightGrams)||input.weightGrams<1||input.weightGrams>50000||![input.lengthCm,input.widthCm,input.heightCm].every(x=>Number.isInteger(x)&&x>0&&x<=200)||input.taxValue===null||input.taxValue===undefined||String(input.taxValue).trim()===""||!Number.isFinite(Number(input.taxValue))||Number(input.taxValue)<0)return reply(400,{ok:false,code:"invalid_booking_request"});
      const seller={name:Deno.env.get("EKART_SELLER_NAME")??"",address:Deno.env.get("EKART_SELLER_ADDRESS")??"",gst:Deno.env.get("EKART_SELLER_GSTIN")??""};
      if(!Deno.env.get("EKART_CLIENT_ID")||!Deno.env.get("EKART_USERNAME")||!Deno.env.get("EKART_PASSWORD"))return reply(503,{ok:false,code:"ekart_credentials_missing"});
      if(!seller.name||!seller.address)return reply(503,{ok:false,code:"ekart_seller_configuration_incomplete"});
      const pickup=await resolvePickup(input);
      const {data:order,error:orderError}=await db.from("orders").select("*").eq("id",input.orderId).eq("country_code","IN").maybeSingle();
      if(orderError||!order)return reply(404,{ok:false,code:"india_order_not_found"});
      if(String(order.status).toLowerCase()!=="packed")return reply(409,{ok:false,code:"order_must_be_packed"});
      const total=Number(order.final_amount??order.grand_total),advance=Number(order.payment_advance_amount??0),due=Number(order.payment_due_amount??0),method=String(order.payment_method??"").toLowerCase(),paid=String(order.payment_status??"").toLowerCase();
      const cod=method==="cod";
      if(!Number.isFinite(total)||total<=0||!Number.isFinite(advance)||!Number.isFinite(due)||advance<0||due<0||Math.abs(advance+due-total)>0.01)return reply(409,{ok:false,code:"payment_balance_mismatch"});
      if(cod){if(!["unpaid","partially_paid"].includes(paid)||due<=0)return reply(409,{ok:false,code:"cod_balance_mismatch"});if(due>49999)return reply(409,{ok:false,code:"ekart_cod_limit_exceeded"});}
      else if(method!=="cashfree"||paid!=="paid"||due!==0||advance!==0)return reply(409,{ok:false,code:"prepaid_status_mismatch"});
      if(!cod||advance>0){const {data:v,error:e}=await auth.functions.invoke("cashfree-verify-dispatch",{body:{orderId:order.id,status:"verify_only"}});if(e||v?.ok!==true||v?.verified!==true)return reply(409,{ok:false,code:"cashfree_verification_required"});}
      const {data:existing}=await db.from("india_shipping_shipments").select("provider,awb,tracking_status,creation_state").eq("order_id",order.id).maybeSingle();
      if(existing)return reply(409,{ok:false,code:"shipment_already_exists",existing});
      const {error:prepSaveError}=await db.from("india_shipping_preparations").upsert({order_id:order.id,country_code:"IN",delivery_pin:input.consignee.pin,weight_kg:Number(input.weightGrams)/1000,length_cm:input.lengthCm,breadth_cm:input.widthCm,height_cm:input.heightCm,packing_notes:clean(input.packingNotes,500),updated_by:identity.user.id,updated_at:new Date().toISOString()},{onConflict:"order_id"});
      if(prepSaveError)return reply(409,{ok:false,code:"parcel_preparation_save_failed"});
      const lineItemsResult=await db.from("order_items").select("product_name,quantity").eq("order_id",order.id).gt("quantity",0);
      const lines=(lineItemsResult.data??[]).filter(isRecord);if(lineItemsResult.error||!lines.length)return reply(409,{ok:false,code:"order_items_missing"});
      const access=await authToken();
      const quoteRequest={pickupPincode:pickup.pincode,dropPincode:input.consignee.pin,length:String(input.lengthCm),width:String(input.widthCm),height:String(input.heightCm),weight:String(input.weightGrams),paymentType:cod?"COD":"Prepaid",serviceType:input.serviceType==="EXPRESS"?"EXPRESS":"SURFACE",invoiceAmount:String(total),...(cod?{codAmount:String(due)}:{})};
      const quoteResp=await ekart("/data/v3/serviceability","POST",access,quoteRequest);
      if(!Array.isArray(quoteResp.payload)||!quoteResp.payload.length)return reply(409,{ok:false,code:"ekart_pin_not_serviceable"});
      const quoteRow=quoteResp.payload[0],freshQuote=Number(isRecord(quoteRow)&&isRecord(quoteRow.forwardDeliveredCharges)?quoteRow.forwardDeliveredCharges.totalForwardDeliveredEstimate:NaN);
      if(!Number.isFinite(freshQuote)||freshQuote<0||freshQuote>100000)return reply(409,{ok:false,code:"ekart_rate_quote_unavailable"});
      if(!Number.isFinite(Number(input.acceptedQuote))||Math.abs(freshQuote-Number(input.acceptedQuote))>1)return reply(409,{ok:false,code:"ekart_quote_changed"});
      const tax=Number(input.taxValue);if(tax>total)return reply(400,{ok:false,code:"invalid_tax_amount"});
      const orderRef=clean(order.order_number,50).replace(/[^A-Za-z0-9_-]/g,"");
      const phone=clean(input.consignee.phone,20).replace(/\D/g,"");if(!/^[0-9]{10,12}$/.test(phone))return reply(400,{ok:false,code:"invalid_consignee_phone"});
      const productDescription=clean(lines.map((x:any)=>`${clean(x.product_name,80)} x ${Number(x.quantity)}`).join(", "),240);
      const requestKey=crypto.randomUUID();
      const {data:shipmentId,error:reserveError}=await db.rpc("reserve_india_ekart_booking",{p_order:order.id,p_actor:identity.user.id,p_key:requestKey});
      if(reserveError||!shipmentId){
        const {data:existing}=await db.from("india_shipping_shipments").select("provider,awb,tracking_status,creation_state").eq("order_id",order.id).maybeSingle();
        return reply(409,{ok:false,code:"shipment_already_exists",existing:existing??null});
      }
      const {data:claimed,error:claimError}=await db.rpc("claim_india_ekart_booking",{p_id:shipmentId,p_actor:identity.user.id});
      if(claimError||claimed!==true)return reply(409,{ok:false,code:"booking_lock_failed"});
      const fullAddress=clean(`${input.consignee.address}${input.consignee.landmark?`, Near: ${clean(input.consignee.landmark,160)}`:""}`,600);
      const location=(address:string,pin:string,name:string,contact:string,city:string,state:string)=>({address,country:"India",name,phone:Number(contact.replace(/\D/g,"").slice(-10)),pin:Number(pin),city,state});
      if(tax>=total)return reply(400,{ok:false,code:"tax_amount_must_be_less_than_order_total"});
      const goodsValue=Number((total-tax).toFixed(2));
      const pickupLocation=pickup.alias?{name:pickup.alias}:location(pickup.address_line1,pickup.pincode,seller.name,pickup.phone,pickup.city,pickup.state);
      const returnAlias=clean(Deno.env.get("EKART_RETURN_ALIAS"),80),returnAddress=Deno.env.get("EKART_RETURN_ADDRESS")??"";
      const returnLocation=returnAlias?{name:returnAlias}:returnAddress?location(clean(returnAddress,500),Deno.env.get("EKART_RETURN_PIN")||pickup.pincode,Deno.env.get("EKART_RETURN_NAME")||seller.name,Deno.env.get("EKART_RETURN_PHONE")||pickup.phone,Deno.env.get("EKART_RETURN_CITY")||pickup.city,Deno.env.get("EKART_RETURN_STATE")||pickup.state):pickup.alias?{name:pickup.alias}:location(pickup.address_line1,pickup.pincode,seller.name,pickup.phone,pickup.city,pickup.state);
      const shipmentPayload={seller_name:seller.name,seller_address:pickup.alias?clean([pickup.address_line1,pickup.address_line2,pickup.city,pickup.pincode].filter(Boolean).join(", "),500):seller.address,seller_gst_tin:seller.gst.trim(),consignee_gst_amount:0,integrated_gst_amount:0,order_number:orderRef,invoice_number:clean(input.invoiceNumber||orderRef,50),invoice_date:clean(input.invoiceDate||todayIndia(),10),consignee_name:clean(input.consignee.name,100),consignee_alternate_phone:phone,payment_mode:cod?"COD":"Prepaid",category_of_goods:clean(Deno.env.get("EKART_CATEGORY_OF_GOODS")||"Seeds",80),products_desc:productDescription,total_amount:total,cod_amount:cod?due:0,taxable_amount:goodsValue,tax_value:tax,commodity_value:String(goodsValue),return_reason:"",quantity:lines.reduce((n:any,x:any)=>n+Number(x.quantity||0),0),weight:input.weightGrams,drop_location:location(fullAddress,input.consignee.pin,clean(input.consignee.name,100),phone,clean(input.consignee.city,100),clean(input.consignee.state,100)),pickup_location:pickupLocation,return_location:returnLocation,service:input.serviceType==="EXPRESS"?"EXPRESS":"SURFACE",length:input.lengthCm,width:input.widthCm,height:input.heightCm};
      try{
        const {payload}=await ekart("/api/v1/package/create","PUT",access,shipmentPayload);
        if(!isRecord(payload)||payload.status!==true||typeof payload.tracking_id!=="string"||!isRecord(payload.barcodes)||typeof payload.barcodes.wbn!=="string")throw new Error("ekart_booking_response_unconfirmed");
        const {data:recorded,error:recordError}=await db.rpc("record_india_ekart_booking",{p_id:shipmentId,p_actor:identity.user.id,p_tracking_id:payload.tracking_id,p_wbn:payload.barcodes.wbn,p_order_ref:payload.barcodes.order??orderRef,p_pickup_alias:pickup.alias||null});
        if(recordError||recorded!==true)return reply(503,{ok:false,code:"ekart_booking_created_but_local_record_failed",trackingId:payload.tracking_id,doNotRetry:true});
        return reply(200,{ok:true,trackingId:payload.tracking_id,wbn:payload.barcodes.wbn,vendor:clean(payload.vendor,80),remark:clean(payload.remark,200),serviceability:quoteResp.payload});
      }catch(error){
        await db.rpc("reconcile_india_ekart_booking",{p_id:shipmentId,p_reason:error instanceof Error?error.message:"upstream_outcome_uncertain"});
        return reply(503,{ok:false,code:"ekart_booking_outcome_uncertain",doNotRetry:true});
      }
    }

    if(input.action==="track"){
      if(!uuid(input.shipmentId))return reply(400,{ok:false,code:"invalid_shipment_id"});
      const {data:s,error}=await db.from("india_shipping_shipments").select("id,order_id,provider,awb,creation_state,tracking_occurred_at,ekart_picked_up_at,ekart_delivered_at").eq("id",input.shipmentId).eq("provider","ekart").eq("country_code","IN").maybeSingle();
      if(error||!s?.awb)return reply(404,{ok:false,code:"ekart_shipment_not_found"});
      const {payload}=await ekart(`/data/v1/elite/track/${encodeURIComponent(s.awb)}`);
      const response=isRecord(payload)?payload:{};
      let root:Record<string,any>|null=isRecord(response.wbn)?response.wbn:null;
      if(!root&&isRecord(response[s.awb]))root=response[s.awb];
      if(!root){
        const matches=Object.values(response).filter((value:unknown)=>isRecord(value)&&(value.shipment_id===s.awb||value.external_tracking_id===s.awb));
        if(matches.length===1&&isRecord(matches[0]))root=matches[0];
      }
      if(!root)return reply(502,{ok:false,code:"ekart_tracking_payload_invalid"});
      const rawHistory=Array.isArray(root.history)?root.history.filter(isRecord):[];
      const history=rawHistory.slice(-80).map((row:any)=>({status:clean(row.status,80),timestamp:clean(row.event_date_iso8601??row.timestamp??row.updated_datetime??row.event_date??row.time??"",50),location:clean(row.location??row.city??row.hub_name??"",100),description:clean(row.public_description??row.description??row.remark??row.hub_notes??row.cs_notes??"",200)}));
      const latestRaw=rawHistory.at(-1)??null;
      const historyStatus=clean(latestRaw?.status??"",120);
      const shipmentStatus=Array.isArray(root.shipments)&&isRecord(root.shipments[0])?clean(root.shipments[0].status??"",120):"";
      const status=clean(root.status??shipmentStatus??(root.delivered===true?"Delivered":historyStatus||"Status unavailable"),120);
      const normalized=status.trim().toLowerCase();
      const picked=/^(picked up|picked-up|in transit|out for delivery|delivered|rto in transit|rto out for delivery|rto delivered)$/.test(normalized)||root.mh_inscanned===true;
      const delivered=root.delivered===true||normalized==="delivered";
      const pickupEvent=rawHistory.find((row:any)=>/picked.?up|in transit|out for delivery|delivered|rto/i.test(String(row.status??"")));
      const pickupTimeRaw=pickupEvent?.event_date_iso8601??pickupEvent?.timestamp??pickupEvent?.updated_datetime??pickupEvent?.event_date??null;
      const eventTimeRaw=latestRaw?.event_date_iso8601??latestRaw?.timestamp??latestRaw?.updated_datetime??latestRaw?.event_date??null;
      const parsedEventTime=eventTimeRaw?Date.parse(String(eventTimeRaw)):NaN;
      const syncedAt=new Date().toISOString();
      const occurredAt=Number.isFinite(parsedEventTime)?new Date(parsedEventTime).toISOString():s.tracking_occurred_at;
      const parsedPickupTime=pickupTimeRaw?Date.parse(String(pickupTimeRaw)):NaN;
      const pickedAt=Number.isFinite(parsedPickupTime)?new Date(parsedPickupTime).toISOString():s.ekart_picked_up_at??syncedAt;
      const {data:updated,error:updateError}=await db.from("india_shipping_shipments").update({tracking_status:status,tracking_occurred_at:occurredAt,ekart_tracking_payload:{status,history},ekart_last_synced_at:syncedAt,...(picked?{ekart_picked_up_at:pickedAt}:{}),...(delivered?{ekart_delivered_at:occurredAt??syncedAt}:{}),updated_at:syncedAt}).eq("id",s.id).eq("provider","ekart").select("id").maybeSingle();
      if(updateError||!updated)return reply(503,{ok:false,code:"ekart_tracking_local_save_failed"});
      return reply(200,{ok:true,status,history,occurredAt:occurredAt??null,syncedAt});
    }

    if(input.action==="label"||input.action==="manifest"){
      if(!Array.isArray(input.trackingIds)||input.trackingIds.length<1||input.trackingIds.length>(input.action==="label"?20:100)||input.trackingIds.some((x:unknown)=>typeof x!=="string"||x.length>80))return reply(400,{ok:false,code:"invalid_tracking_ids"});
      const unique=[...new Set(input.trackingIds as string[])];if(unique.length!==input.trackingIds.length)return reply(400,{ok:false,code:"duplicate_tracking_ids"});
      const {data:known,error}=await db.from("india_shipping_shipments").select("external_shipment_id,awb").eq("provider","ekart").eq("country_code","IN").in("external_shipment_id",unique);
      if(error||!known||known.length!==unique.length||known.some((x:any)=>!x.awb))return reply(403,{ok:false,code:"unknown_ekart_tracking_id"});
      const waybills=unique.map(id=>known.find((x:any)=>x.external_shipment_id===id)?.awb).filter((x:unknown):x is string=>typeof x==="string");
      if(input.action==="label"){
        const access=await authToken();const response=await fetch(`${base}/api/v1/package/label?json_only=false`,{method:"POST",headers:{Authorization:`Bearer ${access}`,Accept:"application/octet-stream","content-type":"application/json"},body:JSON.stringify({ids:waybills}),cache:"no-store",signal:AbortSignal.timeout(25000)});
        if(!response.ok)return reply(502,{ok:false,code:`ekart_upstream_${response.status}`});
        const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length<8||bytes.length>8*1024*1024||String.fromCharCode(...bytes.subarray(0,5))!=="%PDF-")return reply(502,{ok:false,code:"ekart_label_payload_invalid"});
        let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
        return reply(200,{ok:true,filename:`ekart-labels-${new Date().toISOString().slice(0,10)}.pdf`,pdfBase64:btoa(binary)});
      }
      const {payload}=await ekart("/data/v2/generate/manifest","POST",undefined,{ids:waybills});
      if(!isRecord(payload)||payload.manifestNumber===undefined||!clean(payload.manifestDownloadUrl,1000))return reply(502,{ok:false,code:"ekart_manifest_response_invalid"});
      const {error:manifestSaveError}=await db.from("india_shipping_shipments").update({ekart_manifest_number:String(payload.manifestNumber),ekart_manifest_url:clean(payload.manifestDownloadUrl,1000),updated_at:new Date().toISOString()}).in("external_shipment_id",unique).eq("provider","ekart");
      if(manifestSaveError)return reply(503,{ok:false,code:"ekart_manifest_local_save_failed"});
      return reply(200,{ok:true,result:payload});
    }

    if(input.action==="cancel"){
      if(!uuid(input.shipmentId)||input.confirm!==true)return reply(400,{ok:false,code:"explicit_cancellation_confirmation_required"});
      const {data:s,error}=await db.from("india_shipping_shipments").select("id,awb,external_shipment_id,creation_state,tracking_status,ekart_picked_up_at").eq("id",input.shipmentId).eq("provider","ekart").eq("country_code","IN").maybeSingle();
      if(error||!s?.external_shipment_id)return reply(404,{ok:false,code:"ekart_shipment_not_found"});
      if(s.ekart_picked_up_at||/^(picked up|in transit|out for delivery|delivered|rto in transit|rto delivered)$/i.test(s.tracking_status??""))return reply(409,{ok:false,code:"shipment_already_handed_to_courier"});
      const {payload}=await ekart(`/api/v1/package/cancel?tracking_id=${encodeURIComponent(s.external_shipment_id)}`,"DELETE");
      const acknowledgements=isRecord(payload)&&Array.isArray(payload.data)?payload.data.filter(isRecord):[];
      const acknowledgement=acknowledgements.find((row:any)=>String(row.tracking_id??"")===s.external_shipment_id);
      if(!acknowledgement)return reply(503,{ok:false,code:"ekart_cancel_outcome_uncertain",doNotRetry:true});
      if(acknowledgement.status!==true)return reply(409,{ok:false,code:"ekart_cancel_rejected"});
      const {error:updateError}=await db.from("india_shipping_shipments").update({tracking_status:"Cancelled",updated_at:new Date().toISOString()}).eq("id",s.id);
      if(updateError)return reply(503,{ok:false,code:"ekart_cancelled_local_record_failed",doNotRetry:true});
      return reply(200,{ok:true,result:payload});
    }

    if(input.action==="dispatch_date"){
      if(!Array.isArray(input.trackingIds)||input.trackingIds.length<1||input.trackingIds.length>100||typeof input.dispatchDate!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.dispatchDate)||input.dispatchDate<=todayIndia())return reply(400,{ok:false,code:"invalid_dispatch_date_request"});
      const ids=[...new Set(input.trackingIds as string[])];const {data:known,error}=await db.from("india_shipping_shipments").select("external_shipment_id").eq("provider","ekart").eq("country_code","IN").in("external_shipment_id",ids);
      if(error||!known||known.length!==ids.length)return reply(403,{ok:false,code:"unknown_ekart_tracking_id"});
      const {payload}=await ekart("/data/shipment/dispatch-date","POST",undefined,{ids,dispatchDate:input.dispatchDate});
      const acknowledgements=isRecord(payload)&&Array.isArray(payload.data)?payload.data.filter(isRecord):[];
      const failed=ids.filter(id=>!acknowledgements.some((row:any)=>String(row.tracking_id??"")===id&&row.status===true));
      if(failed.length)return reply(409,{ok:false,code:"ekart_dispatch_date_rejected",failedTrackingIds:failed});
      return reply(200,{ok:true,result:payload});
    }

    if(input.action==="ewbn"){
      const trackingId=clean(input.trackingId,80),ewbn=String(input.ewbn??"");
      if(!trackingId||!/^\d{12}$/.test(ewbn))return reply(400,{ok:false,code:"invalid_ewbn_request"});
      const {data:known,error}=await db.from("india_shipping_shipments").select("id").eq("provider","ekart").eq("country_code","IN").eq("external_shipment_id",trackingId).maybeSingle();
      if(error||!known)return reply(403,{ok:false,code:"unknown_ekart_tracking_id"});
      const {payload}=await ekart("/data/shipment/ewbn","POST",undefined,{id:trackingId,ewbn});
      if(!isRecord(payload)||payload.status!==true||String(payload.tracking_id??"")!==trackingId)return reply(409,{ok:false,code:"ekart_ewbn_rejected"});
      return reply(200,{ok:true,result:payload});
    }

    if(input.action==="ndr"){
      const trackingId=clean(input.trackingId,80),ndrAction=input.ndrAction;
      if(!trackingId||!['Re-Attempt','RTO','Edit'].includes(String(ndrAction)))return reply(400,{ok:false,code:"invalid_ndr_request"});
      const {data:known,error}=await db.from("india_shipping_shipments").select("id").eq("provider","ekart").eq("country_code","IN").eq("external_shipment_id",trackingId).maybeSingle();
      if(error||!known)return reply(403,{ok:false,code:"unknown_ekart_tracking_id"});
      const ndr:Record<string,unknown>={wbn:trackingId,action:ndrAction};
      if(ndrAction==='Re-Attempt'){
        const d=typeof input.date==='number'?input.date:NaN;if(!Number.isFinite(d)||d<=Date.now()||d>Date.now()+7*86400000)return reply(400,{ok:false,code:"ndr_reattempt_date_must_be_within_7_days"});ndr.date=d;
      }
      if(ndrAction==='Edit'){
        const mobile=clean(input.phone,12).replace(/\D/g,"");if(!/^\d{10}$/.test(mobile)||!clean(input.address,500))return reply(400,{ok:false,code:"ndr_edit_requires_valid_phone_and_address"});ndr.phone=mobile;ndr.address=clean(input.address,500);
      }
      if(input.instructions)ndr.instructions=clean(input.instructions,500);
      const {payload}=await ekart("/api/v2/package/ndr","POST",undefined,ndr);
      if(!isRecord(payload)||payload.status!==true||String(payload.tracking_id??"")!==trackingId)return reply(409,{ok:false,code:"ekart_ndr_rejected"});
      return reply(200,{ok:true,result:payload});
    }

    if(input.action==="addresses"){
      return reply(200,{ok:true,result:await ekartAddresses()});
    }

    if(input.action==="address_add"){
      if(!isRecord(input.address))return reply(400,{ok:false,code:"invalid_address"});
      const a=input.address,phone=String(a.phone??"").replace(/\D/g,"");
      if(!clean(a.alias,80)||!clean(a.address_line1,240)||!/^[0-9]{10}$/.test(phone)||!pinOk(String(a.pincode??""))||!clean(a.state,80))return reply(400,{ok:false,code:"invalid_address"});
      const alias=clean(a.alias,80);
      const {payload}=await ekart("/api/v2/address","POST",undefined,{alias,phone:Number(phone),address_line1:clean(a.address_line1,240),address_line2:clean(a.address_line2,240)||null,pincode:Number(a.pincode),city:clean(a.city,80)||null,state:clean(a.state,80),country:"India"});
      if(!isRecord(payload)||payload.status!==true||String(payload.alias??"").toLowerCase()!==alias.toLowerCase())return reply(409,{ok:false,code:"ekart_address_add_rejected"});
      return reply(200,{ok:true,result:payload});
    }

    if(input.action==="bulk_serviceability"){
      const type=String(input.type??"");if(!['NON_LARGE','LARGE'].includes(type))return reply(400,{ok:false,code:"invalid_serviceability_type"});
      const {payload}=await ekart(`/data/serviceability/bulk/${encodeURIComponent(type)}?format=JSON`);return reply(200,{ok:true,result:payload});
    }

    if(input.action==="webhooks"){
      const {payload}=await ekart("/api/v2/webhook");
      const safe=Array.isArray(payload)?payload.map((w:unknown)=>{if(!isRecord(w))return null;const {secret:_secret,...rest}=w;return rest;}).filter(Boolean):payload;
      return reply(200,{ok:true,result:safe});
    }
    return reply(400,{ok:false,code:"unsupported_action"});
  }catch(error){
    const code=error instanceof Error?error.message:"india_ekart_operation_failed";
    const known=/^ekart_(auth_failed|upstream_\d+|credentials_missing|addresses_unavailable|pickup_location_required|pickup_location_not_found|pickup_pin_mismatch)$/.test(code);
    return reply(code==="ekart_credentials_missing"?503:known?409:502,{ok:false,code:known?code:"india_ekart_operation_failed"});
  }
});
