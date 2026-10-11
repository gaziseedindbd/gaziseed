import { adminPrice } from '@/lib/admin-order-display';

export function OrderPaymentSummary({ order }: { order: { payment_status?: string; payment_method?: string; payment_advance_amount?: number; payment_due_amount?: number; country_code?: string } }) {
  const status = order.payment_status || 'unpaid';
  const labels: Record<string, string> = { paid: 'পেইড', unpaid: 'আনপেইড', partially_paid: 'আংশিক পেইড', pending: 'অপেক্ষমান', failed: 'ব্যর্থ', refunded: 'রিফান্ডেড' };
  return <div className="space-y-1 text-xs">
    <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${status === 'paid' ? 'bg-green-100 text-green-800' : status === 'partially_paid' ? 'bg-blue-100 text-blue-800' : 'bg-secondary text-foreground'}`}>{labels[status] || status}</span>
    {order.payment_method === 'cod' && <span className="block text-muted-foreground">COD</span>}
    {Number(order.payment_advance_amount) > 0 && <span className="block">অগ্রিম {adminPrice(Number(order.payment_advance_amount), order.country_code || 'BD')}</span>}
    {Number(order.payment_due_amount) > 0 && <span className="block text-orange-700 dark:text-orange-300">বাকি {adminPrice(Number(order.payment_due_amount), order.country_code || 'BD')}</span>}
  </div>;
}
