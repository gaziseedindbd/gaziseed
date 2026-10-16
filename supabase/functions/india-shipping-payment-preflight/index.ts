import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-gazi-country, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"};
const respond=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{
 status,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
const matches=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.01;
// Read-only, authenticated payment gate. NOT a shipment booking endpoint.
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond(405,{ok:false});
 const bearer=req.headers.get("authorization")??"";
 if(!bearer.startsWith("Bearer "))return respond(401,{ok:false});
 let id:string;
 try {const data=await req.json();id=data?.orderId;
   if(typeof id!=="string"||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
     return respond(400,{ok:false});}
 catch{return respond(400,{ok:false});}
 const url=Deno.env.get("SUPABASE_URL"),pub=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"),
 priv=Deno.env.get("SUPABASE_SECRET_KEYS"),cfId=Deno.env.get("CASHFREE_APP_ID"),
 cfSecret=Deno.env.get("CASHFREE_SECRET_KEY");
 if(!url||!pub||!priv||!cfId||!cfSecret)return respond(503,{ok:false});
 try {
 const viewer=createClient(url,JSON.parse(pub).default,{
 global:{headers:{Authorization:bearer,"x-gazi-country":"IN"}},
 auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:identityError}=await viewer.auth.getUser(bearer.slice(7));
 if(identityError||!identity.user)return respond(401,{ok:false});
 const [role,country]=await Promise.all([viewer.rpc("is_admin"),viewer.rpc("current_admin_country")]);
 if(role.error||country.error||role.data!==true||String(country.data??"").toUpperCase()!=="IN")
   return respond(403,{ok:false});
 const db=createClient(url,JSON.parse(priv).default,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:o,error:oe}=await db.from("orders").select(
 "id,country_code,status,payment_method,payment_status,final_amount,payment_advance_amount,payment_due_amount"
 ).eq("id",id).maybeSingle();
 if(oe||!o||o.country_code!=="IN"||!["confirmed","processing","packed"].includes(o.status))
   return respond(409,{ok:false,reason:"India order not eligible"});
 const {data:intents,error:ie}=await db.from("cashfree_payment_intents").select(
 "id,cashfree_order_id,amount,currency,metadata"
 ).eq("completed_order_id",id).eq("country_code","IN").eq("status","completed");
 if(ie||!intents||intents.length!==1)return respond(409,{ok:false,reason:"Cashfree intent invalid"});
 const intent=intents[0];
 const isPartial=intent.metadata?.payment_method==="cod";
 const total=Number(o.final_amount),advance=Number(o.payment_advance_amount??0),due=Number(o.payment_due_amount??0);
 const expected=isPartial?advance:total;
 if(!Number.isFinite(total)||total<=0||!Number.isFinite(due)||due<0||
    !Number.isFinite(advance)||advance<0||expected<=0||
    !matches(Number(intent.amount),expected)||intent.currency!=="INR"||
    (isPartial&&(!matches(advance+due,total)||due<=0||
       !["partially_paid","partial_paid"].includes(String(o.payment_status||"").toLowerCase())))||
    (!isPartial&&(due!==0||!["paid","completed","success"].includes(String(o.payment_status||"").toLowerCase())))||
    !intent.cashfree_order_id)
   return respond(409,{ok:false,reason:"Amount mismatch"});
 const headers={"x-api-version":"2025-01-01","x-client-id":cfId,"x-client-secret":cfSecret};
 const orderResponse=await fetch("https://api.cashfree.com/pg/orders/"+encodeURIComponent(intent.cashfree_order_id),{
 headers,signal:AbortSignal.timeout(12000)});
 if(!orderResponse.ok)return respond(502,{ok:false,reason:"Payment gateway unavailable"});
 const gateway=await orderResponse.json();
 if(gateway.order_id!==intent.cashfree_order_id||gateway.order_status!=="PAID"||
    gateway.order_currency!=="INR"||!matches(Number(gateway.order_amount),expected))
   return respond(409,{ok:false,reason:"Payment not verified"});
 const refundResponse=await fetch("https://api.cashfree.com/pg/orders/"+
  encodeURIComponent(intent.cashfree_order_id)+"/refunds",{headers,signal:AbortSignal.timeout(12000)});
 if(!refundResponse.ok)return respond(502,{ok:false,reason:"Refund check unavailable"});
 const refunds=await refundResponse.json();
 if(!Array.isArray(refunds)||refunds.some((r:{refund_status?:string})=>
   !["FAILED","CANCELLED"].includes(String(r.refund_status??"").toUpperCase())))
   return respond(409,{ok:false,reason:"Refund present or uncertain"});
 // Verification is time-sensitive; booking must REVERIFY after a delay.
 return respond(200,{ok:true,verified:true,readOnly:true,bookingEnabled:false,mode:isPartial?"cod":"prepaid",
   collectOnDelivery:isPartial?due:0,verifiedAmount:expected,orderId:id});
 }catch{return respond(503,{ok:false,reason:"Verification unavailable"});}
});