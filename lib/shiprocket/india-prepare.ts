import { resolveIndiaShippingMoney, type IndiaPaymentOrder, type VerifiedGatewayEvidence } from "./india-payment-policy";
import { findIndiaCourier, buildIndiaShipmentPayload, type ShippingLine, type VerifiedIndiaDestination } from "./india-booking";
import type { ShipmentParcel, JsonRecord } from "./india-client";

export type IndiaShipmentPreparation = {
  courierCompanyId: number;
  estimatedCourierCost: number;
  collectOnDelivery: number;
  bookingPayload: JsonRecord;
};
/** Server-only orchestration step; no mutations or provider booking.
 * Gateway evidence MUST originate from Cashfree API verification, including refund check.
 * Destination/items MUST originate from independently reviewed authoritative order data.
 */
export function prepareIndiaShipment(input: {
  order: IndiaPaymentOrder;
  verifiedGateway: VerifiedGatewayEvidence | null;
  sourceOrderNumber: string;
  immutableRequestKey: string;
  pickupLocation: string;
  parcel: ShipmentParcel;
  destination: VerifiedIndiaDestination;
  items: ShippingLine[];
  serviceabilityResponse: unknown;
  invoice?: {itemsSubtotal:number;shipping:number;discount:number};
}): IndiaShipmentPreparation | null {
  const money = resolveIndiaShippingMoney(input.order, input.verifiedGateway);
  if (!money || input.parcel.codAmount !== money.collectOnDelivery ||
      input.parcel.declaredValue !== money.total) return null;
  const courier = findIndiaCourier(input.serviceabilityResponse, money);
  if (!courier) return null;
  try {
    const bookingPayload = buildIndiaShipmentPayload({
      orderNumber: input.sourceOrderNumber,
      requestKey: input.immutableRequestKey,
      pickupLocation: input.pickupLocation,
      parcel: input.parcel,
      money,
      destination: input.destination,
      items: input.items,
      courierCompanyId: courier.courier.courier_company_id,
      invoice:input.invoice,
    });
    return {
      courierCompanyId: courier.courier.courier_company_id,
      estimatedCourierCost: courier.estimatedCost,
      collectOnDelivery: money.collectOnDelivery,
      bookingPayload,
    };
  } catch { return null; }
}
