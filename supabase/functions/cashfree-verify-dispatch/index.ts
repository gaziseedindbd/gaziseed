import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { validateProvider } from "../_shared/cashfree-dispatch-provider.ts";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type,x-gazi-country","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const fail=(error:string,status=409)=>reply({ok:false,error},status);
const moneyMatches=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.01;

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return fail('Method not allowed',405);
 let writer:ReturnType<typeof postgres>|undefined;
 let stage='request';
 try {
 const url=Deno.env.get('SUPABASE_URL');
 const sandbox=url==='https://qqehtphbpypcmxliaiqd.supabase.co';
 if(!sandbox&&url!=='https://ufxsthshyebahkwbmioe.supabase.co')return fail('Payment project configuration unavailable. Hold dispatch.',503);
 const pub=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default;
 const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return fail('Admin login required',401);
 if(!pub||!secret)return fail('Payment verification configuration unavailable. Hold dispatch.',503);
 const client=createClient(url,pub,{global:{headers:{Authorization:authorization,'x-gazi-country':'IN'}},auth:{autoRefreshToken:false,persistSession:false}});
 const {data:who,error:whoError}=await client.auth.getUser(authorization.slice(7));
 if(whoError||!who.user)return fail('Admin session invalid',401);
 const [adminCheck,countryCheck]=await Promise.all([client.rpc('is_admin'),client.rpc('current_admin_country')]);
 if(adminCheck.error||countryCheck.error||adminCheck.data!==true||String(countryCheck.data||'').toUpperCase()!=='IN')return fail('India admin access required',403);
 let body;try{body=await req.json()}catch{return fail('Invalid JSON',400)}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['orderId','status','note'].includes(k))||
 typeof body.orderId!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.orderId)||!['shipped','verify_only'].includes(body.status)||
 (body.note!==undefined&&typeof body.note!=='string'))return fail('Expected an order ID and shipped status',400);
 const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 let auditOrderId:string|null=null,auditIntentId:string|null=null;
 const writeAudit=async(outcome:string,details:Record<string,unknown>)=>{
  try{const {error}=await admin.from('payment_security_audit_log').insert({country_code:'IN',order_id:auditOrderId,payment_intent_id:auditIntentId,actor_type:'admin',actor_id:who.user.id,event_type:'verification',outcome,details:{operation:body.status,...details}});return !error}catch{return false}
 };
 const auditedFail=async(error:string,status=409)=>await writeAudit('blocked',{reason:error})?fail(error,status):fail('Payment audit unavailable. Hold dispatch.',503);
 const {data:order,error:orderError}=await admin.from('orders').select('id,country_code,status,payment_method,payment_status,final_amount,payment_advance_amount,payment_due_amount').eq('id',body.orderId).maybeSingle();
 if(orderError||!order||order.country_code!=='IN')return fail('Order is not eligible for payment verification or dispatch');
 auditOrderId=order.id;
 if((body.status==='shipped'&&order.status!=='packed')||['cancelled','returned'].includes(String(order.status)))return auditedFail('Order is not eligible for payment verification or dispatch');
 const needsPaid=['online','cashfree'].includes(String(order.payment_method||'').toLowerCase())||['paid','partially_paid'].includes(String(order.payment_status||'').toLowerCase())||Number(order.payment_advance_amount||0)>0;
 if(!needsPaid)return auditedFail('Use normal dispatch for non-paid orders');
 const {data:intents,error:intentError}=await admin.from('cashfree_payment_intents').select('id,cashfree_order_id,amount,currency,status,completed_order_id,metadata').eq('completed_order_id',order.id).eq('status','completed');
 if(intentError||!intents||intents.length!==1)return auditedFail('Exactly one completed Cashfree intent is required. Hold dispatch.');
 const intent=intents[0];auditIntentId=intent.id;
 const cod=intent.metadata?.payment_method==='cod',expected=Number(cod?order.payment_advance_amount:order.final_amount),due=Number(order.payment_due_amount);
 if(!Number.isFinite(expected)||expected<=0||intent.currency!=='INR'||!moneyMatches(Number(intent.amount),expected)||!intent.cashfree_order_id||
 order.payment_due_amount==null||!Number.isFinite(due)||due<0||
 (cod&&(order.payment_method!=='cod'||!moneyMatches(expected+due,Number(order.final_amount))))||(!cod&&(order.payment_method==='cod'||due!==0)))return auditedFail('Cashfree amount or due balance mismatch. Hold dispatch.');
 const writerUrl=Deno.env.get('CASHFREE_DISPATCH_WRITER_DATABASE_URL')||(sandbox?Deno.env.get('STEP22_WRITER_DATABASE_URL'):undefined);
 const cfId=Deno.env.get(sandbox?'STEP22_CASHFREE_SANDBOX_APP_ID':'CASHFREE_APP_ID');
 const cfSecret=Deno.env.get(sandbox?'STEP22_CASHFREE_SANDBOX_SECRET_KEY':'CASHFREE_SECRET_KEY');
 if(!writerUrl||!cfId||!cfSecret)return fail('Dedicated payment writer configuration unavailable. Hold dispatch.',503);
 const parsed=new URL(writerUrl),projectRef=new URL(url).hostname.split('.')[0];
 const scope=parsed.username.endsWith('.'+projectRef)&&/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(parsed.hostname);
 const direct=parsed.hostname==='db.'+projectRef+'.supabase.co';
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||(!scope&&!direct)||!parsed.password||parsed.pathname!=='/postgres'||!['5432','6543'].includes(parsed.port)||parsed.search)return fail('Payment writer scope mismatch. Hold dispatch.',503);
 writer=postgres(writerUrl,{max:1,connect_timeout:8,prepare:false,ssl:'require'});
 const identities=await writer`SELECT session_user AS name,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,pg_has_role(session_user,'cashfree_evidence_writer','MEMBER') AS member FROM pg_roles WHERE rolname=session_user`;
 const identity=identities[0];
 if(!identity||!identity.member||['postgres','supabase_admin','authenticator','service_role','anon','authenticated'].includes(identity.name)||identity.rolsuper||identity.rolcreatedb||identity.rolcreaterole||identity.rolreplication||identity.rolbypassrls)return fail('Dedicated payment writer identity unavailable. Hold dispatch.',503);
 if(body.status==='shipped'){
  stage='writer_binding';
  const bindings=await writer.begin(async tx=>{await tx`SET LOCAL ROLE cashfree_evidence_writer`;return tx`SELECT * FROM public.get_cashfree_dispatch_identity(${order.id}::uuid)`;});
  if(bindings.length!==1||bindings[0].intent_id!==intent.id||bindings[0].provider_order_id!==intent.cashfree_order_id||!moneyMatches(Number(bindings[0].expected_amount),expected))return auditedFail('Verified payment binding changed. Hold dispatch.');
 }
 const root=(sandbox?'https://sandbox.cashfree.com':'https://api.cashfree.com')+'/pg/orders/'+encodeURIComponent(intent.cashfree_order_id);
 const headers={'x-api-version':'2025-01-01','x-client-id':cfId,'x-client-secret':cfSecret};
 let provider;
 try{
  const get=async(s:string)=>{const r=await fetch(root+s,{headers,signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Provider unavailable');return r.json()};
  const [cf,payments,refunds]=await Promise.all([get(''),get('/payments'),get('/refunds')]);
  provider=validateProvider(cf,payments,refunds,intent.cashfree_order_id,expected);
 }catch{return auditedFail('Cashfree lookup unavailable. Hold dispatch.',502)}
 if(provider.error){
  if(provider.refund)await writer.begin(async tx=>{await tx`SET LOCAL ROLE cashfree_evidence_writer`;return tx`SELECT public.revoke_cashfree_dispatch_evidence(${order.id}::uuid,${intent.cashfree_order_id}::text)`;});
  return auditedFail(provider.error,provider.status);
 }
 if(body.status==='shipped'){
  try{await writer.begin(async tx=>{await tx`SET LOCAL ROLE cashfree_evidence_writer`;return tx`SELECT public.record_cashfree_dispatch_evidence(${order.id}::uuid,${intent.id}::uuid,${intent.cashfree_order_id}::text,${provider.paymentId!}::text,${expected}::numeric,'INR')`;})}
  catch(error){const code=(error as {code?:string}).code;return auditedFail('Independently verified evidence unavailable. Hold dispatch.',['42501','23505'].includes(code||'')?409:503)}
 }
 if(!await writeAudit('success',{verified_amount:expected,due_amount:due,payment_type:cod?'cod_advance':'prepaid',gateway_status:'PAID',currency:'INR'}))return fail('Payment audit unavailable. Hold dispatch.',503);
 if(body.status==='verify_only')return reply({ok:true,verified:true,payment_type:cod?'cod_advance':'prepaid',verified_amount:expected,due_amount:due,gateway_status:'PAID',currency:'INR'});
 const {data:updated,error:updateError}=await admin.rpc('dispatch_verified_cashfree_order',{p_order_id:order.id,p_actor_id:who.user.id,p_intent_id:intent.id,p_gateway_order_id:intent.cashfree_order_id,p_total:order.final_amount,p_advance:order.payment_advance_amount,p_due:order.payment_due_amount,p_note:typeof body.note==='string'?body.note.slice(0,2000):''});
 if(updateError||!updated?.success)return auditedFail('Verified dispatch failed or order changed.');
 return reply({ok:true,verified:true,status:updated.status,history_recorded:updated.history_recorded===true});
 }catch(error){console.error('dispatch_verification_unavailable',{stage,code:String((error as {code?:string}).code||'unavailable')});return fail('Payment verification unavailable. Hold dispatch.',503)}
 finally{if(writer)await writer.end({timeout:1}).catch(()=>{})}
});
