const assert = require('node:assert/strict');
const { run } = require('./cashfree-dispatch.test.cjs');
(async () => {
 const cases = [
  ['verify success', {body:{status:'verify_only'}},200,'success',0],
  ['dispatch success', {},200,'success',1],
  ['amount rejected', {gateway:{order_amount:2}},409,'blocked',0],
  ['refund rejected', {refunds:[{refund_status:'SUCCESS'}]},409,'blocked',0],
  ['gateway offline', {apiError:true},502,'blocked',0],
  ['unpacked', {order:{status:'pending'}},409,'blocked',0],
  ['no session', {noAuth:true},401,null,0],
  ['wrong admin branch', {country:'BD'},403,null,0],
  ['wrong order branch', {order:{country_code:'BD'}},409,null,0],
  ['audit write failure holds dispatch', {auditError:true},503,null,0],
  ['audit network failure holds dispatch', {auditThrow:true},503,null,0],
  ['failed verification cannot hide audit failure', {auditError:true,gateway:{order_amount:2}},503,null,0],
  ['atomic dispatch audit failure', {rpcError:true},409,'blocked',0],
  ['dispatch race', {race:true},409,'blocked',1],
 ];
 for (const [name,change,status,outcome,writes] of cases) {
  const r=await run(change);assert.equal(r.status,status,name);assert.equal(r.writes,writes,name);
  if(outcome){const a=r.audits.at(-1);assert.equal(a.outcome,outcome,name);assert.equal(a.actor_id,'admin');assert.equal(a.actor_type,'admin');assert.equal(a.country_code,'IN');assert.equal(a.event_type,'verification');assert.equal(a.order_id,'11111111-1111-1111-1111-111111111111');assert.ok(!JSON.stringify(a).includes('x-client-secret'));}
  else assert.equal(r.audits.length,0,name);
  if(r.dispatchArgs){assert.equal(r.dispatchArgs.p_actor_id,'admin');assert.equal(r.dispatchArgs.p_gateway_order_id,'GS-test');assert.equal(r.dispatchArgs.p_total,199);}
  console.log('PASS',name);
 }
 const spoof=await run({body:{actor_id:'attacker',country_code:'BD',status:'verify_only'}});
 assert.equal(spoof.audits[0].actor_id,'admin');assert.equal(spoof.audits[0].country_code,'IN');console.log('PASS client cannot spoof audit actor or branch');
 console.log('All 15 payment audit handler scenarios passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
