'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { toast } from '@/components/site/toast-provider';
import { Search, Eye, X, Printer, AlertTriangle, Package, Calendar, Phone, User, Globe } from 'lucide-react';

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'অর্ডার গৃহীত', confirmed: 'কনফার্মড', processing: 'প্রসেসিং', packed: 'প্যাকড',
  shipped: 'শিপড', delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'ফেরত',
};

const SOURCE_FILTERS = ['all', 'website', 'facebook', 'instagram', 'google', 'tiktok'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');

  const [duplicateOrders, setDuplicateOrders] = useState<Record<string, any[]>>({});

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data } = await query;
    setOrders(data || []);
    
    // ডুপ্লিকেট অর্ডার শনাক্তকরণ
    const dupMap: Record<string, any[]> = {};
    (data || []).forEach((o) => {
      const key = o.customer_phone;
      if (!dupMap[key]) dupMap[key] = [];
      dupMap[key].push(o);
    });
    Object.keys(dupMap).forEach((key) => {
      if (dupMap[key].length < 2) delete dupMap[key];
      else {
        dupMap[key] = dupMap[key].filter((o, i, arr) => {
          if (i === 0) return false;
          const prev = arr[i - 1];
          return Math.abs(new Date(o.created_at).getTime() - new Date(prev.created_at).getTime()) < 24 * 60 * 60 * 1000;
        });
        if (dupMap[key].length === 0) delete dupMap[key];
      }
    });
    setDuplicateOrders(dupMap);
    setLoading(false);
  };

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && o.order_source !== sourceFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (o.order_number || '').toLowerCase().includes(s) ||
        (o.customer_name || '').toLowerCase().includes(s) ||
        (o.customer_phone || '').includes(s);
    }
    return true;
  });

  const openOrder = async (order: any) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setNote(order.internal_notes || '');
    setLoadingItems(true);

    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (error) {
      console.error('Error fetching order items:', error);
      toast('আইটেম লোড করতে সমস্যা হয়েছে', 'error');
    }
    setOrderItems(data || []);
    setLoadingItems(false);
  };

  const updateStatus = async () => {
    if (!selectedOrder) return;
    await supabase.from('orders').update({ 
      status: newStatus, 
      internal_notes: note 
    }).eq('id', selectedOrder.id);

    if (newStatus !== selectedOrder.status) {
      await supabase.from('order_status_history').insert({ 
        order_id: selectedOrder.id, 
        status: newStatus, 
        note 
      });
    }
    toast('আপডেট সফল হয়েছে');
    setSelectedOrder(null);
    loadOrders();
  };

  const [printMode, setPrintMode] = useState<'invoice' | 'packing'>('invoice');

  const getProductDisplayName = (item: any) => {
    if (item.product_name && item.product_name.toLowerCase() !== 'product') return item.product_name;
    return 'বীজ / পণ্য';
  };

  return (
    <div className="space-y-4 pb-12">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">অর্ডার ম্যানেজমেন্ট</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-6 relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="অর্ডার নং, নাম বা ফোন দিয়ে খুঁজুন..." 
            className="input-bangla pl-10 w-full" 
          />
        </div>
        <div className="sm:col-span-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-bangla w-full">
            <option value="all">সকল স্ট্যাটাস</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="input-bangla w-full">
            {SOURCE_FILTERS.map((s) => <option key={s} value={s}>{s === 'all' ? 'সকল সোর্স' : s}</option>)}
          </select>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-secondary/40" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          কোন অর্ডার পাওয়া যায়নি
        </div>
      ) : (
        <>
          {/* ১. মোবাইল কার্ড ভিউ (Mobile Card View) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map((o) => (
              <div 
                key={o.id} 
                onClick={() => openOrder(o)}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center justify-between border-b border-border/50 pb-2.5 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-primary text-sm">{o.order_number}</span>
                    {duplicateOrders[o.customer_phone]?.find((d) => d.id === o.id) && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-semibold" title="সম্ভাব্য ডুপ্লিকেট">
                        <AlertTriangle className="h-3 w-3" /> ডুপ্লিকেট
                      </span>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between text-foreground font-medium">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" /> {o.customer_name}
                    </span>
                    <span className="text-primary font-bold text-sm">
                      {formatPrice(o.final_amount ?? o.grand_total ?? o.total_amount ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {o.customer_phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" /> {o.order_source}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {new Date(o.created_at).toLocaleDateString('bn-BD')}
                    </span>
                    <span className="text-primary font-semibold flex items-center gap-1">
                      বিস্তারিত দেখুন <Eye className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ২. ডেস্কটপ টেবিল ভিউ (Desktop Table View) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-muted-foreground text-xs uppercase">
                  <th className="p-3.5">অর্ডার নং</th>
                  <th className="p-3.5">কাস্টমার</th>
                  <th className="p-3.5">ফোন</th>
                  <th className="p-3.5">সোর্স</th>
                  <th className="p-3.5">মোট</th>
                  <th className="p-3.5">স্ট্যাটাস</th>
                  <th className="p-3.5">তারিখ</th>
                  <th className="p-3.5 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/20 transition">
                    <td className="p-3.5 font-medium whitespace-nowrap">
                      {o.order_number}
                      {duplicateOrders[o.customer_phone]?.find((d) => d.id === o.id) && (
                        <span className="ml-1 inline-flex items-center text-xs text-orange-600" title="সম্ভাব্য ডুপ্লিকেট অর্ডার">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">{o.customer_name}</td>
                    <td className="p-3.5 whitespace-nowrap">{o.customer_phone}</td>
                    <td className="p-3.5 capitalize whitespace-nowrap">{o.order_source}</td>
                    <td className="p-3.5 font-bold text-primary whitespace-nowrap">{formatPrice(o.final_amount ?? o.grand_total ?? o.total_amount ?? 0)}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted-foreground whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('bn-BD')}</td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <button onClick={() => openOrder(o)} className="rounded-lg p-1.5 hover:bg-secondary border border-border" title="বিবরণ দেখুন">
                        <Eye className="h-4 w-4 text-primary" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedOrder(null)} />
          <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-background p-4 sm:p-6 shadow-2xl border border-border">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">অর্ডার: {selectedOrder.order_number}</h2>
                <span className="text-xs text-muted-foreground">{new Date(selectedOrder.created_at).toLocaleDateString('bn-BD')}</span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-full hover:bg-secondary"><X className="h-6 w-6" /></button>
            </div>

            <div className="mb-4 flex gap-2">
              <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs sm:text-sm font-medium hover:bg-secondary">
                <Printer className="h-4 w-4" /> ইনভয়েস
              </button>
              <button onClick={() => { setPrintMode('packing'); window.print(); }} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs sm:text-sm font-medium hover:bg-secondary">
                <Printer className="h-4 w-4" /> প্যাকিং স্লিপ
              </button>
            </div>

            {duplicateOrders[selectedOrder.customer_phone]?.find((d) => d.id === selectedOrder.id) && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 p-3 text-xs sm:text-sm text-orange-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> সম্ভাব্য ডুপ্লিকেট অর্ডার — একই নম্বরে সাম্প্রতিক সময়ে একাধিক অর্ডার রয়েছে।
              </div>
            )}

            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm bg-secondary/15 p-3.5 rounded-2xl border border-border/50">
              <div><span className="text-muted-foreground">কাস্টমার: </span><span className="font-semibold">{selectedOrder.customer_name}</span></div>
              <div><span className="text-muted-foreground">ফোন: </span><span className="font-semibold">{selectedOrder.customer_phone}</span></div>
              <div><span className="text-muted-foreground">সোর্স: </span><span className="font-semibold capitalize">{selectedOrder.order_source}</span></div>
              <div><span className="text-muted-foreground">পেমেন্ট মেথড: </span><span className="font-semibold uppercase">{selectedOrder.payment_method || 'COD'}</span></div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">ঠিকানা: </span><span className="font-semibold">{selectedOrder.delivery_address}</span></div>
              <div><span className="text-muted-foreground">এলাকা: </span><span className="font-semibold">{selectedOrder.delivery_zone_name || selectedOrder.thana || selectedOrder.district || '-'}</span></div>
              {selectedOrder.utm_campaign && <div><span className="text-muted-foreground">ক্যাম্পেইন: </span>{selectedOrder.utm_campaign}</div>}
            </div>

            {/* আইটেম তালিকা */}
            <div className="mb-4">
              <h3 className="mb-2.5 font-bold text-sm">অর্ডারকৃত পণ্যসমূহ</h3>
              
              {loadingItems ? (
                <div className="space-y-2 py-2">
                  <div className="h-12 bg-secondary/30 rounded-xl animate-pulse" />
                  <div className="h-12 bg-secondary/30 rounded-xl animate-pulse" />
                </div>
              ) : orderItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">কোন আইটেম পাওয়া যায়নি।</p>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((item) => {
                    const displayName = getProductDisplayName(item);
                    const displayImage = item.image;
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-xl bg-secondary/20 p-2.5 sm:p-3 text-xs sm:text-sm gap-2 border border-border/40">
                        <div className="flex items-center gap-2.5">
                          {displayImage ? (
                            <img 
                              src={displayImage} 
                              alt={displayName} 
                              className="h-11 w-11 rounded-lg object-cover border border-border shrink-0" 
                            />
                          ) : (
                            <div className="h-11 w-11 rounded-lg bg-secondary/40 flex items-center justify-center text-muted-foreground shrink-0">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground line-clamp-1">
                              {displayName} 
                              {item.is_free_gift && (
                                <span className="ml-1 rounded bg-green-100 px-1.5 py-0.2 text-[10px] font-bold text-green-700">FREE</span>
                              )}
                            </p>
                            {item.variant_name && <p className="text-[11px] text-muted-foreground">ভেরিয়েন্ট: {item.variant_name}</p>}
                            <p className="text-[11px] text-muted-foreground">
                              {item.quantity} × {item.is_free_gift ? 'FREE' : formatPrice(item.unit_price)}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-primary shrink-0">
                          {item.is_free_gift ? '৳0' : formatPrice(item.total_price || (item.unit_price * item.quantity))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* বিল সামারি */}
              <div className="mt-3.5 space-y-1.5 border-t border-border pt-3 text-xs sm:text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>সাবটোটাল</span>
                  <span>{formatPrice(selectedOrder.subtotal ?? selectedOrder.total_amount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>ডেলিভারি চার্জ</span>
                  <span>{formatPrice(selectedOrder.delivery_charge ?? 0)}</span>
                </div>
                {Number(selectedOrder.discount || selectedOrder.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>ডিসকাউন্ট</span>
                    <span>-{formatPrice(selectedOrder.discount || selectedOrder.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm sm:text-base font-bold pt-2 border-t border-border mt-2">
                  <span>মোট বিল</span>
                  <span className="text-primary">{formatPrice(selectedOrder.final_amount ?? selectedOrder.grand_total ?? selectedOrder.total_amount ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* স্ট্যাটাস আপডেট */}
            <div className="space-y-2.5 border-t border-border pt-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">স্ট্যাটাস পরিবর্তন</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input-bangla w-full">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">অভ্যন্তরীণ নোট</label>
                <input 
                  type="text" 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  className="input-bangla w-full text-xs sm:text-sm" 
                  placeholder="অর্ডার সংক্রান্ত নোট লিখুন..." 
                />
              </div>
              <button onClick={updateStatus} className="w-full rounded-xl bg-primary py-2.5 sm:py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition shadow">
                আপডেট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
