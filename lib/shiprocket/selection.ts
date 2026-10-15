/**
 * Shiprocket courier selection, kept independent of shipment/order writes.
 * No Shiprocket API keys, bookings, or pickup requests are used here.
 */
export type CourierQuote = {
  courier_company_id: number;
  courier_name: string;
  freight_charge: number;
  cod_charges?: number;
  other_charges?: number;
  rate?: number;
  estimated_delivery_days?: number | string;
  cod?: boolean | number;
  pickup_available?: boolean;
  blocked?: boolean;
};

export type CourierSelection = {
  courier: CourierQuote;
  estimatedCost: number;
};

const finiteNonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Fail closed: only eligible, correctly priced couriers may be selected.
 * Pass pickup/serviceability-filtered results from Shiprocket; no fallback
 * to couriers outside the returned list or with unknown eligibility.
 * Uses the total of freight + COD and additional charges when available.
 */
export function selectCheapestEligibleCourier(
  quotes: CourierQuote[],
  paymentMode: 'prepaid' | 'cod',
): CourierSelection | null {
  const eligible = quotes.flatMap((courier) => {
    if (!Number.isSafeInteger(courier.courier_company_id) || courier.courier_company_id <= 0) return [];
    if (!courier.courier_name || courier.blocked || courier.pickup_available !== true) return [];
    if (paymentMode === 'cod' && courier.cod !== true && courier.cod !== 1) return [];
    if (!finiteNonnegative(courier.freight_charge)) return [];
    if (courier.cod_charges != null && !finiteNonnegative(courier.cod_charges)) return [];
    if (courier.other_charges != null && !finiteNonnegative(courier.other_charges)) return [];
    const estimatedCost = courier.freight_charge + (courier.cod_charges ?? 0) + (courier.other_charges ?? 0);
    if (!Number.isFinite(estimatedCost)) return [];
    return [{ courier, estimatedCost }];
  });
  eligible.sort((a, b) => a.estimatedCost - b.estimatedCost ||
    a.courier.courier_company_id - b.courier.courier_company_id);
  return eligible[0] ?? null;
}

/**
 * The shipping orchestrator must independently verify Cashfree with server
 * credentials before calling Shiprocket. This is only a second fail-closed
 * state guard; never rely on client-supplied verification flags.
 */
export function isShipmentEligible(input: {
  countryCode: string;
  paymentMode: 'prepaid' | 'cod';
  paymentVerifiedServerSide: boolean;
  amountDueOnDelivery: number;
  orderCancelled: boolean;
  validPickupAndDeliveryPincodes: boolean;
  weightVerified: boolean;
  alreadyHasShipment: boolean;
}): boolean {
  return input.countryCode === 'IN'
    && input.paymentVerifiedServerSide === true
    && input.orderCancelled === false
    && input.validPickupAndDeliveryPincodes === true
    && input.weightVerified === true
    && input.alreadyHasShipment === false
    && finiteNonnegative(input.amountDueOnDelivery)
    && (input.paymentMode !== 'prepaid' || input.amountDueOnDelivery === 0);
}
