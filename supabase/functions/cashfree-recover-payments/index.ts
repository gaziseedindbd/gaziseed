import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{"Content-Type":"application/json"}});

Deno.serve(async (req: Request) => {
  if(req.method!=="POST") return json({ok:false,error:"Method not allowed"},405);
  const rawKeys=Deno.env.get("SUPABASE_SECRET_KEYS"), url=Deno.env.get("SUPABASE_URL");
  const cfId=Deno.env.get("CASHFREE_APP_ID"), cfSecret=Deno.env.get("CASHFREE_SECRET_KEY");
  if(!rawKeys || !url || !cfId || !cfSecret) return json({ok:false,error:"Recovery configuration unavailable"},503);
  const key=JSON.parse(rawKeys).default;
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const internal=req.headers.get("x-cashfree-internal-secret");
  const workerKey=req.headers.get("x-gazi-recovery-key");
  let authorized=!!internal && internal===cfSecret;
  if(!authorized && workerKey){
    const {data,error}=await admin.rpc("verify_cashfree_recovery_key",{p_key:workerKey});
    authorized=!error && data===true;
  }
  if(!authorized) return json({ok:false,error:"Unauthorized"},401);
  let body: {action?:string;payment_intent_id?:string};
  try {body=await req.json();if(!body || typeof body!=="object") throw Error();} catch{return json({ok:false,error:"Invalid JSON"},400);}
  const {data:settings,error:settingsError}=await admin.from("cashfree_recovery_settings").select("enabled,enabled_since").eq("singleton",true).maybeSingle();
  if(settingsError || !settings?.enabled) return json({ok:false,error:"Recovery disabled"},503);
  const headers={"x-api-version":"2025-01-01","x-client-id":cfId,"x-client-secret":cfSecret};
  async function recover(intent: Record<string, any>) {
    if(intent.completed_order_id) return {ok:true,already_completed:true,order_id:intent.completed_order_id};
    if(!intent.cashfree_order_id || intent.country_code!=="IN" || new Date(intent.created_at)<new Date(settings.enabled_since))
      return {ok:false,error:"Intent outside recovery scope"};
    if(intent.status==="processing" && Date.parse(intent.updated_at)>Date.now()-600000)
      return {ok:false,processing:true,error:"Active completion lease"};
    const attempts=Number(intent.recovery_attempts || 0)+1;
    const {error:attemptError}=await admin.from("cashfree_payment_intents").update({recovery_attempts:attempts,
      recovery_next_attempt_at:new Date(Date.now()+Math.min(3600000,300000*2**Math.min(attempts-1,4))).toISOString()})
      .eq("id",intent.id).is("completed_order_id",null);
    if(attemptError) return {ok:false,error:"Unable to record recovery attempt"};
    let reason="Gateway verification unavailable";
    try {
      const response=await fetch("https://api.cashfree.com/pg/orders/"+encodeURIComponent(intent.cashfree_order_id),{headers,signal:AbortSignal.timeout(8000)});
      if(!response.ok) throw Error(reason);
      const cf=await response.json();
      if(cf.order_status!=="PAID") throw Error("Cashfree has not confirmed PAID");
      const amount=Number(cf.order_amount);
      if(cf.order_id!==intent.cashfree_order_id || cf.order_currency!=="INR" || intent.currency!=="INR" ||
        !Number.isFinite(amount) || amount<=0 || !Number.isFinite(Number(intent.amount)) || Math.abs(amount-Number(intent.amount))>0.01)
        throw Error("Gateway payment identity or amount mismatch");
      reason="Refund verification unavailable";
      const refundResponse=await fetch("https://api.cashfree.com/pg/orders/"+encodeURIComponent(intent.cashfree_order_id)+"/refunds",{headers,signal:AbortSignal.timeout(8000)});
      if(!refundResponse.ok) throw Error(reason);
      const refunds=await refundResponse.json();
      if(!Array.isArray(refunds) || refunds.some(r=>!["FAILED","CANCELLED"].includes(String(r.refund_status || "").toUpperCase())))
        throw Error("Refund or refund processing found");
      const {data:result,error}=await admin.rpc("recover_cashfree_order_atomic",{p_payment_intent_id:intent.id,
        p_gateway_order_id:cf.order_id,p_gateway_amount:amount,p_gateway_currency:cf.order_currency});
      if(error || !result?.success || !result?.order_id) throw Error(result?.error || "Atomic recovery failed");
      return {ok:true,completed:true,order_id:result.order_id,already_completed:!!result.already_completed};
    } catch(error) {
      const message=error instanceof Error ? error.message : reason;
      await admin.from("cashfree_payment_intents").update({recovery_last_error:message.slice(0,500)}).eq("id",intent.id).is("completed_order_id",null);
      return {ok:false,error:message};
    }
  }
  try {
    if(body.payment_intent_id){
      if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.payment_intent_id)) return json({ok:false,error:"Invalid intent ID"},400);
      const {data:intent,error}=await admin.from("cashfree_payment_intents").select("*").eq("id",body.payment_intent_id)
        .eq("country_code","IN").gte("created_at",settings.enabled_since).maybeSingle();
      if(error || !intent) return json({ok:false,error:"Recovery intent not found"},404);
      const result=await recover(intent);return json(result,result.ok ? 200 : 503);
    }
    if(body.action!=="scan") return json({ok:false,error:"Expected scan or payment_intent_id"},400);
    const now=new Date().toISOString();
    const {data:intents,error}=await admin.from("cashfree_payment_intents").select("*").eq("country_code","IN")
      .gte("created_at",settings.enabled_since).gte("created_at",new Date(Date.now()-7*86400000).toISOString())
      .is("completed_order_id",null).in("status",["created","pending","failed","processing"])
      .lte("updated_at",new Date(Date.now()-600000).toISOString())
      .or(`recovery_next_attempt_at.is.null,recovery_next_attempt_at.lte.${now}`)
      .order("recovery_next_attempt_at",{ascending:true,nullsFirst:true}).limit(10);
    if(error) return json({ok:false,error:"Recovery scan failed"},503);
    const results=[];
    for(let n=0;n<(intents || []).length;n+=2) results.push(...await Promise.all(intents.slice(n,n+2).map(recover)));
    return json({ok:true,scanned:results.length,recovered:results.filter(r=>r.ok).length,held:results.filter(r=>!r.ok).length});
  } catch {return json({ok:false,error:"Recovery worker unavailable"},503);}
});
