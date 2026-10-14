import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.112.3";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-gazi-country"};
const reply=(s:number,b:object)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply(405,{ok:false});
 const jwt=(req.headers.get("authorization")??"").replace(/^Bearer /i,"");
 if(!jwt)return reply(401,{ok:false});
 const url=Deno.env.get("SUPABASE_URL"),keys=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"),secrets=Deno.env.get("SUPABASE_SECRET_KEYS");
 if(!url||!keys||!secrets)return reply(503,{ok:false});
 try{
  const auth=createClient(url,JSON.parse(keys).default,{global:{headers:{Authorization:"Bearer "+jwt,"x-gazi-country":"IN"}},auth:{persistSession:false,autoRefreshToken:false}});
  const user=await auth.auth.getUser(jwt);
  if(user.error||!user.data.user)return reply(401,{ok:false});
  const [admin,country]=await Promise.all([auth.rpc("is_admin"),auth.rpc("current_admin_country")]);
  if(admin.error||country.error||admin.data!==true||String(country.data??"").toUpperCase()!=="IN")return reply(403,{ok:false});
  const body:unknown=await req.json();
  if(!body||typeof body!=="object"||Array.isArray(body))return reply(400,{ok:false});
  const data=body as Record<string,unknown>;
  if(typeof data.order_id!=="string"||!/^[a-f0-9-]{36}$/i.test(data.order_id))return reply(400,{ok:false});
  if(typeof data.delivery_pin!=="string"||!/^[1-9][0-9]{5}$/.test(data.delivery_pin))return reply(400,{ok:false,code:"invalid_pin"});
  for(const [key,max] of [["weight_kg",100],["length_cm",200],["breadth_cm",200],["height_cm",200]] as const){
   if(typeof data[key]!=="number"||!Number.isFinite(data[key])||data[key]<=0||data[key]>max)return reply(400,{ok:false,code:"invalid_dimensions"});
  }
  if(typeof data.packing_notes!=="string"||data.packing_notes.length>500)return reply(400,{ok:false,code:"invalid_notes"});
  const db=createClient(url,JSON.parse(secrets).default,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:order,error:orderError}=await db.from("orders").select("id").eq("id",data.order_id).eq("country_code","IN").maybeSingle();
  if(orderError)return reply(503,{ok:false});
  if(!order)return reply(404,{ok:false});
  const {data:shipment,error:shipmentError}=await db.from("india_shipping_shipments").select("external_shipment_id,awb").eq("order_id",data.order_id).maybeSingle();
  if(shipmentError)return reply(503,{ok:false});
  if(shipment?.external_shipment_id||shipment?.awb)return reply(409,{ok:false,code:"shipment_already_created"});
  const {error:saveError}=await db.from("india_shipping_preparations").upsert({
   order_id:data.order_id,country_code:"IN",delivery_pin:data.delivery_pin,
   weight_kg:data.weight_kg,length_cm:data.length_cm,breadth_cm:data.breadth_cm,height_cm:data.height_cm,
   packing_notes:data.packing_notes,updated_by:user.data.user.id,updated_at:new Date().toISOString()
  },{onConflict:"order_id"});
  if(saveError)return reply(503,{ok:false,code:"draft_save_failed"});
  return reply(200,{ok:true,saved:true,bookingCreated:false});
 }catch{return reply(503,{ok:false});}
});