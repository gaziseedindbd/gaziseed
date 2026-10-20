export function validateProvider(order: any, payments: unknown, refunds: unknown, orderId: string, amount: number) {
 const money=(v:unknown)=>v!==null&&v!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v)-amount)<=0.01;
 if(!Array.isArray(payments)||!Array.isArray(refunds))return {error:'Unexpected Cashfree response. Hold dispatch.',status:502};
 if(refunds.some(r=>!r||!['FAILED','CANCELLED'].includes(String(r.refund_status||'').toUpperCase())))
  return {error:'Cashfree refund or refund processing found. Hold dispatch.',status:409,refund:true};
 if(!order||order.order_id!==orderId||order.order_status!=='PAID'||order.order_currency!=='INR'||!money(order.order_amount))
  return {error:'Cashfree did not verify the correct paid amount. Hold dispatch.',status:409};
 const successful=payments.filter(p=>p?.payment_status==='SUCCESS');
 if(successful.length!==1)return {error:'Exactly one successful Cashfree payment is required. Hold dispatch.',status:409};
 const p=successful[0],id=p.cf_payment_id;
 if(p.order_id!==orderId||p.payment_currency!=='INR'||!money(p.payment_amount)||
 !((typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id))||(typeof id==='number'&&Number.isSafeInteger(id)&&id>0)))
  return {error:'Cashfree payment identity or amount mismatch. Hold dispatch.',status:409};
 return {paymentId:String(id)};
}
