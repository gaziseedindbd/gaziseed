import test from 'node:test';
import assert from 'node:assert/strict';
import {IndiaCourierClient,loginIndiaCourier,INDIA_SANDBOX_COURIER_BASE} from '../lib/shiprocket/india-client';
test('Sandbox login and provider calls stay on exact Sandbox host',async()=>{
 const original=globalThis.fetch;const urls:string[]=[];
 globalThis.fetch=async(input)=>{const url=String(input);urls.push(url);return Response.json(url.endsWith('/auth/login')?{token:'synthetic-test-token'}:{data:{}})};
 try{
  const client=await loginIndiaCourier('synthetic@example.invalid','test-only',INDIA_SANDBOX_COURIER_BASE);
  await client.getOrder(1);await client.assignAwb(2,3);
  assert.equal(urls.length,3);assert.ok(urls.every(u=>u.startsWith(INDIA_SANDBOX_COURIER_BASE+'/')));
 }finally{globalThis.fetch=original;}
});
test('untrusted hosts and missing Sandbox credentials fail before network',async()=>{
 assert.throws(()=>new IndiaCourierClient('test','https://untrusted.invalid'));
 await assert.rejects(loginIndiaCourier('','',INDIA_SANDBOX_COURIER_BASE));
 await assert.rejects(loginIndiaCourier('test','test','https://untrusted.invalid'));
});
