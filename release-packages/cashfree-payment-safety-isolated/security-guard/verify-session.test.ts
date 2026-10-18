/** Isolated fixture tests: npx tsx verify-session.test.ts (test branch only). */
import { strict as assert } from "node:assert";
import { verifySession, type StageEvidence } from "./verify-session";
const now=Date.parse("2026-10-18T12:00:00Z");
const base:StageEvidence={
 registry:{status:"creating",country_code:"IN",currency:"INR",provider_order_id:"sandbox-fixture-order",amount:1},
 order:{order_id:"sandbox-fixture-order",order_currency:"INR",order_amount:1,order_status:"ACTIVE",order_expiry_time:"2026-11-01T12:00:00Z"},
 payments:[],session:{order_id:"sandbox-fixture-order",payment_session_id:"fixture-session",source:"trusted_provider_response"},now};
const cases:[string,Partial<StageEvidence>,boolean][]=[
 ["valid active session",{},true],
 ["wrong amount",{order:{...base.order!,order_amount:2}},false],
 ["wrong order id",{order:{...base.order!,order_id:"different"}},false],
 ["wrong currency",{order:{...base.order!,order_currency:"BDT"}},false],
 ["paid order",{order:{...base.order!,order_status:"PAID"}},false],
 ["expired order",{order:{...base.order!,order_expiry_time:"2026-10-17T00:00:00Z"}},false],
 ["missing session",{session:null},false],
 ["untrusted session",{session:{...base.session!,source:"client"}},false],
 ["pending attempt",{payments:[{order_id:"sandbox-fixture-order",payment_amount:1,payment_currency:"INR",payment_status:"PENDING"}]},false],
 ["success attempt",{payments:[{order_id:"sandbox-fixture-order",payment_amount:1,payment_currency:"INR",payment_status:"SUCCESS"}]},false],
 ["unknown attempt",{payments:[{order_id:"sandbox-fixture-order",payment_amount:1,payment_currency:"INR",payment_status:"UNKNOWN"}]},false],
 ["mismatched attempt",{payments:[{order_id:"different",payment_amount:1,payment_currency:"INR",payment_status:"FAILED"}]},false],
 ["provider timeout",{order:null},false],
 ["payments unavailable",{payments:null},false],
 ["registry currency mismatch",{registry:{...base.registry!,currency:"BDT"}},false]
];
for(const [name,overrides,expected] of cases){assert.equal(verifySession({...base,...overrides}).allowReady,expected,name);console.log("PASS",name)}
