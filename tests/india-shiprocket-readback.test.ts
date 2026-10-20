import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyIndiaPrepaidReadback} from '../lib/shiprocket/india-provider-readback';
import type {BookingSnapshot} from '../lib/shiprocket/india-orchestrator';
const snapshot={requestKey:'GSBXP20261020194501',order:{final_amount:580},invoice:{itemsSubtotal:500,shipping:100,discount:20},items:[{sku:'SBX-SEEDS-1',quantity:1,price:500}]} as BookingSnapshot;
const data={id:353206429,channel_order_id:snapshot.requestKey,currency:'INR',payment_method:'prepaid',cod:0,total:580,discount:20,others:{shipping_charges:100},shipments:{id:352582290,order_id:353206429},products:[{sku:'SBX-SEEDS-1',quantity:1,selling_price:500}]};
const verify=(d:unknown)=>verifyIndiaPrepaidReadback({data:d},353206429,352582290,snapshot);
test('actual Sandbox invoice and single-shipment object pass; equivalent array supported',()=>{
 assert.equal(verify(data),true);assert.equal(verify({...data,shipments:[data.shipments]}),true);
});
test('provider order, invoice, currency, payment, shipment and line mismatches block AWB',()=>{
 for(const change of [{id:1},{channel_order_id:'OTHER'},{currency:'USD'},{payment_method:'cod'},{cod:1},{total:500},{total:null},{discount:0},{others:{shipping_charges:0}},{shipments:{id:1,order_id:353206429}},{shipments:{id:352582290,order_id:1}},{shipments:[data.shipments,data.shipments]},{products:[{sku:'OTHER',quantity:1,selling_price:500}]},{products:[{sku:'SBX-SEEDS-1',quantity:2,selling_price:250}]}])assert.equal(verify({...data,...change}),false,JSON.stringify(change));
});
