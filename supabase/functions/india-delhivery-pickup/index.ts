import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-gazi-country","Access-Control-Max-Age":"600"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
const isRecord=(v:unknown):v is Record<string,any>=>!!v&&typeof v==="object"&&!Array.isArray(v);
function environmentFor(url:string){if(url.includes("ufxsthshyebahkwbmioe.supabase.co"))return "production";if(url.includes("qqehtphbpypcmxliaiqd.supabase.co"))return "staging";return "";}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return reply(405,{ok:false,code:"method_not_allowed"});
  const jwt=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
  if(!jwt)return reply(401,{ok:false,code:"authentication_required"});
  const url=Deno.env.get("SUPABASE_URL")??"",publishable=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"",secrets=Deno.env.get("SUPABASE_SECRET_KEYS")??"";
  const env=environmentFor(url),configured=(Deno.env.get("DELHIVERY_API_ENVIRONMENT")??env).trim().toLowerCase();
  const token=Deno.env.get("DELHIVERY_API_TOKEN")??"",base=env==="production"?"https://track.delhivery.com":env==="staging"?"https://staging-express.delhivery.com":"";
  const enabled=Deno.env.get("DELHIVERY_PICKUP_ENABLED")==="true"||(env==="production"&&Deno.env.get("DELHIVERY_PICKUP_ENABLED")!=="false");
  const location=Deno.env.get("DELHIVERY_PICKUP_LOCATION")??"GAZISEEDB2C-B2C";
  if(!env||configured!==env||!enabled||!url||!publishable||!secrets||!token||!base||!location)return reply(503,{ok:false,code:"delhivery_pickup_not_configured"});
  let db:ReturnType<typeof createClient>|null=null;let claimed=false;let batchLocation="";
  try{
    const keys:unknown=JSON.parse(publishable),secret:unknown=JSON.parse(secrets);
    if(!isRecord(keys)||typeof keys.default!=="string"||!isRecord(secret)||typeof secret.default!=="string")return reply(503,{ok:false,code:"supabase_configuration_unavailable"});
    const auth=createClient(url,keys.default,{global:{headers:{Authorization:`Bearer ${jwt}`,"x-gazi-country":"IN"}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:identity,error:authError}=await auth.auth.getUser(jwt);
    if(authError||!identity.user)return reply(401,{ok:false,code:"authentication_required"});
    const [admin,country]=await Promise.all([auth.rpc("is_admin"),auth.rpc("current_admin_country")]);
    if(admin.error||country.error||admin.data!==true||String(country.data??"").toUpperCase()!=="IN")return reply(403,{ok:false,code:"india_admin_only"});
    const input:unknown=await req.json();
    if(!isRecord(input))return reply(400,{ok:false,code:"invalid_pickup_request"});
    db=createClient(url,secret.default,{auth:{persistSession:false,autoRefreshToken:false}});
    if(input.action==="complete"){
      const {data,error}=await db.rpc("complete_india_delhivery_pickup",{p_location:location,p_actor:identity.user.id});
      if(error||data!==true)return reply(409,{ok:false,code:"pickup_completion_not_allowed"});
      return reply(200,{ok:true,state:"completed",pickup_location:location});
    }
    if(input.action!=="request"||!Array.isArray(input.shipment_ids)||input.shipment_ids.length<1||input.shipment_ids.length>500||
       !input.shipment_ids.every((x:unknown)=>typeof x==="string"&&/^[a-f0-9-]{36}$/i.test(x))||
       typeof input.pickup_date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(input.pickup_date)||
       typeof input.pickup_time!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.pickup_time))return reply(400,{ok:false,code:"invalid_pickup_request"});
    const uniqueIds=[...new Set(input.shipment_ids)];
    if(uniqueIds.length!==input.shipment_ids.length)return reply(400,{ok:false,code:"duplicate_pickup_shipment"});
    const todayIndia=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());
    const days=Math.round((new Date(`${input.pickup_date}T00:00:00+05:30`).getTime()-new Date(`${todayIndia}T00:00:00+05:30`).getTime())/86400000);
    if(!Number.isFinite(days)||days<0||days>7)return reply(400,{ok:false,code:"pickup_date_out_of_range"});
    const {data:rows,error:rowsError}=await db.from("india_shipping_shipments").select("id,order_id,provider,creation_state,awb,pickup_request_state").in("id",uniqueIds);
    if(rowsError||!Array.isArray(rows)||rows.length!==uniqueIds.length||rows.some((x:any)=>x.provider!=="delhivery"||x.creation_state!=="awb_assigned"||!x.awb||x.pickup_request_state!=="not_requested"))return reply(409,{ok:false,code:"pickup_shipments_not_ready"});
    for(const id of uniqueIds){
      const {data,error}=await db.rpc("approve_india_delhivery_pickup",{p_id:id,p_actor:identity.user.id});
      if(error||data!==true)return reply(409,{ok:false,code:"pickup_approval_failed"});
    }
    const clock=`${input.pickup_time}:00`;
    const {data:claimedResult,error:claimError}=await db.rpc("claim_india_delhivery_pickup",{p_location:location,p_actor:identity.user.id,p_ids:uniqueIds,p_date:input.pickup_date,p_time:clock,p_count:uniqueIds.length});
    if(claimError||claimedResult!==true)return reply(409,{ok:false,code:"warehouse_pickup_locked_or_claim_failed"});
    claimed=true;batchLocation=location;
    const response=await fetch(new URL("/fm/request/new/",base),{method:"POST",headers:{Authorization:`Token ${token}`,Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({pickup_location:location,pickup_date:input.pickup_date,pickup_time:clock,expected_package_count:uniqueIds.length}),cache:"no-store",signal:AbortSignal.timeout(20000)});
    const payload:unknown=await response.json().catch(()=>null);
    const pickupId=isRecord(payload)?String(payload.pickup_id??payload.id??payload.request_id??"").trim():"";
    if(!response.ok||!pickupId||pickupId.length>100)throw new Error("pickup_outcome_uncertain");
    const {error:recordError}=await db.rpc("record_india_delhivery_pickup",{p_location:location,p_success:true,p_pickup_id:pickupId});
    if(recordError)throw new Error("pickup_persistence_uncertain");
    return reply(200,{ok:true,state:"requested",environment:env,pickup_id:pickupId,package_count:uniqueIds.length});
  }catch(e){
    if(claimed&&db&&batchLocation){try{await db.rpc("record_india_delhivery_pickup",{p_location:batchLocation,p_success:false,p_pickup_id:null});}catch{/* Keep durable warehouse lock for manual reconciliation. */}return reply(409,{ok:false,code:"manual_pickup_reconciliation_required"});}
    return reply(503,{ok:false,code:e instanceof Error&&/^delhivery_/.test(e.message)?e.message:"delhivery_pickup_failed"});
  }
});
