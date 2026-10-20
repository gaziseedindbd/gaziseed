import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-gazi-country"};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply(405,{ok:false});
 const jwt=(req.headers.get("authorization")??"").replace(/^Bearer /i,"");
 if(!jwt)return reply(401,{ok:false});
 const url=Deno.env.get("SUPABASE_URL"),keys=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"),secret=Deno.env.get("SUPABASE_SECRET_KEYS");
 if(!url||!keys||!secret)return reply(503,{ok:false});
 try{
  const client=createClient(url,JSON.parse(keys).default,{global:{headers:{Authorization:"Bearer "+jwt,"x-gazi-country":"IN"}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:user,error:err}=await client.auth.getUser(jwt);
  if(err||!user.user)return reply(401,{ok:false});
  const [admin,country]=await Promise.all([client.rpc("is_admin"),client.rpc("current_admin_country")]);
  if(admin.error||country.error||admin.data!==true||String(country.data??"").toUpperCase()!=="IN")return reply(403,{ok:false});
  const db=createClient(url,JSON.parse(secret).default,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:orders,error:orderError}=await db.from("orders").select("id,order_number,customer_name,delivery_address,status,payment_status,payment_method,payment_advance_amount,payment_due_amount,cashfree_dispatch_verified_at,grand_total,created_at").eq("country_code","IN").order("created_at",{ascending:false}).limit(60);
  if(orderError)return reply(503,{ok:false,code:"orders_unavailable"});
  const ids=(orders??[]).map(x=>x.id);
  const {data:shipments,error:shipError}=ids.length?await db.from("india_shipping_shipments").select("id,order_id,external_shipment_id,awb,courier_company_id,tracking_status,pickup_approved_at").in("order_id",ids):{data:[],error:null};
  if(shipError)return reply(503,{ok:false,code:"shipments_unavailable"});
  const shipmentIds=(shipments??[]).map(x=>x.id);
  const {data:events,error:eventError}=shipmentIds.length?await db.from("india_shipping_webhook_events").select("shipment_id,event_status,received_at,event_occurred_at").in("shipment_id",shipmentIds).order("received_at",{ascending:false}).limit(180):{data:[],error:null};
  if(eventError)return reply(503,{ok:false,code:"events_unavailable"});
  const {data:preparations,error:prepError}=ids.length?await db.from("india_shipping_preparations").select("order_id,delivery_pin,weight_kg,length_cm,breadth_cm,height_cm,packing_notes,updated_at").in("order_id",ids):{data:[],error:null};
  if(prepError)return reply(503,{ok:false,code:"preparations_unavailable"});
  return reply(200,{ok:true,orders:orders??[],shipments:shipments??[],events:events??[],preparations:preparations??[],readOnly:true});
 }catch{return reply(503,{ok:false});}
});