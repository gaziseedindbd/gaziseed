const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/_shared/sandbox-dispatch.ts','utf8').replace(/^import .*;\n/gm,'').replace('export async function','async function'));
const id='11111111-1111-4111-8111-111111111111';
async function run(c={}) {
  let records=0, dispatches=0, revokes=0;
  const order={id,status:'packed',intent_id:id,cashfree_order_id:'sandbox-order',final_amount:1,payment_advance_amount:1,payment_due_amount:0,payment_method:'cashfree',payment_status:'paid',intent_amount:1,intent_currency:'INR',intent_country:'IN',...c.order};
  const db=async(strings, ...values)=>{
    const sql=strings.join('?');
    if(sql.includes('admin_users'))return c.inactive?[]:[{country_code:c.country||'IN',role:'admin'}];
    if(sql.includes('SELECT o.*'))return c.noOrder?[]:c.duplicate?[order,order]:[order];
    if(sql.includes('current_user'))return [{name:c.badRole?'service_role':'security_test_evidence_writer'}];
    if(sql.includes('get_dispatch_gateway_identity'))return [{cashfree_order_id:'sandbox-order',expected_amount:1,currency:'INR',...c.binding}];
    if(sql.includes('revoke_refunded_evidence')){revokes++;return [];}
    if(sql.includes('record_verified_payment')){if(c.evidenceDenied)throw Error('denied');records++;return [];}
    if(sql.includes('SET LOCAL ROLE'))return [];
    if(sql.includes('dispatch_verified_cashfree_order')){assert.equal(values[1],id);dispatches++;return [{result:{success:!c.race,status:'shipped'}}];}
    throw Error('Unexpected SQL '+sql);
  };
  db.begin=fn=>fn(db);db.end=async()=>{};
  const env={SUPABASE_URL:'https://qqehtphbpypcmxliaiqd.supabase.co',SUPABASE_PUBLISHABLE_KEYS:'{"default":"public"}',SUPABASE_DB_URL:'db',STEP22_WRITER_DATABASE_URL:'postgresql://security_test_evidence_writer.qqehtphbpypcmxliaiqd:test@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',STEP22_CASHFREE_SANDBOX_APP_ID:'test',STEP22_CASHFREE_SANDBOX_SECRET_KEY:'test',...c.env};
  const ctx={Request,Response,AbortSignal,URL,Number,JSON,postgres:()=>db,Deno:{env:{get:k=>env[k]}},fetch:async(url)=>{
    if(url.endsWith('/auth/v1/user'))return Response.json({id},{status:c.invalidSession?401:200});
    assert.ok(url.startsWith('https://sandbox.cashfree.com/pg/orders/'));
    if(c.outage)return Response.json({}, {status:502});
    if(url.endsWith('/refunds'))return Response.json(c.refunds||[]);
    if(url.endsWith('/payments'))return Response.json(c.payments||[{payment_status:'SUCCESS',payment_amount:1,payment_currency:'INR',cf_payment_id:'123',order_id:'sandbox-order'}]);
    return Response.json({order_id:'sandbox-order',order_status:'PAID',order_currency:'INR',order_amount:1,...c.provider});
  }};
  vm.createContext(ctx);vm.runInContext(source+'\nthis.handler=sandboxDispatch;',ctx);
  const response=await ctx.handler(new Request('https://test.local',{method:'POST',headers:c.noAuth?{}:{authorization:'Bearer test'},body:JSON.stringify(c.body===undefined?{orderId:id,status:'shipped'}:c.body)}));
  return {status:response.status,body:await response.json(),records,dispatches,revokes};
}
(async()=>{
 const cases=[
  ['valid prepaid',{},200],['verify-only',{body:{orderId:id,status:'verify_only'}},200],
  ['missing auth',{noAuth:true},401],['invalid session',{invalidSession:true},401],['inactive admin',{inactive:true},403],['BD admin',{country:'BD'},403],
  ['wrong project',{env:{SUPABASE_URL:'https://production.invalid'}},503],['null body',{body:null},400],['caller evidence rejected',{body:{orderId:id,status:'shipped',verified:true}},400],
  ['wrong status',{body:{orderId:id,status:'paid'}},400],['no order',{noOrder:true},409],['duplicate intent',{duplicate:true},409],['replay',{order:{status:'shipped'}},409],
  ['wrong writer role',{badRole:true},503],['wrong writer project',{env:{STEP22_WRITER_DATABASE_URL:'postgresql://writer:fake@production.invalid:6543/postgres'}},503],
  ['order amount mismatch',{provider:{order_amount:2}},409],['order unpaid',{provider:{order_status:'ACTIVE'}},409],['order identity mismatch',{provider:{order_id:'other'}},409],
  ['fake local paid',{payments:[]},409],['wrong successful payment',{payments:[{payment_status:'SUCCESS',order_id:'other',payment_amount:1,payment_currency:'INR',cf_payment_id:'123'}]},409],
  ['duplicate successful payments',{payments:[{payment_status:'SUCCESS'},{payment_status:'SUCCESS'}]},409],
  ['pending refund',{refunds:[{refund_status:'PENDING'}]},409],['successful refund',{refunds:[{refund_status:'SUCCESS'}]},409],['refund lookup malformed',{refunds:{}},502],
  ['gateway outage',{outage:true},503],['writer evidence denied',{evidenceDenied:true},503],['order changed during verification',{race:true},409],
  ['valid COD advance',{order:{payment_method:'cod',payment_status:'partially_paid',final_amount:4,payment_due_amount:3}},200],['bad COD balance',{order:{payment_method:'cod',payment_status:'partially_paid',final_amount:4,payment_due_amount:5}},409],
  ['prepaid due mismatch',{order:{payment_due_amount:1}},409],['intent amount mismatch',{order:{intent_amount:2}},409],['gateway binding changed',{binding:{cashfree_order_id:'other'}},409]
 ];
 for(const [name,c,status] of cases){const r=await run(c);assert.equal(r.status,status,name);if(status!==200&&!c.race)assert.equal(r.dispatches,0,name);if(c.body?.status==='verify_only')assert.equal(r.dispatches,0,name);if(c.refunds?.length)assert.equal(r.revokes,1,name);console.log('PASS',name);}
 console.log(`${cases.length} Sandbox API scenarios passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
