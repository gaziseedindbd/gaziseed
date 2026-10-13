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
