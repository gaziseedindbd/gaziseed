import { selectCheapestEligibleCourier, type CourierQuote, type CourierSelection } from "./selection";
import { validateIndiaParcel, type ShipmentParcel } from "./india-client";
import type { ShippingMoney } from "./india-payment-policy";

/** Shiprocket serviceability API payload is untrusted until normalized. */
type RecordValue = Record<string, unknown>;
function record(v: unknown): v is RecordValue {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function numeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}
export function normalizeIndiaCourierQuotes(response: unknown): CourierQuote[] {
  if (!record(response) || !record(response.data) || !Array.isArray(response.data.available_courier_companies))
    return [];
  return response.data.available_courier_companies.flatMap((raw: unknown) => {
    if (!record(raw)) return [];
    const id = numeric(raw.courier_company_id);
    const freight = numeric(raw.freight_charge);
    // Shiprocket commonly provides a complete quoted rate. If no complete
    // breakdown exists, use 'rate' as total, never add it to freight again.
    const rate = numeric(raw.rate);
    if (id === null || !Number.isSafeInteger(id) || id < 1 ||
        typeof raw.courier_name !== "string" || !raw.courier_name ||
        (freight === null && rate === null)) return [];
    const chargesKnown = numeric(raw.cod_charges) !== null && numeric(raw.other_charges) !== null;
    const total = rate !== null ? rate : chargesKnown
      ? (freight ?? 0) + (numeric(raw.cod_charges) ?? 0) + (numeric(raw.other_charges) ?? 0) : null;
    if (total === null || total < 0) return [];
    const courier: CourierQuote = {
      courier_company_id: id,
      courier_name: raw.courier_name,
      freight_charge: total,
      cod_charges: 0,
      other_charges: 0,
      cod: raw.cod === 1 || raw.cod === true || raw.cod === "1",
      pickup_available: raw.pickup_available === true || raw.pickup_available === 1 ||
        raw.pickup_available === "1",
      blocked: raw.blocked === true,
    };
    return [courier];
  });
}
export function findIndiaCourier(response: unknown, money: ShippingMoney): CourierSelection | null {
  return selectCheapestEligibleCourier(normalizeIndiaCourierQuotes(response), money.mode);
}
export type VerifiedIndiaDestination = {
  name: string; phone: string; email?: string;
  address: string; city: string; state: string; postcode: string;
};
export type ShippingLine = { name: string; sku: string; quantity: number; price: number };
export function buildIndiaShipmentPayload(input: {
  orderNumber: string;
  pickupLocation: string;
  parcel: ShipmentParcel;
  money: ShippingMoney;
  destination: VerifiedIndiaDestination;
  items: ShippingLine[];
  courierCompanyId: number;
  requestKey: string;
}): RecordValue {
  const { parcel, destination: d, money: m, items } = input;
  if (!validateIndiaParcel(parcel) || d.postcode !== parcel.deliveryPostcode ||
      !/^[A-Za-z][A-Za-z\s-]{1,80}$/.test(d.state.trim()) ||
      !d.city.trim() || !d.address.trim() || !d.name.trim() ||
      !/^\+?[0-9\s-]{10,16}$/.test(d.phone) ||
      !input.pickupLocation.trim() || !input.orderNumber.trim() ||
      !Number.isSafeInteger(input.courierCompanyId) || input.courierCompanyId <= 0 ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(input.requestKey) ||
      m.total !== parcel.declaredValue || m.collectOnDelivery !== parcel.codAmount ||
      !items.length || items.some(i => !i.name || !i.sku || !Number.isSafeInteger(i.quantity) ||
        i.quantity <= 0 || !Number.isFinite(i.price) || i.price <= 0))
    throw new Error("India shipping booking prerequisites not satisfied");
  return {
    order_id: input.requestKey, order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
    pickup_location: input.pickupLocation,
    billing_customer_name: d.name, billing_last_name: "",
    billing_address: d.address, billing_city: d.city, billing_state: d.state,
    billing_pincode: d.postcode, billing_country: "India", billing_email: d.email || "",
    billing_phone: d.phone,
    shipping_is_billing: true,
    order_items: items.map(i => ({
      name: i.name, sku: i.sku, units: i.quantity, selling_price: i.price,
    })),
    payment_method: m.mode === "prepaid" ? "Prepaid" : "COD",
    sub_total: m.total,
    // Shiprocket COD collection must equal remaining due, not full order total.
    cod_amount: m.collectOnDelivery,
    length: parcel.lengthCm, breadth: parcel.breadthCm,
    height: parcel.heightCm, weight: parcel.weightKg,
    courier_id: input.courierCompanyId,
  };
}
