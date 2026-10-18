/**
 * GAZI SEED isolated India sandbox: trusted CREATE-response provenance policy.
 * No credentials, no provider calls, no database writes in this module.
 * Evidence must be passed directly from the same trusted server invocation;
 * NEVER accept it from request JSON, database session_response, or webhook.
 */
export type BoundCheckout={checkoutKey:string;intentId:string;orderId:string;amount:number;currency:"INR";country:"IN";fingerprint:string};
export type CashfreeCreate={order_id?:unknown;order_amount?:unknown;order_currency?:unknown;payment_session_id?:unknown;order_status?:unknown};
export type CashfreeReadback={order_id?:unknown;order_amount?:unknown;order_currency?:unknown;order_status?:unknown;order_expiry_time?:unknown};
export type CashfreeAttempt={order_id?:unknown;payment_amount?:unknown;payment_currency?:unknown;payment_status?:unknown};
export type ProvenanceResult={allowReady:boolean;reason:string;sessionId?:string};
export function validateCreateEvidence(
 checkout:BoundCheckout,create:CashfreeCreate|null,readback:CashfreeReadback|null,
 attempts:CashfreeAttempt[]|null,now:number
):ProvenanceResult {
 const block=(reason:string):ProvenanceResult=>({allowReady:false,reason});
 if(!checkout||checkout.country!=="IN"||checkout.currency!=="INR"||
  !Number.isFinite(checkout.amount)||checkout.amount<=0||
  !/^[a-f0-9]{64}$/.test(checkout.fingerprint)||
  !checkout.checkoutKey||!checkout.intentId||!checkout.orderId)return block("checkout_invalid");
 if(!create||create.order_id!==checkout.orderId||create.order_currency!=="INR"||
  create.order_amount!==checkout.amount||typeof create.payment_session_id!=="string"||
  !create.payment_session_id.trim())return block("untrusted_create_response");
 if(!readback||readback.order_id!==checkout.orderId||readback.order_currency!=="INR"||
  readback.order_amount!==checkout.amount)return block("provider_readback_mismatch");
 if(readback.order_status==="PAID")return block("paid_requires_separate_reconciliation");
 if(readback.order_status!=="ACTIVE"||!Number.isFinite(now)||
  typeof readback.order_expiry_time!=="string"||
  !Number.isFinite(Date.parse(readback.order_expiry_time))||
  Date.parse(readback.order_expiry_time)<=now)return block("inactive_or_expired");
 if(!Array.isArray(attempts))return block("payment_attempts_unavailable");
 for(const attempt of attempts){
  if(!attempt||attempt.order_id!==checkout.orderId||
    attempt.payment_amount!==checkout.amount||attempt.payment_currency!=="INR"||
    !["FAILED","USER_DROPPED"].includes(String(attempt.payment_status)))
    return block("payment_attempt_conflict");
 }
 return {allowReady:true,reason:"verified_trusted_create",sessionId:create.payment_session_id};
}
/* Caller requirements:
 * 1) claim registry atomically before CREATE; stable checkout/order/idempotency key.
 * 2) preserve CREATE response only in local function memory; do not accept caller-supplied evidence.
 * 3) GET order + GET payments independently and validate through this policy.
 * 4) invoke a narrowly privileged atomic writer tied to the same checkout/intent/order.
 * 5) fail closed on timeout/404/5xx/malformed response; never CREATE again on ambiguous outcome.
 * 6) do not treat session-ready as PAID; dispatch uses fresh paid reconciliation.
 */
