import test from 'node:test';
import assert from 'node:assert/strict';
import {nextOrderStatuses,statusActionValid,STATUS_ACTION_LABELS,ORDER_STATUSES} from '../lib/admin-order-status';
test('normal fulfillment offers only the next operation and stops after return',()=>{
 const flow=['pending','confirmed','processing','packed','shipped','delivered','returned'] as const;
 for(let i=0;i<flow.length-1;i++)assert.ok(nextOrderStatuses(flow[i]).includes(flow[i+1]));
 assert.deepEqual(nextOrderStatuses('returned'),[]);assert.deepEqual(nextOrderStatuses('cancelled'),[]);
 assert.ok(!nextOrderStatuses('pending').includes('delivered'));assert.ok(!nextOrderStatuses('shipped').includes('cancelled'));
});
test('destructive and manual delivery actions need a fresh reason',()=>{
 assert.equal(statusActionValid('pending','cancelled','',true),false);
 assert.equal(statusActionValid('delivered','returned','  ',true),false);
 assert.equal(statusActionValid('shipped','delivered','',true),false);
 assert.equal(statusActionValid('shipped','delivered','buyer confirmed',true),true);
 assert.equal(statusActionValid('pending','cancelled','buyer cancelled',false),true);
});
test('physical fulfillment needs explicit confirmation',()=>{
 for(const [from,to] of [['processing','packed'],['packed','shipped'],['shipped','delivered'],['delivered','returned']] as const){
  assert.equal(statusActionValid(from,to,'checked',false),false);
  assert.equal(statusActionValid(from,to,'checked',true),true);
 }
});
test('unknown/terminal states and oversized notes cannot submit',()=>{
 assert.deepEqual(nextOrderStatuses('unsupported'),[]);
 assert.equal(statusActionValid('returned','confirmed','checked',true),false);
 assert.equal(statusActionValid('pending','confirmed','x'.repeat(2001),true),false);
 assert.equal(statusActionValid('pending','confirmed','',false),true);
 for(const state of ORDER_STATUSES)for(const next of nextOrderStatuses(state))assert.ok(STATUS_ACTION_LABELS[next]);
});
