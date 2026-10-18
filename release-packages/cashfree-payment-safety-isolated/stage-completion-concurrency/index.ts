// Isolated test-only parallel completion harness. No provider network calls.
export {};
const TEST="https://qqehtphbpypcmxliaiqd.supabase.co";
const env=(globalThis as unknown as {Deno:{env:{get:(s:string)=>string|undefined},serve:(f:(r:Request)=>Promise<Response>)=>void}}).Deno;
const k="cace0044-2222-4222-8222-000000000044",i="cace0055-2222-4222-8222-000000000055",order="gzt-stage-parallel-dummy";
const reply=(code:number,data:unknown)=>new Response(JSON.stringify(data),{status:code,headers:{"content-type":"application/json"}});
env.serve(async req=>{
 if(req.method!=="POST")return reply(405,{ok:false});
 if(env.env.get("SUPABASE_URL")!==TEST)return reply(503,{ok:false,reason:"wrong_project"});
 const token=env.env.get("CASHFREE_SANDBOX_TEST_TOKEN");
 if(!token||req.headers.get("x-test-token")!==token)return reply(401,{ok:false});
 const service=env.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!service)return reply(503,{ok:false});
 const headers={"content-type":"application/json",apikey:service,Authorization:"Bearer "+service};
 const base=TEST+"/rest/v1";
 async function rpc(name:string,body:unknown){
   const r=await fetch(base+"/rpc/"+name,{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error(name+" HTTP "+r.status);
   return await r.json();
 }
 const payload={p_key:k,p_intent:i,p_provider_order:order,p_fingerprint:"a".repeat(64),p_amount:1,p_response:{order_id:order,payment_session_id:"DUMMY-NOT-REAL"}};
 try{
   const create=await rpc("cf_stage_claim_checkout",{p_key:k,p_fingerprint:payload.p_fingerprint,p_intent:i,p_order:order,p_amount:1});
   if(create.state!=="claimed")return reply(409,{ok:false,reason:"fixture_checkout_key_already_used",claim:create});
   const results=await Promise.allSettled(Array.from({length:4},()=>rpc("cf_stage_finish_verified_checkout",payload)));
   const states=results.map(x=>x.status==="fulfilled"?x.value.state:"request_failed");
   const db=await fetch(base+"/cashfree_checkout_claims_stage?checkout_key=eq."+k+"&select=status,response",{headers,signal:AbortSignal.timeout(10000)});
   const rows=db.ok?await db.json():null;
   return reply(200,{ok:states.filter(x=>x==="ready").length===1&&states.filter(x=>x==="already_ready").length===3&&Array.isArray(rows)&&rows.length===1&&rows[0].status==="ready",
      test_only:true,requests:4,states,database_records:Array.isArray(rows)?rows.length:null,database_status:rows?.[0]?.status??null,
      order_created:false,payment_created:false,provider_called:false,
      cleanup_required:true});
 }catch{return reply(503,{ok:false,test_only:true,error:"Test failed; inspect fixture and clean up"})}
});