import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.112.3";
import {createIndiaBookingApi} from './core/india-server-api.ts';
const names=['SUPABASE_URL','SHIPROCKET_PICKUP_POSTCODE','SHIPROCKET_PICKUP_LOCATION','INDIA_SHIPPING_BOOKING_MODE','INDIA_SHIPPING_PROVIDER_CONTRACT','SHIPROCKET_API_EMAIL','SHIPROCKET_API_PASSWORD','CASHFREE_APP_ID','CASHFREE_SECRET_KEY','STEP22_CASHFREE_SANDBOX_APP_ID','STEP22_CASHFREE_SANDBOX_SECRET_KEY'];
Deno.serve(async req=>{
 const env=Object.fromEntries(names.map(n=>[n,Deno.env.get(n)]));
 try{
  const pub=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default;
  const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
  if(!env.SUPABASE_URL||!pub||!secret)return Response.json({ok:false,code:'configuration_unavailable'},{status:503});
  // Sandbox simulation is project-bound. Production live gate remains unconfigured.
  if(env.SUPABASE_URL==='https://qqehtphbpypcmxliaiqd.supabase.co'){
   env.INDIA_SHIPPING_BOOKING_MODE='sandbox_simulated';
   env.SHIPROCKET_PICKUP_POSTCODE='783124';env.SHIPROCKET_PICKUP_LOCATION='SANDBOX-ONLY';
  }
  const db=createClient(env.SUPABASE_URL,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  return await createIndiaBookingApi({db,env,authenticate:async request=>{
   const auth=request.headers.get('authorization')||'';
   if(!auth.startsWith('Bearer '))return null;
   const viewer=createClient(env.SUPABASE_URL!,pub,{global:{headers:{Authorization:auth,'x-gazi-country':'IN'}},auth:{persistSession:false,autoRefreshToken:false}});
   const u=await viewer.auth.getUser(auth.slice(7));if(u.error||!u.data.user)return null;
   const [a,c]=await Promise.all([viewer.rpc('is_admin'),viewer.rpc('current_admin_country')]);
   return !a.error&&!c.error&&a.data===true&&String(c.data).toUpperCase()==='IN'?u.data.user.id:null;
  }})(req);
 }catch{return Response.json({ok:false,code:'configuration_unavailable'},{status:503})}
});
