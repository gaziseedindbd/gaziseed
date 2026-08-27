'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Search, Loader2, Package } from 'lucide-react';
import { formatPrice } from '@/lib/data';
import type { Order, OrderItem } from '@/lib/supabase/types';
import { useLang } from '@/components/site/language-provider';

const STATUS_LABELS: Record<string, { bn: string; en: string }> = {
  pending: { bn: 'অর্ডার গৃহীত', en: 'Order Received' },
  confirmed: { bn: 'কনফার্মড', en: 'Confirmed' },
  processing: { bn: 'প্রসেসিং', en: 'Processing' },
  packed: { bn: 'প্যাক করা হয়েছে', en: 'Packed' },
  shipped: { bn: 'শিপড', en: 'Shipped' },
  delivered: { bn: 'ডেলিভার হয়েছে', en: 'Delivered' },
  cancelled: { bn: 'বাতিল', en: 'Cancelled' },
  returned: { bn: 'ফেরত', en: 'Returned' },
};

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'];

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const { lang, t } = useLang();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setItems([]);
    if (!orderNumber || !phone) {
      setError(t('অর্ডার নম্বর ও ফোন নম্বর দিন', 'Enter order number and phone number'));
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('track_order', {
        p_order_number: orderNumber.trim().toUpperCase(),
        p_customer_phone: phone.replace(/[^0-9]/g, ''),
      });

      if (rpcError) throw rpcError;
      if (!data) {
        setError(t('অর্ডার পাওয়া যায়নি। অর্ডার নম্বর ও ফোন নম্বর ঠিক আছে কিনা চেক করুন।', 'Order not found. Please check order number and phone number.'));
        return;
      }

      setOrder(data.order as Order);
      setItems((data.items || []) as OrderItem[]);
    } catch {
      setError(t('অর্ডার খুঁজতে সমস্যা হয়েছে', 'Error searching for order'));
    } finally {
      setLoading(false);
    }
  };

  const currentStepIdx = order ? STATUS_STEPS.indexOf(order.status) : -1;

  return (
    <div className="container-custom py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-center text-2xl font-bold sm:text-3xl">{t('অর্ডার ট্র্যাকিং', 'Order Tracking')}</h1>

        <form onSubmit={handleSearch} className="mb-6 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('অর্ডার নম্বর *', 'Order Number *')}</label>
              <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="input-bangla" placeholder="GSXXXXXX" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('মোবাইল নম্বর *', 'Mobile Number *')}</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-bangla" placeholder="01XXXXXXXXX" required />
            </div>
            {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Search className="h-5 w-5" /> {t('অর্ডার খুঁজুন', 'Search Order')}</>}
            </button>
          </div>
        </form>

        {order && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('অর্ডার নম্বর', 'Order Number')}</p>
                  <p className="font-bold">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t('অর্ডারের তারিখ', 'Order Date')}</p>
                  <p className="text-sm">{new Date(order.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD')}</p>
                </div>
              </div>

              {order.status === 'cancelled' || order.status === 'returned' ? (
                <div className="rounded-xl bg-destructive/10 p-4 text-center">
                  <p className="font-medium text-destructive">{lang === 'en' ? STATUS_LABELS[order.status].en : STATUS_LABELS[order.status].bn}</p>
                </div>
              ) : (
                <div className="flex justify-between">
                  {STATUS_STEPS.map((step, idx) => (
                    <div key={step} className="flex flex-1 flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                        idx <= currentStepIdx ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                      }`}>
                        {idx < currentStepIdx ? '✓' : idx + 1}
                      </div>
                      <span className="mt-1 text-[10px] text-center text-muted-foreground">
                        {lang === 'en' ? STATUS_LABELS[step].en : STATUS_LABELS[step].bn}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 font-bold">{t('অর্ডার আইটেম', 'Order Items')}</h2>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg bg-secondary/20 p-3">
                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-secondary/30">
                      {item.image && <img src={item.image} alt={item.product_name} className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} × {formatPrice(item.unit_price)}</p>
                    </div>
                    <span className="font-bold">{formatPrice(item.total_price)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('সাবটোটাল', 'Subtotal')}</span><span>{formatPrice(order.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('ডেলিভারি চার্জ', 'Delivery Charge')}</span><span>{formatPrice(order.delivery_charge)}</span></div>
                {order.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('ছাড়', 'Discount')}</span><span>-{formatPrice(order.discount)}</span></div>}
                <div className="flex justify-between border-t border-border pt-1 text-base font-bold"><span>{t('মোট', 'Total')}</span><span className="text-primary">{formatPrice(order.grand_total)}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 font-bold">{t('ডেলিভারি তথ্য', 'Delivery Information')}</h2>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">{t('নাম: ', 'Name: ')}</span>{order.customer_name}</p>
                <p><span className="text-muted-foreground">{t('ফোন: ', 'Phone: ')}</span>{order.customer_phone}</p>
                <p><span className="text-muted-foreground">{t('ঠিকানা: ', 'Address: ')}</span>{order.delivery_address}</p>
                <p><span className="text-muted-foreground">{t('এলাকা: ', 'Area: ')}</span>{order.delivery_zone_name}</p>
              </div>
            </div>
          </div>
        )}

        {searched && !order && !loading && !error && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
            <p className="text-muted-foreground">{t('অর্ডার পাওয়া যায়নি', 'Order not found')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
