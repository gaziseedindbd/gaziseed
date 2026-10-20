import type {BookingSnapshot} from './india-orchestrator.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const number=(v:unknown):number|null=>((typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v)))?Number(v):null;
const same=(v:unknown,n:number)=>{const x=number(v);return x!==null&&Math.abs(x-n)<0.01};
/** Validated against Shiprocket Sandbox order details, including its single-shipment object shape. */
export function verifyIndiaPrepaidReadback(result:unknown,orderId:number,shipmentId:number,s:BookingSnapshot):boolean{
 if(!object(result)||!object(result.data)||!s.invoice)return false;
 const d=result.data;
 if(number(d.id)!==orderId||d.channel_order_id!==s.requestKey||d.currency!=='INR'||String(d.payment_method).toLowerCase()!=='prepaid'||number(d.cod)!==0||!same(d.total,Number(s.order.final_amount))||!same(d.discount,s.invoice.discount)||!object(d.others)||!same(d.others.shipping_charges,s.invoice.shipping))return false;
 const shipments=Array.isArray(d.shipments)?d.shipments:[d.shipments];
 if(shipments.length!==1||!object(shipments[0])||number(shipments[0].id)!==shipmentId||number(shipments[0].order_id)!==orderId)return false;
 if(!Array.isArray(d.products)||d.products.length!==s.items.length)return false;
 const actual:string[]=[];
 for(const p of d.products){
  if(!object(p)||typeof p.sku!=='string'||!Number.isSafeInteger(number(p.quantity))||Number(p.quantity)<=0||number(p.selling_price)===null||Number(p.selling_price)<0)return false;
  actual.push(JSON.stringify([p.sku,Number(p.quantity),Number(p.selling_price)]));
 }
 const expected=s.items.map(p=>JSON.stringify([p.sku,p.quantity,p.price]));
 return JSON.stringify(actual.sort())===JSON.stringify(expected.sort());
}
