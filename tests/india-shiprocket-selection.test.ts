import assert from "node:assert/strict";
import { test } from "node:test";
import { isShipmentEligible, selectCheapestEligibleCourier, type CourierQuote } from "../lib/shiprocket/selection";

const q = (id: number, price: number, extra: Partial<CourierQuote> = {}): CourierQuote => ({
  courier_company_id: id, courier_name: "Test " + id,
  freight_charge: price, cod: true, pickup_available: true, ...extra,
});
test("selects cheapest eligible rate including COD and other charges", () => {
  assert.equal(selectCheapestEligibleCourier([q(1, 40, { cod_charges: 50 }), q(2, 65)], "cod")?.courier.courier_company_id, 2);
});
test("rejects non-COD, blocked, unknown pickup and invalid quotes", () => {
  assert.equal(selectCheapestEligibleCourier([q(1, 1, { cod: false }), q(2, 0, { pickup_available: false }), q(3, -1), q(4, 1, { blocked: true })], "cod"), null);
  assert.equal(selectCheapestEligibleCourier([q(1, NaN), q(2, Infinity)], "prepaid"), null);
});
const allowed = {
  countryCode: "IN", paymentMode: "prepaid" as const, paymentVerifiedServerSide: true,
  amountDueOnDelivery: 0, orderCancelled: false, validPickupAndDeliveryPincodes: true,
  weightVerified: true, alreadyHasShipment: false,
};
test("India-only and fail closed on missing prerequisites", () => {
  assert.equal(isShipmentEligible(allowed), true);
  assert.equal(isShipmentEligible({ ...allowed, countryCode: "BD" }), false);
  assert.equal(isShipmentEligible({ ...allowed, paymentVerifiedServerSide: false }), false);
  assert.equal(isShipmentEligible({ ...allowed, orderCancelled: true }), false);
  assert.equal(isShipmentEligible({ ...allowed, alreadyHasShipment: true }), false);
  assert.equal(isShipmentEligible({ ...allowed, weightVerified: false }), false);
  assert.equal(isShipmentEligible({ ...allowed, validPickupAndDeliveryPincodes: false }), false);
  assert.equal(isShipmentEligible({ ...allowed, amountDueOnDelivery: 20 }), false);
});
test("COD advance eligibility still requires verified payment", () => {
  assert.equal(isShipmentEligible({ ...allowed, paymentMode: "cod", amountDueOnDelivery: 300 }), true);
  assert.equal(isShipmentEligible({ ...allowed, paymentMode: "cod", amountDueOnDelivery: 300, paymentVerifiedServerSide: false }), false);
});

import { validateIndiaParcel } from "../lib/shiprocket/india-client";
test("shipping parcel validates India PIN and dimensions before provider calls", () => {
  const valid = {
    pickupPostcode: "783124", deliveryPostcode: "110001",
    weightKg: 0.5, lengthCm: 15, breadthCm: 10, heightCm: 4,
    codAmount: 0, declaredValue: 250,
  };
  assert.equal(validateIndiaParcel(valid), true);
  assert.equal(validateIndiaParcel({ ...valid, pickupPostcode: "000000" }), false);
  assert.equal(validateIndiaParcel({ ...valid, deliveryPostcode: "123" }), false);
  assert.equal(validateIndiaParcel({ ...valid, weightKg: 0 }), false);
  assert.equal(validateIndiaParcel({ ...valid, lengthCm: -1 }), false);
  assert.equal(validateIndiaParcel({ ...valid, codAmount: -5 }), false);
  assert.equal(validateIndiaParcel({ ...valid, declaredValue: Infinity }), false);
});

import { resolveIndiaShippingMoney } from "../lib/shiprocket/india-payment-policy";
const payment = {
  country_code: "IN", payment_method: "online", payment_status: "paid",
  final_amount: 500, payment_advance_amount: 500, payment_due_amount: 0,
};
const evidence = {
  verified: true as const, gatewayOrderStatus: "PAID" as const, currency: "INR" as const,
  paidAmount: 500, refundClear: true as const, completedIntentCount: 1 as const,
};
test("prepaid collect-on-delivery must be zero after gateway verification", () => {
  assert.deepEqual(resolveIndiaShippingMoney(payment, evidence), {
    mode: "prepaid", total: 500, collectOnDelivery: 0, cashfreePaid: 500,
  });
});
test("partial COD charges ONLY remaining due; refuses unpaid advance", () => {
  const partial = { ...payment, payment_method: "cod", payment_status: "partially_paid",
    payment_advance_amount: 120, payment_due_amount: 380 };
  assert.equal(resolveIndiaShippingMoney(partial, { ...evidence, paidAmount: 120 })?.collectOnDelivery, 380);
  assert.equal(resolveIndiaShippingMoney(partial, null), null);
  assert.equal(resolveIndiaShippingMoney(partial, evidence), null);
  assert.equal(resolveIndiaShippingMoney({ ...partial, payment_due_amount: 500 }, { ...evidence, paidAmount: 120 }), null);
});
test("reject Bangladesh, failed/refunded payments and unauthorized full COD", () => {
  assert.equal(resolveIndiaShippingMoney({ ...payment, country_code: "BD" }, evidence), null);
  assert.equal(resolveIndiaShippingMoney(payment, { ...evidence, refundClear: false }), null);
  assert.equal(resolveIndiaShippingMoney(payment, null), null);
  assert.equal(resolveIndiaShippingMoney({ ...payment, payment_method: "cod",
    payment_status: "pending", payment_advance_amount: 0, payment_due_amount: 500 }, null), null);
});

import { buildIndiaShipmentPayload, findIndiaCourier } from "../lib/shiprocket/india-booking";
test("courier quote normalization rejects missing total and selects valid lowest rate", () => {
  const data = { data: { available_courier_companies: [
    { courier_company_id: 1, courier_name: "A", freight_charge: 50, rate: 90, cod: 1, pickup_available: true },
    { courier_company_id: 2, courier_name: "B", freight_charge: 50, rate: 70, cod: 1, pickup_available: true },
    { courier_company_id: 3, courier_name: "C", freight_charge: 30, cod: 1, pickup_available: true },
  ] } };
  assert.equal(findIndiaCourier(data, {mode:"cod",total:500,collectOnDelivery:380,cashfreePaid:120})?.courier.courier_company_id, 2);
  assert.equal(findIndiaCourier({data:{}}, {mode:"prepaid",total:500,collectOnDelivery:0,cashfreePaid:500}), null);
});
test("payload sends only remaining COD and refuses invalid destination", () => {
  const options = {
    orderNumber:"TEST", pickupLocation:"Primary",
    parcel:{pickupPostcode:"783124",deliveryPostcode:"110001",weightKg:0.5,lengthCm:12,breadthCm:10,heightCm:5,codAmount:380,declaredValue:500},
    money:{mode:"cod" as const,total:500,collectOnDelivery:380,cashfreePaid:120},
    destination:{name:"Customer",phone:"9876543210",address:"Test Street",city:"Delhi",state:"Delhi",postcode:"110001"},
    items:[{name:"Seeds",sku:"TEST-1",quantity:1,price:500}],
    courierCompanyId:2, requestKey:"test-order-key-12345",
  };
  assert.equal(buildIndiaShipmentPayload(options).cod_amount,380);
  assert.throws(()=>buildIndiaShipmentPayload({...options,destination:{...options.destination,postcode:"999999"}}));
  assert.throws(()=>buildIndiaShipmentPayload({...options,parcel:{...options.parcel,codAmount:500}}));
});

test("legacy prepaid with zero advance field still requires gateway paid final", () => {
  const zero = { ...payment, payment_advance_amount: 0 };
  assert.equal(resolveIndiaShippingMoney(zero, evidence)?.collectOnDelivery, 0);
  assert.equal(resolveIndiaShippingMoney(zero, {...evidence, paidAmount:120}), null);
});

import { prepareIndiaShipment } from "../lib/shiprocket/india-prepare";
test("end-to-end pure preparation refuses unverified and selects cheapest eligible India courier", () => {
  const base = {
    order: { ...payment, payment_method: "cod", payment_status:"partially_paid",
      payment_advance_amount:120, payment_due_amount:380 },
    verifiedGateway: {...evidence, paidAmount:120},
    sourceOrderNumber:"IND-EXAMPLE", immutableRequestKey:"india-example-order-12345",
    pickupLocation:"Primary",
    parcel:{pickupPostcode:"783124",deliveryPostcode:"110001",weightKg:0.5,
      lengthCm:12,breadthCm:10,heightCm:5,codAmount:380,declaredValue:500},
    destination:{name:"Customer",phone:"9876543210",address:"Test Street",
      city:"Delhi",state:"Delhi",postcode:"110001"},
    items:[{name:"Seeds",sku:"TEST-1",quantity:1,price:500}],
    serviceabilityResponse:{data:{available_courier_companies:[
      {courier_company_id:7,courier_name:"Expensive",rate:120,cod:1,pickup_available:1},
      {courier_company_id:9,courier_name:"Cheaper",rate:65,cod:1,pickup_available:1},
    ]}},
  };
  const ready = prepareIndiaShipment(base);
  assert.equal(ready?.courierCompanyId,9);
  assert.equal(ready?.bookingPayload.cod_amount,380);
  assert.equal(prepareIndiaShipment({...base,verifiedGateway:null}),null);
  assert.equal(prepareIndiaShipment({...base,order:{...base.order,country_code:"BD"}}),null);
  assert.equal(prepareIndiaShipment({...base,parcel:{...base.parcel,codAmount:500}}),null);
});
