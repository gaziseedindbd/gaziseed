const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const providerSource = stripTypeScriptTypes(fs.readFileSync('supabase/functions/_shared/cashfree-dispatch-provider.ts','utf8').replace('export function','function'));
const source = providerSource + '\n' + stripTypeScriptTypes(fs.readFileSync('supabase/functions/cashfree-verify-dispatch/index.ts', 'utf8').replace(/^import .*;\n/gm, ''));
const id = '11111111-1111-1111-1111-111111111111';
async function run(change = {}) {
  const order = { id, country_code:'IN', status:'packed', payment_method:'cashfree', payment_status:'paid', final_amount:199, payment_advance_amount:0, payment_due_amount:0, ...change.order };
  const intent = { id:'intent', completed_order_id:id, status:'completed', currency:'INR', amount:199, cashfree_order_id:'GS-test', metadata:{}, ...change.intent };
  let handler, writes = 0; const audits = []; let dispatchArgs;
  let evidenceRecords=0,revocations=0;
  const writer=async(strings,...values)=>{
    const q=strings.join('?');
    if(q.includes('SET LOCAL ROLE'))return [];
    if(q.includes('pg_roles'))return [{name:change.badWriter?'service_role':'security_test_evidence_writer',member:!change.noWriterMembership,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false}];
    if(q.includes('get_cashfree_dispatch_identity'))return [{intent_id:intent.id,provider_order_id:intent.cashfree_order_id,expected_amount:intent.amount}];
    if(q.includes('record_cashfree_dispatch_evidence')){if(change.evidenceDenied)throw Object.assign(Error('denied'),{code:'42501'});evidenceRecords++;return [];}
    if(q.includes('revoke_cashfree_dispatch_evidence')){revocations++;return [];}
    throw Error('Unexpected writer query');
  };writer.end=async()=>{};writer.begin=async(fn)=>fn(writer);
  const client = { auth:{getUser:async()=>({data:{user:change.noUser ? null : {id:'admin'}}})}, rpc:async(name)=>({data:name==='is_admin' ? !change.nonAdmin : change.country || 'IN'}) };
  const admin = {rpc:async(name,args)=>{assert.equal(name,'dispatch_verified_cashfree_order');dispatchArgs=args;if(change.rpcError)return{error:{message:'Audit insert failed'}};writes++;return{data:change.race?{success:false}:{success:true,id,status:'shipped'}};},from(table) { let update = false; const q = {insert:async(row)=>{assert.equal(table,'payment_security_audit_log');if(change.auditThrow)throw Error('offline');if(change.auditError)return{error:{message:'offline'}};audits.push(row);return{};},select(){return q;},eq(){return q;}, update(){update=true; return q;},async maybeSingle(){if(update){writes++;return {data:change.race ? null : {id,status:'shipped'}};}return {data:order};},then(resolve,reject){return Promise.resolve({data:change.intents || [intent]}).then(resolve,reject);} };return q;}};
  const context = {Response, Request, Number, JSON, Date, URL, AbortSignal, postgres:()=>writer, encodeURIComponent, createClient:(_,key)=>key==='public' ? client : admin,
    Deno:{env:{get:(key)=>key==='SUPABASE_URL' ? 'https://qqehtphbpypcmxliaiqd.supabase.co' : key==='SUPABASE_PUBLISHABLE_KEYS' ? '{"default":"public"}' : key==='SUPABASE_SECRET_KEYS' ? '{"default":"secret"}' : key==='CASHFREE_DISPATCH_WRITER_DATABASE_URL' ? (change.missingWriter?'':'postgresql://security_test_evidence_writer.qqehtphbpypcmxliaiqd:dummy@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres') : key==='STEP22_WRITER_DATABASE_URL' ? '' : 'mock'},serve:(fn)=>handler=fn},
    fetch:async(url)=>new Response(JSON.stringify(url.endsWith('/refunds') ? change.refunds || [] : url.endsWith('/payments') ? change.payments || [{order_id:'GS-test',payment_status:'SUCCESS',payment_currency:'INR',payment_amount:199,cf_payment_id:'test-123'}] : {order_id:'GS-test',order_status:'PAID',order_currency:'INR',order_amount:199,...change.gateway}),{status:change.apiError ? 502 : 200})};
  vm.runInNewContext(source,context);
  const response = await handler(new Request('https://local.test',{method:'POST',headers:change.noAuth ? {} : {authorization:'Bearer mock'},body:JSON.stringify({orderId:id,status:'shipped',...change.body})}));
  return {status:response.status,body:await response.json(),writes,audits,dispatchArgs,evidenceRecords,revocations};
}
if(require.main===module)(async()=>{
 const cases = [
  ['missing authentication',{noAuth:true},401],['invalid session',{noUser:true},401],['non admin',{nonAdmin:true},403],['Bangladesh admin',{country:'BD'},403],
  ['fake paid without intent',{intents:[]},409],['duplicate intents',{intents:[{},{}]},409],['intent amount mismatch',{intent:{amount:100}},409],
  ['gateway amount mismatch',{gateway:{order_amount:100}},409],['gateway unpaid',{gateway:{order_status:'ACTIVE'}},409],['currency mismatch',{gateway:{order_currency:'USD'}},409],
  ['refunded',{refunds:[{refund_status:'SUCCESS'}]},409],['refund pending',{refunds:[{refund_status:'PENDING'}]},409],['gateway unavailable',{apiError:true},502],
  ['cancelled order',{order:{status:'cancelled'}},409],['unpacked order',{order:{status:'pending'}},409],['wrong branch order',{order:{country_code:'BD'}},409],
  ['prepaid due mismatch',{order:{payment_due_amount:50}},409],['concurrent status change',{race:true},409],['wrong gateway order ID',{gateway:{order_id:'OTHER-ORDER'}},409],['missing gateway order ID',{gateway:{order_id:null}},409],['inconsistent COD total',{order:{payment_method:'cod',payment_advance_amount:199,payment_due_amount:999},intent:{metadata:{payment_method:'cod'}}},409],['valid COD advance',{order:{payment_method:'cod',final_amount:1198,payment_advance_amount:199,payment_due_amount:999},intent:{metadata:{payment_method:'cod'}}},200],['negative COD due',{order:{payment_method:'cod',payment_advance_amount:199,payment_due_amount:-1},intent:{metadata:{payment_method:'cod'}}},409],['valid prepaid',{},200],['verify only',{body:{status:'verify_only'}},200],
 ['no successful provider payment',{payments:[]},409],
 ['wrong payment amount',{payments:[{order_id:'GS-test',payment_status:'SUCCESS',payment_currency:'INR',payment_amount:1,cf_payment_id:'test'}]},409],
 ['duplicate successful provider payments',{payments:[{payment_status:'SUCCESS'},{payment_status:'SUCCESS'}]},409],
 ['untrusted writer role',{badWriter:true},503],['missing writer membership',{noWriterMembership:true},503],['missing writer config',{missingWriter:true},503],['evidence rejected',{evidenceDenied:true},409],
 ['caller-supplied evidence rejected',{body:{verified:true}},400]
 ];
 for(const [name,change,status] of cases){const r=await run(change);assert.equal(r.status,status,name);if(status!==200 && !change.race)assert.equal(r.writes,0,name);if(change.body?.status==='verify_only')assert.equal(r.writes,0,name);console.log('PASS',name);}
 console.log('All '+cases.length+' dispatch regression scenarios passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

module.exports = {run};
