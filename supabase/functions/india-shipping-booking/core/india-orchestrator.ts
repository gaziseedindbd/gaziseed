import { prepareIndiaShipment } from './india-prepare.ts';
import type { IndiaPaymentOrder, VerifiedGatewayEvidence } from './india-payment-policy.ts';
import type { ShipmentParcel, JsonRecord } from './india-client.ts';
import type { ShippingLine, VerifiedIndiaDestination } from './india-booking.ts';

export type BookingSnapshot = {
  orderId: string; status: string; revision: string;
  order: IndiaPaymentOrder; orderNumber: string; requestKey: string;
  pickupLocation: string; parcel: ShipmentParcel;
  destination: VerifiedIndiaDestination; items: ShippingLine[];
  intent?: {id:string;providerOrderId:string;amount:number};
  invoice?: {itemsSubtotal:number;shipping:number;discount:number};
};
// Server-only ports. No request body may supply a snapshot or gateway evidence.
// The caller must authenticate and load these through trusted backend adapters.
export type BookingPorts = {
  enabled: boolean;
  authorizeIndiaAdmin(): Promise<string | null>;
  loadOrder(orderId: string): Promise<BookingSnapshot | null>;
  verifyCashfree(snapshot: BookingSnapshot): Promise<VerifiedGatewayEvidence | null>;
  quote(snapshot: BookingSnapshot): Promise<unknown>;
  reserve(snapshot: BookingSnapshot, actorId: string): Promise<string | null>;
  claim(reservationId: string, actorId: string): Promise<boolean>;
  createOrder(payload: JsonRecord): Promise<unknown>;
  recordExternal(reservationId: string, orderId: number, shipmentId: number, courierId: number): Promise<boolean>;
  verifyExternalOrder?(orderId:number,shipmentId:number,snapshot:BookingSnapshot):Promise<boolean>;
  assignAwb(shipmentId: number, courierId: number): Promise<unknown>;
  recordAwb(reservationId: string, shipmentId: number, awb: string): Promise<boolean>;
  markReconcile(reservationId: string): Promise<void>;
};
export type BookingResult = { ok: boolean; state: 'disabled'|'blocked'|'duplicate'|'reconcile_required'|'awb_assigned' };
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const record = (v: unknown): v is JsonRecord => !!v && typeof v === 'object' && !Array.isArray(v);
function sameSnapshot(a: BookingSnapshot, b: BookingSnapshot) {
  // Reloaded canonical data, not a client-provided version counter alone.
  return JSON.stringify(a) === JSON.stringify(b);
}
export async function bookIndiaShipment(orderId: string, ports: BookingPorts): Promise<BookingResult> {
  if (!ports.enabled) return {ok:false,state:'disabled'};
  let reservation: string | null = null;
  try {
    const actor = await ports.authorizeIndiaAdmin();
    if (!actor) return {ok:false,state:'blocked'};
    const initial = await ports.loadOrder(orderId);
    if (!initial || initial.orderId !== orderId || initial.status !== 'packed' || initial.order.country_code !== 'IN')
      return {ok:false,state:'blocked'};
    const evidence = await ports.verifyCashfree(initial);
    const quotes = await ports.quote(initial);
    const prepared = prepareIndiaShipment({...initial, sourceOrderNumber:initial.orderNumber,
      immutableRequestKey:initial.requestKey, verifiedGateway:evidence, serviceabilityResponse:quotes, invoice:initial.invoice});
    if (!prepared) return {ok:false,state:'blocked'};
    reservation = await ports.reserve(initial, actor);
    if (!reservation) return {ok:false,state:'duplicate'};
    if (!await ports.claim(reservation, actor)) return {ok:false,state:'duplicate'};
    // Claim is durable before external I/O. Any uncertainty from here requires reconciliation.
    const fresh = await ports.loadOrder(orderId);
    if (!fresh || !sameSnapshot(initial, fresh)) throw Error('snapshot_changed');
    if (await ports.authorizeIndiaAdmin() !== actor) throw Error('actor_changed');
    const freshEvidence = await ports.verifyCashfree(fresh);
    const freshQuotes = await ports.quote(fresh);
    const freshPlan = prepareIndiaShipment({...fresh,sourceOrderNumber:fresh.orderNumber,
      immutableRequestKey:fresh.requestKey,verifiedGateway:freshEvidence,serviceabilityResponse:freshQuotes,invoice:fresh.invoice});
    if (!freshPlan || freshPlan.courierCompanyId !== prepared.courierCompanyId || freshPlan.estimatedCourierCost !== prepared.estimatedCourierCost) throw Error('payment_changed');
    const created = await ports.createOrder(freshPlan.bookingPayload);
    if (!record(created) || !integer(created.order_id) || !integer(created.shipment_id)) throw Error('unknown_create_outcome');
    if (!await ports.recordExternal(reservation,created.order_id,created.shipment_id,freshPlan.courierCompanyId))
      throw Error('external_persistence_failed');
    if(ports.verifyExternalOrder&&!await ports.verifyExternalOrder(created.order_id,created.shipment_id,fresh))throw Error('provider_order_mismatch');
    const assigned = await ports.assignAwb(created.shipment_id,freshPlan.courierCompanyId);
    if (!record(assigned) || assigned.awb_assign_status !== 1 || !record(assigned.response) || !record(assigned.response.data))
      throw Error('unknown_awb_outcome');
    const data = assigned.response.data;
    if (Number(data.shipment_id) !== created.shipment_id || Number(data.courier_company_id) !== freshPlan.courierCompanyId ||
      typeof data.awb_code !== 'string' || !/^[A-Za-z0-9-]{4,64}$/.test(data.awb_code)) throw Error('awb_identity_mismatch');
    if (!await ports.recordAwb(reservation,created.shipment_id,data.awb_code)) throw Error('awb_persistence_failed');
    return {ok:true,state:'awb_assigned'};
  } catch {
    if (reservation) {
      try { await ports.markReconcile(reservation); } catch { /* A durable claim still prevents retry. Alert via adapter. */ }
      return {ok:false,state:'reconcile_required'};
    }
    return {ok:false,state:'blocked'};
  }
}
// No pickup API is part of this orchestrator. AWB success never implies pickup consent.
