/** GAZI SEED isolated staging checkout reconciliation. Read-only; never creates orders. */
const PROJECT="https://qqehtphbpypcmxliaiqd.supabase.co";
const runtime=(globalThis as unknown as {Deno:{env:{get:(key:string)=>string|undefined},serve:(cb:(req:Request)=>Promise<Response>)=>void}}).Deno;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const send=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function digest(s:string){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
async function check(a:string,b:string){if(!a||!b)return false;const [x,y]=await Promise.all([digest(a),digest(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0}
runtime.serve(async req=>{
 if(req.method!=="POST")return send(405,{ok:false,error:"POST only"});
 if(runtime.env.get("SUPABASE_URL")!==PROJECT)return send(503,{ok:false,error:"Test project required"});
 if(!await check(req.headers.get("x-test-token")??"",runtime.env.get("CASHFREE_SANDBOX_TEST_TOKEN")??""))return send(401,{ok:false,error:"Unauthorized"});
 let body:unknown;try{body=await req.json()}catch{return send(400,{ok:false,error:"Invalid JSON"})}
 const key=(body&&typeof body==="object"&&!Array.isArray(body)?(body as Record<string,unknown>).checkout_key:null);
 if(typeof key!=="string"||!UUID.test(key))return send(400,{ok:false,error:"Valid checkout_key required"});
 const k=key.toLowerCase(),service=runtime.env.get("SUPABASE_SERVICE_ROLE_KEY"),id=runtime.env.get("CASHFREE_SANDBOX_APP_ID"),secret=runtime.env.get("CASHFREE_SANDBOX_SECRET_KEY");
 if(!service||!id||!secret)return send(503,{ok:false,error:"Test configuration unavailable"});
 const fail=(reason:string,status=503)=>send(status,{ok:false,test_only:true,decision:"manual_reconciliation_required",automatic_retry_allowed:false,reason,provider_called:false,order_created:false,database_modified:false});
 let rows:unknown;
 try{
  const res=await fetch(PROJECT+"/rest/v1/cashfree_checkout_claims_stage?checkout_key=eq."+encodeURIComponent(k)+"&select=checkout_key,status,amount,currency,provider_order_id",{
   headers:{apikey:service,Authorization:"Bearer "+service},signal:AbortSignal.timeout(10000)});
  if(!res.ok)return fail("Registry unavailable");rows=await res.json();
 }catch{return fail("Registry lookup timed out")}
 if(!Array.isArray(rows)||rows.length!==1)return fail("Checkout not uniquely found",404);
 const row=rows[0] as Record<string,unknown>;
 const orderId=row.provider_order_id;
 if(row.status!=="creating"||Number(row.amount)!==1||row.currency!=="INR"||
   typeof orderId!=="string"||orderId!=="gzt-stage-"+k.replaceAll("-",""))
  return fail("Registry state or identity mismatch",409);
 let res:Response;
 try{
  res=await fetch("https://sandbox.cashfree.com/pg/orders/"+encodeURIComponent(orderId),{
   headers:{Accept:"application/json","x-api-version":"2025-01-01","x-client-id":id,"x-client-secret":secret},
   signal:AbortSignal.timeout(12000)});
 }catch{return fail("Provider lookup timeout or network error")}
 if(!res.ok)return send(200,{ok:true,test_only:true,read_only:true,checkout_key:k,
   provider_order_found:false,provider_http_status:res.status,
   decision:"manual_reconciliation_required",automatic_retry_allowed:false,
   note:"Non-200 lookup does not prove provider order absence",
   order_created:false,payment_created:false,database_modified:false});
 let order:unknown;try{order=await res.json()}catch{return fail("Malformed provider order")}
 if(!order||typeof order!=="object"||Array.isArray(order))return fail("Malformed provider order");
 const o=order as Record<string,unknown>;
 if(o.order_id!==orderId||o.order_currency!=="INR"||Number(o.order_amount)!==1)
  return fail("Provider identity or amount mismatch",409);
 let attempts:unknown;
 try{
  const r=await fetch("https://sandbox.cashfree.com/pg/orders/"+encodeURIComponent(orderId)+"/payments",{
   headers:{Accept:"application/json","x-api-version":"2025-01-01","x-client-id":id,"x-client-secret":secret},
   signal:AbortSignal.timeout(12000)});
  if(!r.ok)return fail("Payment attempt lookup failed");attempts=await r.json();
 }catch{return fail("Payment attempt lookup timed out")}
 if(!Array.isArray(attempts))return fail("Unexpected payment attempts");
 const states=attempts.map(x=>x&&typeof x==="object"?(x as Record<string,unknown>).payment_status:"UNKNOWN");
 return send(200,{ok:true,test_only:true,read_only:true,checkout_key:k,
  provider_order_found:true,order_status:o.order_status,amount_verified:true,
  currency_verified:true,payment_attempt_count:attempts.length,payment_attempt_statuses:states,
  decision:"manual_reconciliation_required",automatic_retry_allowed:false,
  note:"Verification only: stage registry is not modified; automatic recovery not enabled",
  order_created:false,payment_created:false,database_modified:false});
});

export {};
