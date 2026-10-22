import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateCustomers } from '../lib/admin/customer-aggregation.ts';
import { getCustomerAccessFailure } from '../supabase/functions/_shared/customer-access.ts';

const baseOrder = (overrides = {}) => ({
  id: 'order-1',
  order_number: 'GS-IN-TEST01',
  customer_name: 'Buyer One',
  customer_phone: '9876543210',
  customer_email: 'buyer@example.test',
  user_id: null,
  status: 'delivered',
  grand_total: 250,
  created_at: '2026-10-20T10:00:00.000Z',
  ...overrides,
});

test('internal admin-linked orders are shown as isolated order-only records without account identifiers', () => {
  const order = baseOrder({ user_id: 'admin-1', customer_email: 'internal@example.test' });
  const guestOrder = baseOrder({ id: 'guest-order', customer_name: 'Different Buyer' });
  const rows = aggregateCustomers([order, guestOrder], new Set(['admin-1']));
  const customer = rows.find((row) => row.type === 'order_only');

  assert.equal(rows.length, 2);
  assert.equal(customer.type, 'order_only');
  assert.equal(customer.user_id, null);
  assert.equal(customer.email, '');
  assert.equal(customer.name, 'Buyer One');
  assert.equal(customer.orders[0].id, order.id);
});

test('a registered profile is grouped only by its exact user id, not by a shared phone', () => {
  const registered = baseOrder({ id: 'registered-order', user_id: 'customer-1', customer_name: 'Registered Buyer' });
  const guest = baseOrder({ id: 'guest-order', customer_name: 'Guest Buyer' });
  const rows = aggregateCustomers([registered, guest]);

  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.type === 'registered')?.user_id, 'customer-1');
  assert.equal(rows.find((row) => row.type === 'guest')?.name, 'Guest Buyer');
});

test('ordinary guest orders still group by normalized phone and cancelled value is not spend', () => {
  const first = baseOrder({ id: 'guest-a', customer_phone: '98 7654 3210', grand_total: 400, status: 'delivered' });
  const second = baseOrder({ id: 'guest-b', customer_phone: '9876543210', grand_total: 90, status: 'cancelled' });
  const [guest] = aggregateCustomers([first, second]);

  assert.equal(guest.type, 'guest');
  assert.equal(guest.orders.length, 2);
  assert.equal(guest.totalSpend, 400);
});

test('internal accounts are blocked before branch scoping, including for master admins', () => {
  assert.equal(getCustomerAccessFailure(true, true), 'internal_admin_account');
  assert.equal(getCustomerAccessFailure(true, false), 'internal_admin_account');
});

test('a customer without records in the selected branch cannot be opened', () => {
  assert.equal(getCustomerAccessFailure(false, false), 'customer_not_in_branch');
  assert.equal(getCustomerAccessFailure(false, true), null);
});
