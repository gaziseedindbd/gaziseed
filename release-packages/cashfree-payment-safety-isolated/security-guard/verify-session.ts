/** Pure sandbox-only session verification decision. Does not call Cashfree or mutate DB. */
export type StageEvidence={
 registry:{status:string;country_code:string;currency:string;provider_order_id:string;amount:number}|null;
 order:{order_id:string;order_currency:string;order_amount:number;order_status:string;order_expiry_time:string}|null;
 payments:Array<{order_id:string;payment_amount:number;payment_currency:string;payment_status:string}>|null;
 session:{order_id:string;payment_session_id:string;source:string}|null;
 now:number;
};
export function verifySession(e:StageEvidence){
 const stop=(reason:string)=>({allowReady:false,decision:"reconcile_first",reason});
 const r=e.registry,o=e.order;
 if(!r||r.status!=="creating"||r.country_code!=="IN"||r.currency!=="INR"||!r.provider_order_id||!Number.isFinite(r.amount)||r.amount<=0)return stop("registry_invalid");
 if(!o||o.order_id!==r.provider_order_id||o.order_currency!=="INR"||o.order_amount!==r.amount)return stop("order_mismatch");
 if(o.order_status==="PAID")return stop("paid_requires_separate_reconciliation");
 if(o.order_status!=="ACTIVE")return stop("order_not_active");
 if(typeof o.order_expiry_time!=="string"||!Number.isFinite(Date.parse(o.order_expiry_time))||Date.parse(o.order_expiry_time)<=e.now)return stop("expired_or_unknown");
 if(typeof e.session?.payment_session_id!=="string"||!e.session.payment_session_id||e.session.order_id!==r.provider_order_id||e.session.source!=="trusted_provider_response")return stop("session_unverified");
 if(!Array.isArray(e.payments))return stop("payment_attempts_unavailable");
 for(const p of e.payments){
  if(!p||p.order_id!==r.provider_order_id||p.payment_amount!==r.amount||p.payment_currency!=="INR")return stop("attempt_mismatch");
  if(!["FAILED","USER_DROPPED"].includes(p.payment_status))return stop("attempt_ambiguous");
 }
 return {allowReady:true,decision:"verified_session_only",reason:""};
}
