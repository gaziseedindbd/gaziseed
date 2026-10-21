export type CustomerKind = 'registered' | 'guest' | 'order_only';
export type CustomerTypeFilter = 'all' | CustomerKind;

export type OrderSummary = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  user_id: string | null;
  status: string | null;
  grand_total: number | string | null;
  created_at: string;
};

export type CustomerRow = {
  key: string;
  user_id: string | null;
  name: string;
  phone: string;
  email: string;
  orders: OrderSummary[];
  totalSpend: number;
  latestOrderAt: string;
  type: CustomerKind;
};

const isCancelled = (status: string | null) => ['cancelled', 'canceled'].includes((status || '').toLowerCase());
const numberOrZero = (value: number | string | null | undefined) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

/**
 * Build customer rows from branch-filtered order snapshots.
 * IDs belonging to staff/admin accounts are deliberately represented as
 * order-only records so an order cannot expose an internal Auth profile.
 */
export function aggregateCustomers(orders: OrderSummary[], adminUserIds: ReadonlySet<string> = new Set()): CustomerRow[] {
  const groups = new Map<string, CustomerRow>();
  for (const order of orders) {
    const internalAccount = Boolean(order.user_id && adminUserIds.has(order.user_id));
    const registered = Boolean(order.user_id) && !internalAccount;
    const phone = (order.customer_phone || '').trim();
    const key = registered
      ? `registered:${order.user_id}`
      : internalAccount
        ? `order-only:${order.id}`
        : phone
          ? `guest:${phone.replace(/\s+/g, '')}`
          : `guest-order:${order.id}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        key,
        user_id: registered ? order.user_id : null,
        name: (order.customer_name || '').trim(),
        phone,
        // An admin-linked order's email may be the internal account email.
        email: internalAccount ? '' : (order.customer_email || '').trim(),
        orders: [],
        totalSpend: 0,
        latestOrderAt: order.created_at,
        type: registered ? 'registered' : internalAccount ? 'order_only' : 'guest',
      };
      groups.set(key, row);
    }
    row.orders.push(order);
    if (!isCancelled(order.status)) row.totalSpend += numberOrZero(order.grand_total);
    if (order.created_at > row.latestOrderAt) row.latestOrderAt = order.created_at;
    if (!row.name && order.customer_name) row.name = order.customer_name.trim();
    if (!row.email && !internalAccount && order.customer_email) row.email = order.customer_email.trim();
    if (!row.phone && phone) row.phone = phone;
  }
  return Array.from(groups.values());
}
