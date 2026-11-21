const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { createHmac, webcrypto } = require('node:crypto');
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/cashfree-webhook/index.ts','utf8').replace(/^import .*;\n/gm,''));
async function run(c={}){
 let handler, calls=0, metaCalls=0, writes=0, currentTable='';
 const intent={id:'test-intent',status:'created',metadata:c.campaign ? {payment_flow:'india_campaign'} : c.cod ? {payment_method:'cod'} : {},...c.intent};
 const q={select(){return q;},eq(){return q;},update(){writes++;return q;},in(){return Promise.resolve({error:c.updateError ? {message:'mock'} : null});},maybeSingle:async()=>({data:currentTable==='orders' ? {order_number:'GS-IN-TEST001',country_code:'IN'} : (c.unknown ? null : intent),error:c.lookupError ? {message:'mock'} : null})};
 vm.runInNewContext(source,{Request,Response,Date,JSON,Number,TextEncoder,Uint8Array,btoa,crypto:webcrypto,
 Deno:{env:{get:k=>k==='SUPABASE_SECRET_KEYS' ? '{"default":"mock"}' : 'test-secret'},serve:f=>handler=f},createClient:()=>({from:table=>{currentTable=table;return q;}}),
 fetch:async(url,options)=>{if(String(url).includes('/api/marketing/meta-capi/purchase')){metaCalls++;return new Response(JSON.stringify({ok:!c.metaFailure,status:c.metaFailure?'failed':'sent'}),{status:c.metaFailure?502:200});}calls++;if(c.cod)assert.equal(options.headers["x-cashfree-internal-secret"],"test-secret");if(c.networkError)throw Error('offline');return new Response(c.rawResponse ?? JSON.stringify(c.response || {ok:true,completed:true,order_id:'order-one',order_number:'GS-IN-TEST001'}),{status:c.responseStatus || 200});}});
 const payload={type:c.type || 'PAYMENT_SUCCESS_WEBHOOK',data:{order:{order_id:'GS-test'},payment:{payment_status:c.paymentStatus || 'SUCCESS'}}};
 const body=JSON.stringify(payload),timestamp=String(Date.now());
 const signature=createHmac('sha256','test-secret').update(timestamp+body).digest('base64');
 const headers={'x-webhook-version':'2025-01-01','x-webhook-timestamp':timestamp,'x-webhook-signature':c.badSignature ? 'bad' : signature};
 const r=await handler(new Request('https://local.test',{method:'POST',headers,body}));return {status:r.status,body:await r.json(),calls,metaCalls,writes};
}
(async()=>{
 const cases=[['signature rejected',{badSignature:true},401],['database lookup error',{lookupError:true},503],['unknown order',{unknown:true},200],['completed replay',{intent:{completed_order_id:'existing'}},200],['valid prepaid',{},200],['valid COD',{cod:true},200],['valid campaign',{campaign:true},200],['processing',{response:{ok:true,processing:true},responseStatus:202},503],['campaign processing',{campaign:true,response:{ok:true,processing:true},responseStatus:202},503],['unpaid',{response:{ok:true,paid:false}},503],['application failure',{response:{ok:false,error:'failed'}},503],['malformed response',{rawResponse:'broken'},503],['missing order ID',{response:{ok:true,completed:true}},503],['completion HTTP failure',{responseStatus:502},503],['network exception',{networkError:true},503],['failure update error',{type:'PAYMENT_FAILED_WEBHOOK',paymentStatus:'FAILED',updateError:true},503],['dropped update error',{type:'PAYMENT_USER_DROPPED_WEBHOOK',paymentStatus:'USER_DROPPED',updateError:true},503],['failed attempt saved',{type:'PAYMENT_FAILED_WEBHOOK',paymentStatus:'FAILED'},200],['already-completed downstream',{response:{ok:true,already_completed:true,order_id:'existing',order_number:'GS-IN-TEST001'}},200],['Meta API unavailable',{metaFailure:true},503]];
 for(const [name,c,status] of cases){const r=await run(c);assert.equal(r.status,status,name);if(c.badSignature||c.lookupError||c.unknown||c.intent?.completed_order_id)assert.equal(r.calls,0,name);if(['valid prepaid','valid COD','valid campaign','completed replay','already-completed downstream'].includes(name))assert.equal(r.metaCalls,1,name);if(['failed attempt saved','unpaid','signature rejected','unknown order'].includes(name))assert.equal(r.metaCalls,0,name);console.log('PASS',name);}
 console.log('All 20 signed-webhook mocked regression scenarios passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
