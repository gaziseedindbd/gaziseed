/** Server-only Shiprocket transport. Never import into browser components.
 * No pickup-request API is exposed here: packing approval is a separate workflow.
 */
const BASE = "https://apiv2.shiprocket.in/v1/external";
export type ShipmentParcel = {
  pickupPostcode: string; deliveryPostcode: string;
  weightKg: number; lengthCm: number; breadthCm: number; heightCm: number;
  codAmount: number; declaredValue: number;
};
const positive = (v: number) => Number.isFinite(v) && v > 0;
const pin = (v: string) => /^[1-9][0-9]{5}$/.test(v);
export function validateIndiaParcel(p: ShipmentParcel): boolean {
  return pin(p.pickupPostcode) && pin(p.deliveryPostcode) &&
    positive(p.weightKg) && p.weightKg >= 0.01 && p.weightKg <= 100 &&
    positive(p.lengthCm) && p.lengthCm >= 1 && p.lengthCm <= 200 &&
    positive(p.breadthCm) && p.breadthCm >= 1 && p.breadthCm <= 200 &&
    positive(p.heightCm) && p.heightCm >= 1 && p.heightCm <= 200 && Number.isFinite(p.codAmount) && p.codAmount >= 0 &&
    Number.isFinite(p.declaredValue) && p.declaredValue > 0;
}
export type JsonRecord = Record<string, unknown>;
async function jsonResponse(res: Response): Promise<JsonRecord> {
  if (!res.ok) throw new Error("Shipping provider rejected request: " + res.status);
  const body: unknown = await res.json();
  if (body === null || typeof body !== "object" || Array.isArray(body))
    throw new Error("Unexpected shipping provider response");
  return body as JsonRecord;
}
export class IndiaCourierClient {
  constructor(private readonly token: string) {
    if (!token) throw new Error("Missing shipping API authentication");
  }
  private async request(path: string, method: "GET" | "POST", body?: JsonRecord) {
    const res = await fetch(BASE + path, {
      method,
      headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    return jsonResponse(res);
  }
  async serviceability(parcel: ShipmentParcel) {
    if (!validateIndiaParcel(parcel)) throw new Error("Invalid India parcel data");
    const p = new URLSearchParams({
      pickup_postcode: parcel.pickupPostcode,
      delivery_postcode: parcel.deliveryPostcode,
      cod: parcel.codAmount > 0 ? "1" : "0",
      weight: String(parcel.weightKg),
      length: String(parcel.lengthCm),
      breadth: String(parcel.breadthCm),
      height: String(parcel.heightCm),
      declared_value: String(parcel.declaredValue),
      is_return: "0",
    });
    return this.request("/courier/serviceability/?" + p.toString(), "GET");
  }
  async createOrder(verifiedOrderPayload: JsonRecord) {
    // Only a server-side orchestrator may call this after payment validation,
    // India branch checking and an atomic shipment reservation.
    if (verifiedOrderPayload.payment_method !== 'Prepaid' || 'cod_amount' in verifiedOrderPayload)
      throw new Error('COD booking provider contract is not enabled');
    return this.request("/orders/create/adhoc", "POST", verifiedOrderPayload);
  }
  async assignAwb(shipmentId: number, courierId: number) {
    if (!Number.isSafeInteger(shipmentId) || shipmentId <= 0 ||
        !Number.isSafeInteger(courierId) || courierId <= 0)
      throw new Error("Invalid shipment or courier identifier");
    return this.request("/courier/assign/awb", "POST", {
      shipment_id: shipmentId, courier_id: courierId,
    });
  }
}
export async function loginIndiaCourier(email: string, password: string) {
  if (!email || !password) throw new Error("Missing shipping API credentials");
  const res = await fetch(BASE + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  const result = await jsonResponse(res);
  if (typeof result.token !== "string" || !result.token) throw new Error("Missing shipping auth token");
  return new IndiaCourierClient(result.token);
}
