/** Read-only real sandbox verification integrated with the pure guard. Never writes DB. */
import {verifySession} from "./verify-session.ts";
const PROJECT="https://qqehtphbpypcmxliaiqd.supabase.co";
const D=(globalThis as unknown as {Deno:{env:{get:(s:string)=>string|undefined},serve:(f:(r:Request)=>Promise<Response>)=>void}}).Deno;
const ALLOWED="b6296cfe-2cf0-4da6-851e-99d313cb7d42";
const out=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function equal(a:string,b:string){if(!a||!b)return false;const x=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(a));const y=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(b));const v=new Uint8Array(x),w=new Uint8Array(y);let n=0;for(let i=0;i<v.length;i++)n|=v[i]^w[i];return n===0}
D.serve(async(req)=>{
 const deny=(reason:string,status=409)=>out(status,{ok:false,test_only:true,allowReady:false,decision:"reconcile_first",reason,provider_order_created:false,payment_created:false,database_modified:false});
 if(req.method!=="POST")return deny("method",405);
 if(D.env.get("SUPABASE_URL")!==PROJECT)return deny("wrong_project",503);
 if(!await equal(req.headers.get("x-test-token")??"",D.env.get("CASHFREE_SANDBOX_TEST_TOKEN")??""))return deny("unauthorized",401);
 let body:unknown;try{body=await req.json()}catch{return deny("invalid_json",400)}
 if(!body||typeof body!=="object"||(body as Record<string,unknown>).checkout_key!==ALLOWED)return deny("fixture_not_allowlisted",400);
 const svc=D.env.get("SUPABASE_SERVICE_ROLE_KEY"),id=D.env.get("CASHFREE_SANDBOX_APP_ID"),secret=D.env.get("CASHFREE_SANDBOX_SECRET_KEY");
 if(!svc||!id||!secret)return deny("missing_test_secrets",503);
 const dbHeaders={apikey:svc,Authorization:"Bearer "+svc};
 try{
  const reg=await fetch(PROJECT+"/rest/v1/cashfree_checkout_claims_stage?checkout_key=eq."+ALLOWED+"&select=status,country_code,currency,provider_order_id,amount",{headers:dbHeaders,signal:AbortSignal.timeout(10000)});
  if(!reg.ok)return deny("registry_lookup_failed",503);
  const rows=await reg.json();if(!Array.isArray(rows)||rows.length!==1)return deny("registry_missing");
  const r=rows[0];if(r.status!=="creating"||r.country_code!=="IN"||r.currency!=="INR"||Number(r.amount)!==1||r.provider_order_id!=="gzt_"+ALLOWED.replaceAll("-",""))return deny("registry_mismatch");
  const auth={Accept:"application/json","x-api-version":"2025-01-01","x-client-id":id,"x-client-secret":secret};
  const url="https://sandbox.cashfree.com/pg/orders/"+encodeURIComponent(r.provider_order_id);
  const ord=await fetch(url,{headers:auth,signal:AbortSignal.timeout(12000)});
  if(!ord.ok)return deny("provider_order_http_"+ord.status,503);
  const order=await ord.json();
  const pay=await fetch(url+"/payments",{headers:auth,signal:AbortSignal.timeout(12000)});
  if(!pay.ok)return deny("provider_payments_http_"+pay.status,503);
  const attempts=await pay.json();
  if(!Array.isArray(attempts))return deny("malformed_attempts",503);
  const decision=verifySession({registry:{status:r.status,country_code:r.country_code,currency:r.currency,provider_order_id:r.provider_order_id,amount:Number(r.amount)},order:order&&typeof order==="object"?order:null,payments:attempts,session:null,now:Date.now()});
  // Intentionally NO session provenance: a DB-saved payment_session_id is not independently verified.
  return out(200,{ok:true,test_only:true,read_only:true,provider_order_status:typeof order?.order_status==="string"?order.order_status:"UNKNOWN",payment_attempt_count:attempts.length,allowReady:decision.allowReady,decision:decision.decision,reason:decision.reason,provider_order_created:false,payment_created:false,database_modified:false});
 }catch{return deny("provider_or_database_unavailable",503)}
});
export {};
