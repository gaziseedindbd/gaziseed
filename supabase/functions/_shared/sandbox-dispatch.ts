import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
const BASE="https://qqehtphbpypcmxliaiqd.supabase.co";
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info,x-gazi-country","access-control-allow-methods":"POST,OPTIONS","content-type":"application/json","cache-control":"no-store"};
const reply=(s:number,b:unknown)=>new Response(JSON.stringify({ok:s<400,...b as Record<string,unknown>}),{status:s,headers:cors});
const money=(a:unknown,b:unknown)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=0.01;
export async function sandboxDispatch(req: Request): Promise<Response> {
 if(req.method==="OPTIONS")return reply(200,{ok:true});
 if(req.method!=="POST")return reply(405,{error:"post_required"});
 if(Deno.env.get("SUPABASE_URL")!==BASE)return reply(503,{error:"sandbox_only"});
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer "))return reply(401,{error:"sandbox_login_required"});
 let pub;try{pub=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default}catch{return reply(503,{error:"auth_configuration_invalid"})}
 if(!pub)return reply(503,{error:"auth_configuration_missing"});
 let who;try{const r=await fetch(BASE+"/auth/v1/user",{headers:{apikey:pub,authorization:auth},signal:AbortSignal.timeout(8000)});if(!r.ok)return reply(401,{error:"sandbox_session_invalid"});who=await r.json();}catch{return reply(503,{error:"auth_unavailable"})}
 if(!who?.id)return reply(401,{error:"sandbox_session_invalid"});
 let body;try{body=await req.json()}catch{return reply(400,{error:"invalid_json"})}
 if(!body||typeof body!=="object"||Array.isArray(body))return reply(400,{error:"invalid_json"});
 if(!["verify_only","shipped"].includes(body.status)||Object.keys(body).some(k=>!["status","orderId","note"].includes(k))||(body.note!==undefined&&typeof body.note!=="string"))return reply(400,{error:"invalid_action"});
 if((!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.orderId||"")))return reply(400,{error:"invalid_order_id"});
 const url=Deno.env.get("SUPABASE_DB_URL");if(!url)return reply(503,{error:"db_configuration_missing"});
 const db=postgres(url,{max:1,connect_timeout:8,prepare:false,ssl:"require"});
 let writer;
 try{
 const admins=await db`SELECT user_id,country_code,role,is_active FROM security_compat.admin_users WHERE user_id=${who.id}::uuid AND is_active`;
 if(admins.length!==1)return reply(403,{error:"sandbox_admin_not_enrolled"});
 const a=admins[0];let country=a.country_code;
 if(a.role==="master_admin"){const ctx=await db`SELECT country_code FROM security_compat.admin_branch_context WHERE user_id=${who.id}::uuid`;country=ctx[0]?.country_code||"BD";}
 if(country!=="IN")return reply(403,{error:"india_test_admin_required"});
 const rows=await db`SELECT o.*,i.id AS intent_id,i.cashfree_order_id,i.amount AS intent_amount,i.currency AS intent_currency,i.country_code AS intent_country FROM security_compat.orders o JOIN security_compat.payment_intents i ON i.completed_order_id=o.id AND i.status='completed' WHERE o.id=${body.orderId}::uuid AND o.country_code='IN'`;
 if(rows.length!==1||rows[0].status!=="packed")return reply(409,{error:"order_not_eligible"});const order=rows[0];
 const cod=order.payment_method==='cod';
 const expectedSnapshot=Number(cod?order.payment_advance_amount:order.final_amount);
 const due=Number(order.payment_due_amount),total=Number(order.final_amount);
 if(!Number.isFinite(expectedSnapshot)||expectedSnapshot<=0||!Number.isFinite(total)||total<=0||order.payment_due_amount==null||!Number.isFinite(due)||due<0||order.intent_country!=='IN'||order.intent_currency!=='INR'||!money(order.intent_amount,expectedSnapshot)||
 (cod?order.payment_status!=='partially_paid'||!money(expectedSnapshot+due,total):order.payment_status!=='paid'||due!==0))return reply(409,{error:'amount_or_balance_mismatch'});
 const wu=Deno.env.get("STEP22_WRITER_DATABASE_URL"),app=Deno.env.get("STEP22_CASHFREE_SANDBOX_APP_ID"),key=Deno.env.get("STEP22_CASHFREE_SANDBOX_SECRET_KEY");
 if(!wu||!app||!key)return reply(503,{error:"sandbox_secrets_missing"});
 const parsed=new URL(wu);
 if(parsed.username!=="security_test_evidence_writer.qqehtphbpypcmxliaiqd"||parsed.hostname!=="aws-0-ap-southeast-1.pooler.supabase.com"||parsed.port!=="6543"||parsed.pathname!=="/postgres")return reply(503,{error:"writer_scope_mismatch"});
 writer=postgres(wu,{max:1,prepare:false,connect_timeout:8,ssl:"require"});
 const role=await writer`SELECT current_user AS name`;if(role[0]?.name!=="security_test_evidence_writer")return reply(503,{error:"writer_identity_mismatch"});
 const bindings=await writer`SELECT * FROM security_compat.get_dispatch_gateway_identity(${order.id}::uuid)`;
 if(bindings.length!==1)return reply(409,{error:"gateway_binding_missing"});const binding=bindings[0];const expected=Number(binding.expected_amount);
 if(binding.cashfree_order_id!==order.cashfree_order_id||!money(expected,expectedSnapshot))return reply(409,{error:"gateway_binding_changed"});
 if(!Number.isFinite(expected)||expected<=0||binding.currency!=="INR")return reply(409,{error:"invalid_expected_amount"});
 const headers={"x-api-version":"2025-01-01","x-client-id":app,"x-client-secret":key};
 const root="https://sandbox.cashfree.com/pg/orders/"+encodeURIComponent(binding.cashfree_order_id);
 const get=async(s:string)=>{const r=await fetch(root+s,{headers,signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error("provider_unavailable");return r.json()};
 const [cf,payments,refunds]=await Promise.all([get(""),get("/payments"),get("/refunds")]);
 if(!Array.isArray(payments)||!Array.isArray(refunds))return reply(502,{error:"provider_response_invalid"});
 if(refunds.some((r:any)=>!["FAILED","CANCELLED"].includes(String(r.refund_status||"").toUpperCase()))){
 await writer`SELECT security_compat.revoke_refunded_evidence(${order.id}::uuid,${binding.cashfree_order_id}::text)`;return reply(409,{error:"refund_detected"});}
 if(cf.order_id!==binding.cashfree_order_id||cf.order_status!=="PAID"||cf.order_currency!=="INR"||!money(cf.order_amount,expected))return reply(409,{error:"provider_order_mismatch"});
 const paid=payments.filter((p:any)=>p?.payment_status==="SUCCESS");
 if(paid.length!==1||paid[0].order_id!==binding.cashfree_order_id||paid[0].payment_currency!=="INR"||!money(paid[0].payment_amount,expected)||paid[0].cf_payment_id==null)return reply(409,{error:"payment_not_uniquely_verified"});
 await writer`SELECT security_compat.record_verified_payment(${order.id}::uuid,${binding.cashfree_order_id}::text,${String(paid[0].cf_payment_id)}::text,${expected}::numeric,'INR','PAID','SUCCESS')`;
 if(body.status==="verify_only")return reply(200,{ok:true,verified:true,sandbox:true,payment_type:cod?"cod_advance":"prepaid",verified_amount:expected,due_amount:due,gateway_status:"PAID",currency:"INR"});
 const dispatched=await db.begin(async tx=>{
 await tx`SET LOCAL ROLE service_role`;
 const r=await tx`SELECT security_compat.dispatch_verified_cashfree_order(${order.id}::uuid,${who.id}::uuid,${order.intent_id}::uuid,${binding.cashfree_order_id}::text,${order.final_amount}::numeric,${order.payment_advance_amount}::numeric,${order.payment_due_amount}::numeric,${typeof body.note==='string'?body.note.slice(0,2000):''}::text) AS result`;
 return r[0].result;});
 return reply(dispatched?.success?200:409,{ok:dispatched?.success===true,sandbox:true,verified:dispatched?.success===true,status:dispatched?.status||"blocked"});
 }catch{return reply(503,{error:"sandbox_verification_failed"})}
 finally{if(writer)await writer.end({timeout:1}).catch(()=>{});await db.end({timeout:1}).catch(()=>{});}

}
