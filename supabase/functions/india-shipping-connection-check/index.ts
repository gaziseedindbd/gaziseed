import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import {createIndiaConnectionCheck} from '../india-shipping-booking/core/india-connection.ts';
const names=['SUPABASE_URL','SHIPROCKET_API_EMAIL','SHIPROCKET_API_PASSWORD','SHIPROCKET_SANDBOX_API_EMAIL','SHIPROCKET_SANDBOX_API_PASSWORD'];
Deno.serve(async (req:Request)=>{
 const env=Object.fromEntries(names.map(name=>[name,Deno.env.get(name)]));
 const handler=createIndiaConnectionCheck({env,authenticate:async request=>{
  const key=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default;
  if(!env.SUPABASE_URL||!key)return false;
  const auth=request.headers.get('authorization')||'';
  const client=createClient(env.SUPABASE_URL,key,{global:{headers:{Authorization:auth,'x-gazi-country':'IN'}},auth:{persistSession:false,autoRefreshToken:false}});
  const u=await client.auth.getUser(auth.replace(/^Bearer\s+/,''));if(u.error||!u.data.user)return false;
  const [a,c]=await Promise.all([client.rpc('is_admin'),client.rpc('current_admin_country')]);
  return !a.error&&!c.error&&a.data===true&&String(c.data).toUpperCase()==='IN';
 }});
 const response=await handler(req);
 // Structured diagnostic contains only status/configuration booleans; never provider bodies or credentials.
 if(req.method==='POST')console.info('india_shipping_connection_diagnostic',await response.clone().text());
 return response;
});
