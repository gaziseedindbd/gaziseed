import test from 'node:test';
import assert from 'node:assert/strict';
import { bookIndiaShipment, type BookingSnapshot, type BookingPorts } from '../lib/shiprocket/india-orchestrator';
const snapshot: BookingSnapshot = {
 orderId:'order',status:'packed',revision:'1',orderNumber:'IN-TEST',requestKey:'india-test-12345678',pickupLocation:'Primary',
 order:{country_code:'IN',payment_method:'cashfree',payment_status:'paid',final_amount:500,payment_advance_amount:0,payment_due_amount:0},
 parcel:{pickupPostcode:'783124',deliveryPostcode:'110001',weightKg:0.5,lengthCm:12,breadthCm:10,heightCm:5,codAmount:0,declaredValue:500},
 destination:{name:'Test',phone:'9999999999',address:'Test Street',city:'Delhi',state:'Delhi',postcode:'110001'},
 items:[{name:'Seeds',sku:'TEST',quantity:1,price:500}],
};
function fixture(overrides: Partial<BookingPorts> = {}) {
 const calls:string[]=[];let claimed=false;
 const ports:BookingPorts={enabled:true,
 authorizeIndiaAdmin:async()=> 'admin',loadOrder:async()=>structuredClone(snapshot),
 verifyCashfree:async()=>({verified:true,gatewayOrderStatus:'PAID',currency:'INR',paidAmount:500,refundClear:true,completedIntentCount:1}),
 quote:async()=>({data:{available_courier_companies:[{courier_company_id:7,courier_name:'Courier',rate:65,pickup_available:1}]}}),
 reserve:async()=>{calls.push('reserve');return claimed?null:'reservation'},
 claim:async()=>{calls.push('claim');if(claimed)return false;claimed=true;return true},
 createOrder:async()=>{calls.push('create');return {order_id:10,shipment_id:20}},
 recordExternal:async()=>{calls.push('persist-order');return true},
 assignAwb:async()=>{calls.push('awb');return {awb_assign_status:1,response:{data:{shipment_id:20,courier_company_id:7,awb_code:'TEST-AWB'}}}},
 recordAwb:async()=>{calls.push('persist-awb');return true},
 markReconcile:async()=>{calls.push('reconcile')},...overrides};return {ports,calls};
}
test('default-disabled path never calls an adapter',async()=>{const f=fixture({enabled:false});assert.equal((await bookIndiaShipment('order',f.ports)).state,'disabled');assert.deepEqual(f.calls,[])});
test('prepaid creates once, persists before AWB and has no pickup action',async()=>{const f=fixture();assert.equal((await bookIndiaShipment('order',f.ports)).state,'awb_assigned');assert.deepEqual(f.calls,['reserve','claim','create','persist-order','awb','persist-awb']);assert.equal((await bookIndiaShipment('order',f.ports)).state,'duplicate');assert.equal(f.calls.filter(x=>x==='create').length,1)});
test('unauthorized actor, BD and wrong order identity never reserve',async()=>{for(const o of [{authorizeIndiaAdmin:async()=>null},{loadOrder:async()=>({...snapshot,order:{...snapshot.order,country_code:'BD'}})},{loadOrder:async()=>({...snapshot,orderId:'other'})}]){const f=fixture(o);assert.equal((await bookIndiaShipment('order',f.ports)).state,'blocked');assert.deepEqual(f.calls,[])}});
test('unverified payment and partial COD never reach booking',async()=>{for(const o of [{verifyCashfree:async()=>null},{loadOrder:async()=>({...snapshot,order:{...snapshot.order,payment_method:'cod',payment_status:'partially_paid',payment_advance_amount:120,payment_due_amount:380},parcel:{...snapshot.parcel,codAmount:380}})}]){const f=fixture(o);assert.equal((await bookIndiaShipment('order',f.ports)).state,'blocked');assert.deepEqual(f.calls,[])}});
test('changed snapshot after claim requires reconcile without external create',async()=>{let n=0;const f=fixture({loadOrder:async()=>({...snapshot,revision:String(++n)})});assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.deepEqual(f.calls,['reserve','claim','reconcile'])});
test('refund discovered on second verification prevents create',async()=>{let n=0;const f=fixture();const verify=f.ports.verifyCashfree;f.ports.verifyCashfree=async s=>++n===1?verify(s):null;assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.ok(!f.calls.includes('create'))});
test('price change after claim prevents booking',async()=>{const f=fixture();let n=0;f.ports.quote=async()=>({data:{available_courier_companies:[{courier_company_id:7,courier_name:'Courier',rate:++n===1?65:66,pickup_available:1}]}});assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.ok(!f.calls.includes('create'))});
test('timeout and malformed create response cannot retry',async()=>{for(const createOrder of [async()=>{throw Error('timeout')},async()=>({order_id:10}),async()=>({order_id:'10',shipment_id:20})]){const f=fixture({createOrder});assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.ok(!f.calls.includes('awb'));assert.equal((await bookIndiaShipment('order',f.ports)).state,'duplicate')}});
test('failed external persistence never calls AWB',async()=>{const f=fixture({recordExternal:async()=>false});assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.ok(!f.calls.includes('awb'))});
test('AWB response for another shipment or courier is rejected',async()=>{for(const data of [{shipment_id:999,courier_company_id:7,awb_code:'TEST-AWB'},{shipment_id:20,courier_company_id:99,awb_code:'TEST-AWB'}]){const f=fixture({assignAwb:async()=>({awb_assign_status:1,response:{data}})});assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.ok(!f.calls.includes('persist-awb'))}});
test('AWB persistence failure requires reconciliation without recreating order',async()=>{const f=fixture({recordAwb:async()=>false});assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.equal((await bookIndiaShipment('order',f.ports)).state,'duplicate')});
test('failure to mark reconciliation preserves non-retryable durable claim',async()=>{const f=fixture({createOrder:async()=>{throw Error('timeout')},markReconcile:async()=>{throw Error('db down')}});assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.equal((await bookIndiaShipment('order',f.ports)).state,'duplicate')});

test('provider readback mismatch reconciles before AWB',async()=>{const f=fixture({verifyExternalOrder:async()=>false});assert.equal((await bookIndiaShipment('order',f.ports)).state,'reconcile_required');assert.ok(f.calls.includes('persist-order'));assert.ok(!f.calls.includes('awb'))});
