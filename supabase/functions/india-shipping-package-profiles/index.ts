import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-gazi-country"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const isUuid=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9-]{36}$/i.test(v);
const n=(v:unknown,min:number,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply(405,{ok:false,code:"method_not_allowed"});
 const jwt=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
 if(!jwt)return reply(401,{ok:false,code:"authentication_required"});
 const url=Deno.env.get("SUPABASE_URL"),keys=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"),secrets=Deno.env.get("SUPABASE_SECRET_KEYS");
 if(!url||!keys||!secrets)return reply(503,{ok:false,code:"configuration_unavailable"});
 try{
  const parsedKeys:unknown=JSON.parse(keys),parsedSecrets:unknown=JSON.parse(secrets);
  if(!isRecord(parsedKeys)||typeof parsedKeys.default!=="string"||!isRecord(parsedSecrets)||typeof parsedSecrets.default!=="string")return reply(503,{ok:false,code:"configuration_unavailable"});
  const auth=createClient(url,parsedKeys.default,{global:{headers:{Authorization:`Bearer ${jwt}`,"x-gazi-country":"IN"}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:user,error:userError}=await auth.auth.getUser(jwt);
  if(userError||!user.user)return reply(401,{ok:false,code:"authentication_required"});
  const [admin,country]=await Promise.all([auth.rpc("is_admin"),auth.rpc("current_admin_country")]);
  if(admin.error||country.error||admin.data!==true||String(country.data??"").toUpperCase()!=="IN")return reply(403,{ok:false,code:"india_admin_only"});
  const input:unknown=await req.json();if(!isRecord(input))return reply(400,{ok:false,code:"invalid_request"});
  const db=createClient(url,parsedSecrets.default,{auth:{persistSession:false,autoRefreshToken:false}});
  if(input.action==="archive"){
   if(!isUuid(input.id))return reply(400,{ok:false,code:"invalid_profile_id"});
   const {data,error}=await db.from("india_shipping_package_profiles").update({is_active:false,updated_by:user.user.id,updated_at:new Date().toISOString()})
    .eq("id",input.id).eq("country_code","IN").eq("is_active",true).select("id").maybeSingle();
   if(error)return reply(503,{ok:false,code:"profile_archive_failed"});
   if(!data)return reply(404,{ok:false,code:"profile_not_found"});
   return reply(200,{ok:true,archived:true});
  }
  if(input.action!=="save")return reply(400,{ok:false,code:"invalid_action"});
  const name=typeof input.name==="string"?input.name.trim():"";
  const packageType=input.package_type;
  const weight=input.weight_kg,length=input.length_cm,breadth=input.breadth_cm,height=input.height_cm;
  const minItems=input.min_item_count??1;
  const maxItems=input.max_item_count===null||input.max_item_count===undefined||input.max_item_count===""?null:input.max_item_count;
  const keywords=Array.isArray(input.product_keywords)?input.product_keywords.map(x=>typeof x==="string"?x.trim().slice(0,80):"").filter(Boolean):[];
  const notes=typeof input.packing_notes==="string"?input.packing_notes.trim():"";
  if(input.fragile!==undefined&&typeof input.fragile!=="boolean")return reply(400,{ok:false,code:"invalid_package_profile"});
  if(name.length<2||name.length>80||!["mailer","box","custom"].includes(String(packageType))||
    !n(weight,0.01,100)||!n(length,1,200)||!n(breadth,1,200)||!n(height,1,200)||
    !Number.isInteger(minItems)||Number(minItems)<1||Number(minItems)>1000||
    (maxItems!==null&&(!Number.isInteger(maxItems)||Number(maxItems)<Number(minItems)||Number(maxItems)>1000))||
    keywords.length>12||notes.length>500)return reply(400,{ok:false,code:"invalid_package_profile"});
  const row={country_code:"IN",name,package_type:packageType,weight_kg:weight,length_cm:length,breadth_cm:breadth,height_cm:height,
   product_keywords:keywords,min_item_count:minItems,max_item_count:maxItems,fragile:input.fragile===true,packing_notes:notes,
   updated_by:user.user.id,updated_at:new Date().toISOString()};
  const query=isUuid(input.id)
   ?db.from("india_shipping_package_profiles").update(row).eq("id",input.id).eq("country_code","IN").eq("is_active",true)
   :db.from("india_shipping_package_profiles").insert({...row,created_by:user.user.id});
  const {data,error}=await query.select("id,name,package_type,weight_kg,length_cm,breadth_cm,height_cm,product_keywords,min_item_count,max_item_count,fragile,packing_notes,is_active").maybeSingle();
  if(error)return reply(error.code==="23505"?409:503,{ok:false,code:error.code==="23505"?"package_profile_name_exists":"package_profile_save_failed"});
  if(!data)return reply(404,{ok:false,code:"profile_not_found"});
  return reply(200,{ok:true,profile:data});
 }catch{return reply(503,{ok:false,code:"package_profile_operation_failed"});}
});
