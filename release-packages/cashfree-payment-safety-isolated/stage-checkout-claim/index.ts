/** GAZI SEED India checkout staging integration (NOT a production handler).
 * Exercises stable checkout key -> atomic claim -> duplicate block.
 * Explicitly no Cashfree provider calls or session issuance.
 */
// Browser/Next TypeScript-compatible; no Deno-specific npm: import.
const runtime = (globalThis as unknown as { Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Promise<Response>) => void;
}}).Deno;
const TEST_PROJECT = "https://qqehtphbpypcmxliaiqd.supabase.co";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(status:number,payload:Record<string,unknown>)=>new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const digest=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,"0")).join("");
async function tokenMatches(a:string,b:string){if(!a||!b)return false;const[x,y]=await Promise.all([digest(a),digest(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);return diff===0}
runtime.serve(async request=>{
 if(request.method!=="POST")return reply(405,{ok:false,error:"POST only"});
 if(runtime.env.get("SUPABASE_URL")!==TEST_PROJECT)return reply(503,{ok:false,error:"Test project only"});
 if(!await tokenMatches(request.headers.get("x-test-token")??"",runtime.env.get("CASHFREE_SANDBOX_TEST_TOKEN")??""))return reply(401,{ok:false,error:"Unauthorized"});
 const service=runtime.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!service)return reply(503,{ok:false,error:"Service role unavailable"});
 let body:unknown;try{body=await request.json()}catch{return reply(400,{ok:false,error:"Invalid JSON"})}
 if(!body||typeof body!=="object"||Array.isArray(body))return reply(400,{ok:false,error:"Object required"});
 const b=body as Record<string,unknown>;
 const checkout=b.checkout_key,quote=b.server_quote_id;
 if(typeof checkout!=="string"||!UUID.test(checkout)||typeof quote!=="string"||!/^test-quote-[a-z0-9-]{8,64}$/.test(quote))
  return reply(400,{ok:false,error:"Valid checkout_key and synthetic server_quote_id required"});
 const key=checkout.toLowerCase();
 // Simulated ₹1 quote only. Server-signed/DB-backed quotes must replace this in real checkout.
 const fingerprint=await digest("IN|INR|1.00|"+quote);
 const orderId="gzt-stage-"+key.replaceAll("-","");
 let data: {state?: string}|null = null;
 try {
  const res = await fetch(TEST_PROJECT+"/rest/v1/rpc/cf_stage_claim_checkout",{
   method:"POST",
   headers:{"content-type":"application/json",apikey:service,Authorization:"Bearer "+service},
   body:JSON.stringify({p_key:key,p_fingerprint:fingerprint,p_intent:key,p_order:orderId,p_amount:1}),
   signal:AbortSignal.timeout(10000)
  });
  if(!res.ok)throw Error("RPC failed");
  data=await res.json() as {state?:string};
 }catch{return reply(503,{ok:false,decision:"reconcile_first",error:"Registry claim unavailable"})}
 if(!data||typeof data.state!=="string")return reply(503,{ok:false,decision:"reconcile_first",error:"Invalid registry response"});
 const state=data.state;
 if(state==="claimed")return reply(200,{ok:true,test_only:true,state:"claimed",decision:"creation_reserved",
  checkout_key:key,provider_order_id:orderId,automatic_provider_creation:false,
  provider_called:false,order_created:false,payment_created:false});
 if(state==="creating")return reply(409,{ok:false,test_only:true,state,decision:"creation_blocked",automatic_provider_creation:false});
 if(state==="reused")return reply(200,{ok:true,test_only:true,state,decision:"reuse_existing",automatic_provider_creation:false});
 return reply(409,{ok:false,test_only:true,state,decision:"reconcile_first",automatic_provider_creation:false});
});

export {};
