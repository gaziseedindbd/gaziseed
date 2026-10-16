import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
// Read-only India courier rate quotation; no order, AWB, wallet or pickup writes.
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-gazi-country, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" };
const reply=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
const numeric=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply(405,{ok:false});
 const bearer=req.headers.get("authorization")??"";
 if(!/^Bearer\s+\S+$/.test(bearer))return reply(401,{ok:false});
 const url=Deno.env.get("SUPABASE_URL"),pub=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
 const email=Deno.env.get("SHIPROCKET_API_EMAIL"),password=Deno.env.get("SHIPROCKET_API_PASSWORD");
 if(!url||!pub||!email||!password)return reply(503,{ok:false,code:"config_unavailable"});
 try{
  const key=JSON.parse(pub).default;
  if(typeof key!=="string")return reply(503,{ok:false});
  const db=createClient(url,key,{global:{headers:{Authorization:bearer,"x-gazi-country":"IN"}},
    auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await db.auth.getUser(bearer.slice(7));
  if(authError||!identity.user)return reply(401,{ok:false});
  const [admin,country]=await Promise.all([db.rpc("is_admin"),db.rpc("current_admin_country")]);
  if(admin.error||country.error||admin.data!==true||String(country.data??"").toUpperCase()!=="IN")
   return reply(403,{ok:false,code:"india_admin_only"});
  const request:unknown=await req.json();
  if(!request||typeof request!=="object"||Array.isArray(request))return reply(400,{ok:false});
  const p=request as Record<string,unknown>;
  const pin=(x:unknown)=>typeof x==="string"&&/^[1-9][0-9]{5}$/.test(x);
  const n=(x:unknown)=>numeric(x)!==null&&(x as number)>0&&(x as number)<=100;
  if(!pin(p.pickupPostcode)||!pin(p.deliveryPostcode)||
   !n(p.weightKg)||!n(p.lengthCm)||!n(p.breadthCm)||!n(p.heightCm)||
   p.paymentMode!=="prepaid"&&p.paymentMode!=="cod")
    return reply(400,{ok:false,code:"invalid_parcel"});
  const login=await fetch("https://apiv2.shiprocket.in/v1/external/auth/login",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000)});
  if(!login.ok)return reply(502,{ok:false,code:"shipping_login_failed",diagnostic:{stage:"auth_http",upstreamStatus:login.status}});
  const access:unknown=await login.json();
  const token=access&&typeof access==="object"&&"token" in access?access.token:null;
  if(typeof token!=="string"||!token)return reply(502,{ok:false,code:"shipping_login_failed",diagnostic:{stage:"auth_payload"}});
  const qs=new URLSearchParams({pickup_postcode:p.pickupPostcode as string,
   delivery_postcode:p.deliveryPostcode as string,cod:p.paymentMode==="cod"?"1":"0",
   weight:String(p.weightKg),length:String(p.lengthCm),breadth:String(p.breadthCm),
   height:String(p.heightCm),is_return:"0"});
  const response=await fetch("https://apiv2.shiprocket.in/v1/external/courier/serviceability/?"+qs,{
    headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(15000)});
  if(!response.ok)return reply(502,{ok:false,code:"courier_rates_unavailable",diagnostic:{stage:"serviceability_http",upstreamStatus:response.status}});
  const json:unknown=await response.json();
  const data=json&&typeof json==="object"&&"data" in json?json.data:null;
  const raw=data&&typeof data==="object"&&"available_courier_companies" in data?
    data.available_courier_companies:null;
  if(!Array.isArray(raw)){
   const objectKeys=(v:unknown)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.keys(v as Record<string,unknown>).filter(k=>/^[a-zA-Z_]{1,40}$/.test(k)).slice(0,15):[];
   const top=json&&typeof json==="object"&&!Array.isArray(json)?json as Record<string,unknown>:{};
   const nested=data&&typeof data==="object"&&!Array.isArray(data)?data as Record<string,unknown>:{};
   const safeStatus=(v:unknown)=>typeof v==="number"&&Number.isInteger(v)&&v>=100&&v<=599?v:null;
   return reply(502,{ok:false,code:"courier_response_invalid",diagnostic:{
    stage:"serviceability_payload",upstreamStatus:response.status,
    payloadKind:Array.isArray(json)?"array":typeof json,
    topLevelKeys:objectKeys(json),dataKind:Array.isArray(data)?"array":typeof data,
    dataKeys:objectKeys(data),apiStatus:safeStatus(top.status)??safeStatus(nested.status),
    hasCourierArray:Array.isArray(raw)
   }});
  }
  if(raw.length===0)return reply(200,{ok:true,couriers:[],quoteOnly:true,code:"no_serviceable_couriers"});
  let rejected=0;
  const results=raw.flatMap((c:unknown)=>{
   if(!c||typeof c!=="object")return [];
   const x=c as Record<string,unknown>;
   const id=Number(x.courier_company_id);
   const amount=(v:unknown)=>v===null||v===undefined||v===""?NaN:Number(v);
   const optionalCharge=(v:unknown)=>v===null||v===undefined||v===""?0:Number(v);
   const rate=amount(x.rate),freight=amount(x.freight_charge);
   const codCharge=optionalCharge(x.cod_charges),extra=optionalCharge(x.other_charges);
   const fullCost=Number.isFinite(rate)&&rate>=0?rate:
     Number.isFinite(freight)&&freight>=0&&Number.isFinite(codCharge)&&codCharge>=0&&
     Number.isFinite(extra)&&extra>=0?freight+codCharge+extra:NaN;
   const eligible=Number.isSafeInteger(id)&&id>0&&Number.isFinite(fullCost)&&fullCost>=0&&
     typeof x.courier_name==="string"&&x.courier_name.length>0&&
     (p.paymentMode==="prepaid"||x.cod===1||x.cod===true||x.cod==="1");
   if(!eligible){rejected++;return [];}
   return [{courierId:id,name:(x.courier_name as string).slice(0,80),estimatedCost:fullCost}];
  }).sort((a:{estimatedCost:number},b:{estimatedCost:number})=>a.estimatedCost-b.estimatedCost).slice(0,20);
  if(results.length===0)return reply(502,{ok:false,code:"courier_quotes_unparseable",diagnostic:{stage:"courier_filtering",returnedCouriers:raw.length,rejectedCouriers:rejected}});
  return reply(200,{ok:true,couriers:results,quoteOnly:true});
 }catch{return reply(503,{ok:false,code:"quote_unavailable",diagnostic:{stage:"unexpected_exception"}});}
});
