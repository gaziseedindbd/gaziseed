import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
const BASE="https://qqehtphbpypcmxliaiqd.supabase.co";
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS","content-type":"application/json","cache-control":"no-store"};
const reply=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const money=(a:unknown,b:unknown)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=0.01;
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return reply(200,{ok:true});
 if(req.method!=="POST")return reply(405,{error:"post_required"});
 if(Deno.env.get("SUPABASE_URL")!==BASE)return reply(503,{error:"sandbox_only"});
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer "))return reply(401,{error:"sandbox_login_required"});
 const pub=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default;
 let who;try{const r=await fetch(BASE+"/auth/v1/user",{headers:{apikey:pub,authorization:auth},signal:AbortSignal.timeout(8000)});if(!r.ok)return reply(401,{error:"sandbox_session_invalid"});who=await r.json();}catch{return reply(503,{error:"auth_unavailable"})}
 if(!who?.id)return reply(401,{error:"sandbox_session_invalid"});
 let body;try{body=await req.json()}catch{return reply(400,{error:"invalid_json"})}
 if(!["list","verify_only","shipped","create_payment"].includes(body.action)||Object.keys(body).some(k=>!["action","orderId"].includes(k)))return reply(400,{error:"invalid_action"});
 if(!["list","create_payment"].includes(body.action)&&(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.orderId||"")))return reply(400,{error:"invalid_order_id"});
 const url=Deno.env.get("SUPABASE_DB_URL");if(!url)return reply(503,{error:"db_configuration_missing"});
 const db=postgres(url,{max:1,connect_timeout:8,prepare:false,ssl:"require"});
 let writer;
 try{
 const admins=await db`SELECT user_id,country_code,role,is_active FROM security_compat.admin_users WHERE user_id=${who.id}::uuid AND is_active`;
 if(admins.length!==1)return reply(403,{error:"sandbox_admin_not_enrolled"});
 const a=admins[0];let country=a.country_code;
 if(a.role==="master_admin"){const ctx=await db`SELECT country_code FROM security_compat.admin_branch_context WHERE user_id=${who.id}::uuid`;country=ctx[0]?.country_code||"BD";}
 if(country!=="IN")return reply(403,{error:"india_test_admin_required"});
 if(body.action==="create_payment"){
 const app=Deno.env.get("STEP22_CASHFREE_SANDBOX_APP_ID"),key=Deno.env.get("STEP22_CASHFREE_SANDBOX_SECRET_KEY");
 if(!app||!key)return reply(503,{error:"sandbox_keys_missing"});
 const headers={"x-api-version":"2025-01-01","x-client-id":app,"x-client-secret":key,"content-type":"application/json"};
 const session=await db.begin(async tx=>{
 await tx`SELECT pg_advisory_xact_lock(hashtext(${who.id}))`;
 let rows=await tx`SELECT order_id,provider_order_id FROM security_compat.preview_payment_sessions WHERE actor_id=${who.id}::uuid`;
 let orderId=rows[0]?.order_id,gateway=rows[0]?.provider_order_id;
 if(!orderId){
 orderId=crypto.randomUUID();gateway="gazi_dispatch_"+orderId.replaceAll("-","");
 await tx`INSERT INTO security_compat.orders(id,country_code,status,order_status,payment_method,payment_status,final_amount,payment_advance_amount,payment_due_amount,internal_notes) VALUES(${orderId}::uuid,'IN','packed','packed','cashfree','paid',1,1,0,'Synthetic positive test fixture; provider verification required')`;
 await tx`INSERT INTO security_compat.payment_intents(completed_order_id,country_code,currency,status,amount,cashfree_order_id) VALUES(${orderId}::uuid,'IN','INR','completed',1,${gateway})`;
 await tx`INSERT INTO security_compat.preview_payment_sessions(actor_id,order_id,provider_order_id) VALUES(${who.id}::uuid,${orderId}::uuid,${gateway})`;
 }
 return {orderId,gateway};
 });
 const endpoint="https://sandbox.cashfree.com/pg/orders/"+session.gateway;
 let response=await fetch(endpoint,{headers,signal:AbortSignal.timeout(8000)});
 if(response.status===404){
 response=await fetch("https://sandbox.cashfree.com/pg/orders",{method:"POST",headers:{...headers,"x-idempotency-key":session.orderId},body:JSON.stringify({order_id:session.gateway,order_amount:1,order_currency:"INR",customer_details:{customer_id:"sandbox_dispatch_fixture",customer_phone:"9999999999"},order_note:"GAZI isolated Sandbox dispatch integration test"}),signal:AbortSignal.timeout(10000)});
 }
 if(!response.ok)return reply(502,{error:"sandbox_checkout_unavailable"});
 const provider=await response.json();
 if(provider.order_id!==session.gateway||provider.order_currency!=="INR"||!money(provider.order_amount,1))return reply(409,{error:"checkout_binding_mismatch"});
 if(provider.order_status==="PAID")return reply(200,{ok:true,already_paid:true,order_id:session.orderId,sandbox:true});
 if(provider.order_status!=="ACTIVE"||typeof provider.payment_session_id!=="string")return reply(409,{error:"checkout_not_active"});
 return reply(200,{ok:true,payment_session_id:provider.payment_session_id,order_id:session.orderId,sandbox:true});
 }
 if(body.action==="list"){const rows=await db`SELECT id,status,order_status,payment_method,payment_status,final_amount,payment_advance_amount,payment_due_amount,internal_notes FROM security_compat.orders WHERE country_code='IN' ORDER BY id`;return reply(200,{ok:true,sandbox:true,orders:rows});}
 const response=await fetch(BASE+'/functions/v1/cashfree-verify-dispatch',{
 method:'POST',headers:{authorization:auth,apikey:pub,'content-type':'application/json'},
 body:JSON.stringify({orderId:body.orderId,status:body.action,note:'Sandbox Preview dispatch'}),signal:AbortSignal.timeout(25000)});
 const result=await response.json();
 return reply(response.status,{...result,api:'cashfree-verify-dispatch'});
 }catch{return reply(503,{error:"sandbox_verification_failed"})}
 finally{if(writer)await writer.end({timeout:1}).catch(()=>{});await db.end({timeout:1}).catch(()=>{});}
});