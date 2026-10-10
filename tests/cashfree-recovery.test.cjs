const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/cashfree-recover-payments/index.ts','utf8').replace(/^import .*;\n/gm,''));
const id='11111111-1111-1111-1111-111111111111';
async function run(c={}){
 let handler,completed=0,updated=0,fetches=0;
 const intent={id,country_code:'IN',currency:'INR',cashfree_order_id:'GS-future',amount:199,status:'failed',created_at:'2026-10-10T00:01:00Z',updated_at:'2026-10-10T00:01:00Z',...c.intent};
 const settings={enabled:!c.disabled,enabled_since:'2026-10-10T00:00:00Z'};
 const admin={rpc:async(name,args)=>{if(name==='verify_cashfree_recovery_key')return{data:!c.badKey};completed++;assert.equal(args.p_gateway_order_id,'GS-future');return{data:c.rpcFail?{success:false,error:'Stock unavailable'}:{success:true,order_id:'recovered',already_completed:!!c.existing}};},from(table){const q={select(){return q},eq(){return q},gte(){return q},is(){return q},in(){return q},lte(){return q},or(){return q},order(){return q},limit(){return q},update(){updated++;return q},maybeSingle:async()=>({data:table==='cashfree_recovery_settings'?settings:c.missing?null:intent}),then(resolve,reject){return Promise.resolve({data:c.scan?[intent]:null,error:c.updateError?{message:'offline'}:null}).then(resolve,reject)}};return q;}};
 vm.runInNewContext(source,{Request,Response,JSON,Date,Number,Error,Array,Promise,AbortSignal,encodeURIComponent,
 Deno:{env:{get:k=>k==='SUPABASE_SECRET_KEYS'?'{"default":"service"}':'secret'},serve:f=>handler=f},createClient:()=>admin,
 fetch:async(url)=>{fetches++;if(c.offline)throw Error('offline');const refunds=url.endsWith('/refunds');return new Response(JSON.stringify(refunds?c.refunds||[]:{order_id:'GS-future',order_status:'PAID',order_currency:'INR',order_amount:199,...c.gateway}),{status:refunds&&c.refundError?502:200})}});
 const headers=c.noAuth?{}:c.worker?{'x-gazi-recovery-key':'mock'}:{'x-cashfree-internal-secret':'secret'};
 const r=await handler(new Request('https://local.test',{method:'POST',headers,body:JSON.stringify(c.scan?{action:'scan'}:{payment_intent_id:c.badId?'invalid':id})}));return{status:r.status,body:await r.json(),completed,updated,fetches};
}
(async()=>{
 const cases=[['unauthorized',{noAuth:true},401,0],['bad worker key',{worker:true,badKey:true},401,0],['disabled',{disabled:true},503,0],['invalid ID',{badId:true},400,0],['missing intent',{missing:true},404,0],['old test excluded',{intent:{created_at:'2026-10-09T00:00:00Z'}},503,0],['BD excluded',{intent:{country_code:'BD'}},503,0],['active processing held',{intent:{status:'processing',updated_at:new Date().toISOString()}},503,0],['completed replay',{intent:{completed_order_id:'existing'}},200,0],['failed successful payment recovered',{},200,1],['stale processing recovered',{intent:{status:'processing'}},200,1],['wrong ID',{gateway:{order_id:'other'}},503,0],['wrong amount',{gateway:{order_amount:100}},503,0],['wrong currency',{gateway:{order_currency:'USD'}},503,0],['unpaid',{gateway:{order_status:'ACTIVE'}},503,0],['refund successful',{refunds:[{refund_status:'SUCCESS'}]},503,0],['refund pending',{refunds:[{refund_status:'PENDING'}]},503,0],['refund API fails',{refundError:true},503,0],['network fails',{offline:true},503,0],['quote/order rollback',{rpcFail:true},503,1],['valid worker scan',{worker:true,scan:true},200,1],['attempt persistence failure',{updateError:true},503,0]];
 for(const [name,c,status,count]of cases){const r=await run(c);assert.equal(r.status,status,name);assert.equal(r.completed,count,name);if(c.intent?.completed_order_id)assert.equal(r.fetches,0);console.log('PASS',name)}
 console.log('All 22 recovery handler regression scenarios passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
