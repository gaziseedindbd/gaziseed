// @ts-nocheck -- Deno-only Supabase Edge Function; intentionally excluded from Next.js remote module resolution.
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
/** Isolated Cashfree Sandbox creation + same-invocation verification + atomic finish. Not for production. */
import {validateCreateEvidence} from "./trusted-create-evidence";
const PROJECT="https://qqehtphbpypcmxliaiqd.supabase.co";
const D=(globalThis as unknown as {Deno:{env:{get:(s:string)=>string|undefined},serve:(f:(r:Request)=>Promise<Response>)=>void}}).Deno;
const response=(s:number,o:Record<string,unknown>)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function sha(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("")}
D.serve(async req=>{
 const stop=(why:string,status=409)=>response(status,{ok:false,test_only:true,state:"reconcile_first",reason:why,automatic_retry_allowed:false,provider_paid:false});
 if(req.method!=="POST")return stop("method",405);
 if(D.env.get("SUPABASE_URL")!==PROJECT)return stop("wrong_project",503);
 const token=D.env.get("CASHFREE_SANDBOX_TEST_TOKEN")??"";
 if(!token||!req.headers.get("x-test-token")||await sha(req.headers.get("x-test-token")!)!==await sha(token))return stop("unauthorized",401);
 let body:unknown;try{body=await req.json()}catch{return stop("invalid_json",400)}
 const key=(body&&typeof body==="object"&&!Array.isArray(body)?(body as Record<string,unknown>).checkout_key:null);
 if(typeof key!=="string"||!uuid.test(key))return stop("invalid_checkout_key",400);
 const checkoutKey=key.toLowerCase();
 const service=D.env.get("SUPABASE_SERVICE_ROLE_KEY"),id=D.env.get("CASHFREE_SANDBOX_APP_ID"),secret=D.env.get("CASHFREE_SANDBOX_SECRET_KEY");
 if(!service||!id||!secret)return stop("sandbox_secrets_missing",503);
 const orderId="gzt-stage-"+checkoutKey.replaceAll("-","");
 const fingerprint=await sha("sandbox|new-create-v1|"+checkoutKey+"|IN|INR|1.00");
 const headers={apikey:service,Authorization:"Bearer "+service,"content-type":"application/json"};
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  const r=await fetch(PROJECT+"/rest/v1/rpc/"+name,{method:"POST",headers,body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error("rpc unavailable");return r.json();
 };
 let claimed:Record<string,unknown>;
 try{claimed=await rpc("cf_stage_claim_checkout",{p_key:checkoutKey,p_fingerprint:fingerprint,p_intent:checkoutKey,p_order:orderId,p_amount:1})}catch{return stop("registry_unavailable",503)}
 if(claimed.state!=="claimed")return stop("checkout_already_claimed_or_conflict");
 const auth={"content-type":"application/json",Accept:"application/json","x-api-version":"2025-01-01","x-client-id":id,"x-client-secret":secret};
 const base="https://sandbox.cashfree.com/pg/orders";
 let created:Record<string,unknown>,live:Record<string,unknown>,attempts:Record<string,unknown>[];
 try{
  const r=await fetch(base,{method:"POST",headers:{...auth,"x-idempotency-key":checkoutKey},
   body:JSON.stringify({order_id:orderId,order_amount:1,order_currency:"INR",customer_details:{customer_id:"test_"+checkoutKey.slice(0,8),customer_phone:"9876543210"},order_note:"GAZI SEED isolated test only"}),
   signal:AbortSignal.timeout(12000)});
  if(!r.ok)return stop("provider_create_unconfirmed_"+r.status,502);
  created=await r.json();
  const o=await fetch(base+"/"+encodeURIComponent(orderId),{headers:auth,signal:AbortSignal.timeout(12000)});
  if(!o.ok)return stop("provider_readback_unconfirmed_"+o.status,502);
  live=await o.json();
  const p=await fetch(base+"/"+encodeURIComponent(orderId)+"/payments",{headers:auth,signal:AbortSignal.timeout(12000)});
  if(!p.ok)return stop("provider_payments_unconfirmed_"+p.status,502);
  attempts=await p.json();
 }catch{return stop("provider_outcome_uncertain",503)}
 const result=validateCreateEvidence({checkoutKey,intentId:checkoutKey,orderId,amount:1,currency:"INR",country:"IN",fingerprint},created,live,attempts,Date.now());
 if(!result.allowReady||!result.sessionId)return stop(result.reason);
 const sessionLength=result.sessionId.length;
 const sessionFormatOk=sessionLength>=12&&sessionLength<=1024;
 const sessionProofChecks={session_format_ok:sessionFormatOk,session_length_in_range:sessionFormatOk,order_binding_ok:created.order_id===orderId&&live.order_id===orderId,amount_binding_ok:created.order_amount===1&&live.order_amount===1};
 if(!sessionFormatOk)return response(409,{ok:false,test_only:true,state:"reconcile_first",decision:"reconcile_first",reason:"session_response_length_invalid",verification:sessionProofChecks,automatic_retry_allowed:false});
 let completed:Record<string,unknown>;
 const uri=D.env.get("CASHFREE_STAGE_WRITER_DATABASE_URL");
 if(!uri)return stop("writer_secret_missing",503);
 let u:URL;try{u=new URL(uri)}catch{return stop("writer_uri_invalid",503)}
 if(u.protocol!=="postgresql:"||u.hostname!=="aws-0-ap-southeast-1.pooler.supabase.com"||u.port!=="6543"||u.pathname!=="/postgres"||u.username!=="cashfree_stage_verified_writer.qqehtphbpypcmxliaiqd")return stop("writer_scope_mismatch",503);
 const safeSqlCategory=(e:unknown)=>{const k=typeof (e as {code?:unknown})?.code==="string"?(e as {code:string}).code:"";if(k==="42501")return "permission_denied";if(k==="42883")return "rpc_not_found";if(k==="22P02"||k==="22023")return "invalid_sql_parameter";if(k==="57014"||k==="55P03")return "statement_timeout_or_lock";if(k.startsWith("08"))return "db_connection_error";return "unclassified_writer_error"};
 const db=postgres(uri,{max:1,connect_timeout:8,idle_timeout:1,prepare:false,ssl:"require"});
 try{
  const rows=await db`select public.cf_stage_finish_verified_checkout(
    ${checkoutKey}::uuid,${checkoutKey}::uuid,${orderId}::text,${fingerprint}::text,
    1::numeric,${JSON.stringify({order_id:orderId,payment_session_id:result.sessionId})}::jsonb
  ) as result`;
  completed=rows[0]?.result;
 }catch(e){const category=safeSqlCategory(e);console.log(JSON.stringify({event:"sandbox_writer_completion",checkout_key:checkoutKey,outcome:"execution_failed",error_category:category,session_length_valid:sessionFormatOk}));return response(503,{ok:false,test_only:true,state:"reconcile_first",reason:"finish_uncertain_reconcile",writer_error_category:category,automatic_retry_allowed:false,provider_paid:false})}
 finally{await db.end({timeout:1}).catch(()=>{})}
 console.log(JSON.stringify({event:"sandbox_writer_completion",checkout_key:checkoutKey,outcome:typeof completed?.state==="string"?completed.state:"invalid_result",writer_reason:typeof completed?.reason==="string"?completed.reason:null,session_length_valid:sessionFormatOk}));
 return response(completed.state==="ready"?200:409,{ok:completed.state==="ready",test_only:true,checkout_key:checkoutKey,provider_order_id:orderId,state:completed.state,writer_result:typeof completed?.state==="string"?completed.state:"invalid_writer_result",writer_reason:typeof completed?.reason==="string"&&["request_identity_invalid","response_invalid","identity_conflict","status_conflict","already_ready_response_conflict","checkout_missing"].includes(completed.reason)?completed.reason:null,verification:sessionProofChecks,verified_session:true,provider_paid:false,decision:completed.state==="ready"?"session_ready":"reconcile_first",automatic_retry_allowed:false});
});
export {};
