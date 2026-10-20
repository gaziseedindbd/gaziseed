import test from 'node:test';
import assert from 'node:assert/strict';
import {createIndiaBookingApi} from '../lib/shiprocket/india-server-api';
const orderId='92000000-0000-4000-8000-000000000001';
const context={orderId,status:'packed',orderNumber:'SBX-API',requestKey:'GS123456789012345678',
 order:{country_code:'IN',payment_method:'cashfree',payment_status:'paid',final_amount:500,payment_advance_amount:0,payment_due_amount:0},
 parcel:{deliveryPostcode:'110001',weightKg:0.5,lengthCm:12,breadthCm:10,heightCm:5,codAmount:0,declaredValue:500},
 destination:{name:'Synthetic',phone:'9999999999',email:'test@example.invalid',address:'Synthetic test street',city:'Delhi',state:'Delhi',postcode:'110001'},
 items:[{name:'Seeds',sku:'TEST',quantity:1,price:400}],invoice:{itemsSubtotal:400,shipping:100,discount:0},
 intent:{id:'intent',providerOrderId:'SBX-GATEWAY',amount:500}};
function fixture(options:{auth?:boolean;env?:Record<string,string>;context?:any;gateway?:any;payments?:any;refunds?:any;failRpc?:string;changeAfterClaim?:boolean}={}){
 const calls:string[]=[];let state='none';let ids:any=null,awb='';
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{
 calls.push(name);if(name===options.failRpc)return {data:null,error:{message:'DO NOT LEAK internal credentials'}};
 if(name==='get_india_shipping_booking_context')return {data:options.changeAfterClaim&&state==='submitting'?{...context,status:'cancelled'}:structuredClone(options.context??context),error:null};
 let data:any=null;
 if(name==='confirm_india_shipping_destination')data=null;
 if(name==='reserve_india_shipping_booking'){data=state==='none'?'reservation':null;if(data)state='reserved'}
 if(name==='claim_india_shipping_booking'){data=state==='reserved';if(data)state='submitting'}
 if(name==='record_india_shipping_external_order'){data=state==='submitting';if(data){state='external_created';ids=args}}
 if(name==='record_india_shipping_awb'){data=state==='external_created';if(data){state='awb_assigned';awb=String(args.p_awb)}}
 if(name==='reconcile_india_shipping_booking')state='reconcile_required';
 return {data,error:null};
 }};
 const env={SUPABASE_URL:'https://qqehtphbpypcmxliaiqd.supabase.co',INDIA_SHIPPING_BOOKING_MODE:'sandbox_simulated',SHIPROCKET_PICKUP_POSTCODE:'783124',SHIPROCKET_PICKUP_LOCATION:'SANDBOX-ONLY',STEP22_CASHFREE_SANDBOX_APP_ID:'fixture-id',STEP22_CASHFREE_SANDBOX_SECRET_KEY:'fixture-secret',...options.env};
 const network:string[]=[];
 const handler=createIndiaBookingApi({db,env,authenticate:async()=>options.auth===false?null:'actor',fetch:async input=>{
 const url=String(input);network.push(url);assert.ok(url.startsWith('https://sandbox.cashfree.com/pg/orders/SBX-GATEWAY'));
 const value=url.endsWith('/payments')?(options.payments??[{order_id:'SBX-GATEWAY',payment_status:'SUCCESS',payment_currency:'INR',payment_amount:500,cf_payment_id:'SBX-PAY'}]):url.endsWith('/refunds')?(options.refunds??[]):(options.gateway??{order_id:'SBX-GATEWAY',order_status:'PAID',order_currency:'INR',order_amount:500});
 return Response.json(value);
 }});
 const request=async(action:string,extra:object={})=>{const r=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({action,orderId,...extra})}));return {status:r.status,body:await r.json()}};
 return {handler,request,calls,network,state:()=>state,ids:()=>ids,awb:()=>awb};
}
test('HTTP preview verifies real adapter path without reservations',async()=>{const f=fixture();const r=await f.request('preview');assert.equal(r.status,200);assert.equal(r.body.collectOnDelivery,0);assert.equal(r.body.test_only,true);assert.equal(f.network.length,3);assert.ok(!f.calls.includes('reserve_india_shipping_booking'))});
test('HTTP simulated booking stores external IDs and AWB once; never pickup',async()=>{const f=fixture();const r=await f.request('book');assert.equal(r.status,200);assert.equal(r.body.live_shipment_created,false);assert.equal(f.state(),'awb_assigned');assert.ok(f.awb().startsWith('SBX-'));assert.ok(f.ids());assert.equal((await f.request('book')).body.state,'duplicate');assert.equal(f.calls.filter(x=>x==='record_india_shipping_external_order').length,1);assert.ok(!f.calls.some(x=>x.includes('pickup')))});
test('unauthorized HTTP requests stop before database and provider',async()=>{const f=fixture({auth:false});assert.equal((await f.request('book')).status,403);assert.deepEqual(f.calls,[]);assert.deepEqual(f.network,[])});
test('caller evidence, actor and financial flags are rejected',async()=>{for(const extra of [{verified:true},{actorId:'forged'},{amount:1},{snapshot:context}]){const f=fixture();assert.equal((await f.request('book',extra)).status,400);assert.deepEqual(f.calls,[])}});
test('unknown project and production mode cannot enable simulation/live booking',async()=>{for(const SUPABASE_URL of ['https://other.supabase.co','https://ufxsthshyebahkwbmioe.supabase.co']){const f=fixture({env:{SUPABASE_URL}});assert.equal((await f.request('book')).status,503);assert.deepEqual(f.calls,[]);assert.deepEqual(f.network,[])}});
test('missing pickup configuration holds booking',async()=>{const f=fixture({env:{SHIPROCKET_PICKUP_POSTCODE:''}});assert.equal((await f.request('book')).status,409);assert.ok(!f.calls.includes('reserve_india_shipping_booking'))});
test('invoice mismatch prevents reservation',async()=>{const f=fixture({context:{...context,invoice:{...context.invoice,shipping:99}}});assert.equal((await f.request('book')).status,409);assert.ok(!f.calls.includes('reserve_india_shipping_booking'))});
test('gateway wrong ID, currency, amount or nonfinite amount holds booking',async()=>{for(const gateway of [{order_id:'OTHER'},{order_currency:'USD'},{order_amount:501},{order_amount:'not-a-number'}]){const f=fixture({gateway:{order_id:'SBX-GATEWAY',order_status:'PAID',order_currency:'INR',order_amount:500,...gateway}});assert.equal((await f.request('book')).status,409);assert.ok(!f.calls.includes('reserve_india_shipping_booking'))}});
test('pending refunds and missing successful payments are rejected',async()=>{for(const options of [{refunds:[{refund_status:'PENDING'}]},{payments:[]},{payments:[{payment_status:'SUCCESS',cf_payment_id:{fake:true}}]}]){const f=fixture(options);assert.equal((await f.request('book')).status,409);assert.ok(!f.calls.includes('reserve_india_shipping_booking'))}});
test('database context recheck failure does not disclose internal errors',async()=>{const f=fixture({failRpc:'get_india_shipping_booking_context'});const r=await f.request('book');assert.equal(r.status,503);assert.equal(JSON.stringify(r.body).includes('credentials'),false)});
test('changed canonical snapshot after claim reconciles without AWB',async()=>{const f=fixture({changeAfterClaim:true});assert.equal((await f.request('book')).body.state,'reconcile_required');assert.equal(f.state(),'reconcile_required');assert.equal(f.ids(),null)});
test('provider ID persistence failure reconciles',async()=>{const f=fixture({failRpc:'record_india_shipping_external_order'});assert.equal((await f.request('book')).body.state,'reconcile_required');assert.equal(f.awb(),'')});
test('destination confirmation accepts only reviewed address fields',async()=>{const f=fixture();assert.equal((await f.request('confirm_destination',{city:'Delhi',state:'Delhi',postcode:'110001'})).status,200);assert.deepEqual(f.calls,['confirm_india_shipping_destination']);assert.deepEqual(f.network,[])});
test('CORS preflight requires no credentials and HTTP GET is rejected',async()=>{const f=fixture({auth:false});assert.equal((await f.handler(new Request('https://example.invalid',{method:'OPTIONS'}))).status,204);assert.equal((await f.handler(new Request('https://example.invalid'))).status,405);assert.deepEqual(f.calls,[])});
