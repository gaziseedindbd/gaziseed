const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module'),{webcrypto}=require('node:crypto');
const id='11111111-1111-1111-1111-111111111111';
async function run(slug,c={}){
 const cod=slug==='cashfree-complete-cod-order',campaign=slug==='cashfree-campaign-payment';
 let handler,completions=0;const statuses=[];
 const intent={id,country_code:'IN',currency:'INR',status:'created',cashfree_order_id:'GS-test',amount:cod?120:199,items:[],metadata:cod?{payment_method:'cod',quote_final:500}:campaign?{payment_flow:'india_campaign'}:{},customer_details:{},...c.intent};
 const admin={auth:{getUser:async()=>({data:{user:c.uid?{id:c.uid}:null}})},functions:{invoke:async()=>({})},rpc:async(name)=>{if(name==='calculate_cashfree_checkout_quote')return{data:{success:true,final_amount:cod?500:199,delivery_charge:120,...c.quote}};completions++;return{data:{success:true,order_id:'completed',amount:cod?500:199,advance_amount:120,due_amount:380}};},from(table){let projection='*',update;const q={select(s){projection=s;return q},eq(){return q},in(){return q},is(){return q},update(v){update=v;if(v.status)statuses.push(v.status);return q},maybeSingle:async()=>({data:table==='orders'?{country_code:'IN'}:update&&projection==='id'?{id}:intent}),then(resolve,reject){return Promise.resolve({data:null,error:null}).then(resolve,reject)}};return q;}};
 const source=stripTypeScriptTypes(fs.readFileSync(`supabase/functions/${slug}/index.ts`,'utf8').replace(/^import .*;\n/gm,''));
 vm.runInNewContext(source,{Request,Response,JSON,Date,Number,Math,Error,crypto:webcrypto,encodeURIComponent,
 Deno:{env:{get:k=>c.missingCredentials&&k==='CASHFREE_APP_ID'?undefined:k==='SUPABASE_SECRET_KEYS'||k==='SUPABASE_PUBLISHABLE_KEYS'?'{"default":"mock"}':'mock'},serve:f=>handler=f},createClient:()=>admin,
 fetch:async(url)=>{if(c.offline)throw Error("offline");return new Response(JSON.stringify(url.endsWith("/refunds")?(c.refunds||[]):{order_id:'GS-test',order_status:'PAID',order_currency:'INR',order_amount:cod?120:199,...c.gateway}),{status:url.endsWith("/refunds")&&c.refundError?502:200})}});
 const r=await handler(new Request('https://local.test',{method:'POST',body:JSON.stringify({action:'complete',payment_intent_id:id}),headers:{...(c.noInternal?{}:{'x-cashfree-internal-secret':c.badInternal?'spoof':'mock'}),...(c.uid?{Authorization:'Bearer user'}:{})}}));return{status:r.status,completions,statuses,body:await r.json()};
}
module.exports={run};
if(require.main===module)(async()=>{
 let count=0;
 const cases=[['valid',{},200,1],['wrong gateway ID',{gateway:{order_id:'OTHER'}},409,0],['missing gateway ID',{gateway:{order_id:null}},409,0],['wrong currency',{gateway:{order_currency:'USD'}},409,0],['missing currency',{gateway:{order_currency:null}},409,0],['wrong amount',{gateway:{order_amount:100}},409,0],['non-numeric amount',{gateway:{order_amount:'invalid'}},409,0],['missing amount',{gateway:{order_amount:null}},409,0],['zero amount',{gateway:{order_amount:0}},409,0],['invalid saved amount',{intent:{amount:'invalid'}},409,0],['invalid intent currency',{intent:{currency:'USD'}},409,0]];
 for(const slug of ['cashfree-complete-order','cashfree-complete-cod-order','cashfree-campaign-payment'])for(const [name,c,status,n]of cases){const r=await run(slug,c);assert.equal(r.status,status,slug+' '+name);assert.equal(r.completions,n,slug+' '+name);count++;console.log('PASS',slug,name);}
 for(const c of [{quote:{final_amount:'invalid'}},{quote:{delivery_charge:'invalid'}},{intent:{metadata:{payment_method:'cod',quote_final:'invalid'}}}]){const r=await run('cashfree-complete-cod-order',c);assert.equal(r.status,409);assert.equal(r.completions,0);count++;}
 console.log(`All ${count} amount integrity regression scenarios passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
