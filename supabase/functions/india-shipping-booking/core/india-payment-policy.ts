/** Pure money-safety policy for India shipping. Values must come from
 * server-queried orders/intents + independently verified Cashfree API data.
 * This function never calls payment gateways and never trusts client flags.
 */
export type IndiaPaymentOrder = {
  country_code: string;
  payment_method: string | null;
  payment_status: string | null;
  final_amount: number;
  payment_advance_amount: number | null;
  payment_due_amount: number | null;
};
export type VerifiedGatewayEvidence = {
  verified: boolean;
  gatewayOrderStatus: string;
  currency: string;
  paidAmount: number;
  refundClear: boolean;
  completedIntentCount: number;
};
export type ShippingMoney = {
  mode: "prepaid" | "cod";
  total: number;
  collectOnDelivery: number;
  cashfreePaid: number;
};
const paise = (n: number) => Number.isFinite(n) && n >= 0 && Math.abs(Math.round(n * 100) - n * 100) < 0.000001;
const same = (a: number, b: number) => Math.abs(a - b) < 0.005;
export function resolveIndiaShippingMoney(
  order: IndiaPaymentOrder,
  gateway: VerifiedGatewayEvidence | null,
): ShippingMoney | null {
  if (order.country_code !== "IN" || !paise(order.final_amount) || order.final_amount <= 0) return null;
  const advance = Number(order.payment_advance_amount ?? 0);
  const due = Number(order.payment_due_amount ?? 0);
  if (!paise(advance) || !paise(due)) return null;
  const method = String(order.payment_method ?? "").toLowerCase();
  const status = String(order.payment_status ?? "").toLowerCase();
  const paidEvidence = gateway?.verified === true && gateway.gatewayOrderStatus === "PAID" &&
    gateway.currency === "INR" && gateway.refundClear === true && gateway.completedIntentCount === 1;
  if (due === 0) {
    // Existing prepaid orders may leave the advance column at zero.
    if (!same(advance, 0) && !same(advance, order.final_amount)) return null;
    if (!paidEvidence || !same(gateway.paidAmount, order.final_amount) ||
        !["paid", "completed", "success"].includes(status) ||
        !["online", "cashfree", "prepaid", "upi", "card"].includes(method))
      return null;
    return { mode: "prepaid", total: order.final_amount, collectOnDelivery: 0, cashfreePaid: order.final_amount };
  }
  if (!same(advance + due, order.final_amount)) return null;
  if (advance > 0) {
    if (!paidEvidence || !same(gateway.paidAmount, advance) ||
        !["cod", "cash_on_delivery"].includes(method) ||
        !["partially_paid", "partial_paid"].includes(status)) return null;
    return { mode: "cod", total: order.final_amount, collectOnDelivery: due, cashfreePaid: advance };
  }
  // Unpaid full COD requires separate admin-authorized order verification.
  return null;
}
