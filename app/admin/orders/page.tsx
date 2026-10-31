'use client';

import { useEffect, useRef, useState } from 'react';
import OrderStatusActions from '@/components/admin/order-status-actions';
import {ORDER_STATUSES, ORDER_STATUS_LABELS, OrderStatus, nextOrderStatuses} from '@/lib/admin-order-status';
import { PaymentAuditPanel } from '@/components/admin/payment-audit-panel';
import { supabase, cashfreeEnvironmentLabel } from '@/lib/supabase/client';
import { ORDER_SOURCE_LABELS } from '@/lib/admin-order-display';
import { OrderPaymentSummary } from '@/components/admin/order-payment-summary';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from '@/components/site/toast-provider';
import { Search, Eye, X, Printer, AlertTriangle, Package, Calendar, Phone, User, Globe } from 'lucide-react';

const STATUS_OPTIONS = ORDER_STATUSES;
const STATUS_LABELS = ORDER_STATUS_LABELS;

const SOURCE_FILTERS = ['all', 'website', 'ads', 'facebook', 'instagram', 'google', 'tiktok', 'animated_landing', 'facebook_messenger_ai'];
const PAGE_SIZE = 25;

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const statusRequestInFlight = useRef(false);
  const orderRequestId = useRef(0);
  const [settlingDue, setSettlingDue] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifiedCashfree, setVerifiedCashfree] = useState<{ amount: number; type: string; due: number } | null>(null);

  const [duplicateOrders, setDuplicateOrders] = useState<Record<string, any[]>>({});
  const [adminCountry, setAdminCountry] = useState<'BD' | 'IN'>('BD');

  const formatAdminPrice = (price: number) =>
    adminCountry === 'IN'
      ? '₹ ' + Number(price).toLocaleString('en-IN')
      : '৳ ' + Number(price).toLocaleString('bn-BD');

  useEffect(() => {
    const source = searchParams.get('source');
    setSourceFilter(source && SOURCE_FILTERS.includes(source) ? source : 'all');
    setPageIndex(0);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().slice(0, 80)), 300);
    setPageIndex(0);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const requestId = ++orderRequestId.current;
    const loadOrders = async () => {
      setLoading(true);
      try {
        const { data: branch, error: branchError } = await supabase.rpc('current_admin_country');
        const country = String(branch || '').toUpperCase();
        if (branchError || !['IN', 'BD'].includes(country)) throw new Error('Branch যাচাই করা যায়নি');
        if (!active || requestId !== orderRequestId.current) return;
        setAdminCountry(country as 'BD' | 'IN');

        // Strip PostgREST filter syntax characters before placing search text in .or().
        const safeSearch = debouncedSearch.replace(/[^\p{L}\p{N}\s+.#-]/gu, ' ').trim().replace(/\s+/g, ' ');
        let query = supabase.from('orders').select('*', { count: 'exact' })
          .eq('country_code', country)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (sourceFilter !== 'all') query = query.eq('order_source', sourceFilter);
        if (safeSearch) query = query.or(`order_number.ilike.%${safeSearch}%,customer_name.ilike.%${safeSearch}%,customer_phone.ilike.%${safeSearch}%`);

        const { data, error, count } = await query;
        if (error) throw error;
        if (!active || requestId !== orderRequestId.current) return;
        const pageOrders = data || [];
        setOrders(pageOrders);
        setTotalCount(count || 0);

        // Keep duplicate warnings across pages by checking nearby orders for only the phones shown here.
        const phones = Array.from(new Set(pageOrders.map((order) => order.customer_phone).filter(Boolean)));
        if (phones.length === 0) {
          setDuplicateOrders({});
        } else {
          const timestamps = pageOrders.map((order) => new Date(order.created_at).getTime()).filter(Number.isFinite);
          const nearbyOrders = timestamps.length ? (await supabase.from('orders').select('id,customer_phone,created_at')
            .eq('country_code', country).in('customer_phone', phones)
            .gte('created_at', new Date(Math.min(...timestamps) - 24 * 60 * 60 * 1000).toISOString())
            .lte('created_at', new Date(Math.max(...timestamps) + 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false }).limit(500)).data : [];
          if (!active || requestId !== orderRequestId.current) return;
          const byPhone: Record<string, any[]> = {};
          (nearbyOrders || []).forEach((order) => { (byPhone[order.customer_phone] ||= []).push(order); });
          const dupMap: Record<string, any[]> = {};
          Object.entries(byPhone).forEach(([phone, matching]) => {
            const pageIds = new Set(pageOrders.filter((order) => order.customer_phone === phone).map((order) => order.id));
            const duplicates = matching.filter((order, index) => index > 0 && pageIds.has(order.id) &&
              Math.abs(new Date(order.created_at).getTime() - new Date(matching[index - 1].created_at).getTime()) < 24 * 60 * 60 * 1000);
            if (duplicates.length) dupMap[phone] = duplicates;
          });
          setDuplicateOrders(dupMap);
        }
      } catch (error) {
        if (active && requestId === orderRequestId.current) {
          setOrders([]); setDuplicateOrders({}); setTotalCount(0);
          toast(error instanceof Error && error.message === 'Branch যাচাই করা যায়নি' ? error.message : 'অর্ডার লোড করা যায়নি', 'error');
        }
      } finally {
        if (active && requestId === orderRequestId.current) setLoading(false);
      }
    };
    void loadOrders();
    return () => { active = false; };
  }, [debouncedSearch, statusFilter, sourceFilter, pageIndex, refreshKey]);

  const filtered = orders;
  const dateLocale = adminCountry === 'IN' ? 'en-IN' : 'bn-BD';

  const openOrder = async (order: any) => {
    setSelectedOrder(order);
    setVerifiedCashfree(null);
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

  const verifyCashfreePayment = async () => {
    if (!selectedOrder || verifyingPayment) return;
    setVerifyingPayment(true);
    setVerifiedCashfree(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast('Cashfree verify করতে Admin Login প্রয়োজন', 'error');
        return;
      }
      const { data, error } = await supabase.functions.invoke('cashfree-verify-dispatch', {
        body: { orderId: selectedOrder.id, status: 'verify_only' },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error || !data?.ok || !data.verified) {
        toast(data?.error || 'Cashfree payment verified হয়নি। Dispatch hold করুন।', 'error');
        return;
      }
      setVerifiedCashfree({
        amount: Number(data.verified_amount),
        type: String(data.payment_type),
        due: Number(data.due_amount || 0),
      });
      toast('Cashfree API দিয়ে payment verified হয়েছে');
    } catch {
      toast('Cashfree verification unavailable — dispatch hold করুন', 'error');
    } finally {
      setVerifyingPayment(false);
      setAuditRefreshKey(value => value + 1);
    }
  };

  const updateStatus = async (newStatus: OrderStatus, reason: string): Promise<boolean> => {
    if (!selectedOrder || statusRequestInFlight.current || updatingStatus || settlingDue || verifyingPayment) return false;
    if (!nextOrderStatuses(selectedOrder.status).includes(newStatus)) return false;
    statusRequestInFlight.current = true;
    setUpdatingStatus(true);
    try {
      const needsPaidDispatchVerification = adminCountry === 'IN' && newStatus === 'shipped' && (
        ['cashfree', 'online'].includes(String(selectedOrder.payment_method || '').toLowerCase()) ||
        ['paid', 'partially_paid'].includes(String(selectedOrder.payment_status || '').toLowerCase()) ||
        Number(selectedOrder.payment_advance_amount || 0) > 0
      );
      if (needsPaidDispatchVerification) {
        const {data: sessionData} = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('Payment verification-এর জন্য পুনরায় Admin Login করুন');
        const note = [selectedOrder.internal_notes, reason].filter(Boolean).join('\n');
        const {data: result, error} = await supabase.functions.invoke('cashfree-verify-dispatch', {
          body: {orderId: selectedOrder.id, status: 'shipped', note},
          headers: {Authorization: `Bearer ${accessToken}`},
        });
        if (error || !result?.ok || !result?.verified || result.history_recorded !== true)
          throw new Error(result?.error || 'Verified dispatch নিশ্চিত হয়নি। পুনরায় চেষ্টা করার আগে order refresh করুন।');
      } else {
        const {data: result, error} = await supabase.rpc('admin_transition_order_status', {
          p_order_id: selectedOrder.id, p_expected_status: selectedOrder.status, p_status: newStatus,
          p_note: reason, p_confirmed: true, p_expected_country: adminCountry,
        });
        const messages: Record<string,string> = {
          admin_required: 'সক্রিয় Admin access প্রয়োজন', branch_changed: 'Admin branch বদলেছে। পেজ refresh করুন।',
          order_unavailable: 'এই branch-এ order পাওয়া যায়নি', stale_order: 'অন্য কেউ status বদলেছেন। পেজ refresh করুন।',
          invalid_transition: 'এই ধাপে পরিবর্তন অনুমোদিত নয়', reason_required: 'কারণ / যাচাইয়ের তথ্য লিখুন',
          confirmation_required: 'কাজটি সম্পন্ন হয়েছে নিশ্চিত করুন',
          verified_dispatch_required: 'Cashfree verification প্রয়োজন। Order refresh করে আবার যাচাই করুন।',
          status_update_failed: 'Status সংরক্ষণ হয়নি। Order refresh করে আবার যাচাই করুন।',
        };
        if (error || result?.success !== true)
          throw new Error(messages[result?.code] || 'Status সংরক্ষণ করা যায়নি। পেজ refresh করুন।');
      }
      // Keep the details and list mounted so filters and scroll position survive.
      // The write is already confirmed; a failed read must not offer to repeat it.
      let refreshedOrder: any = null;
      try {
        const {data, error} = await supabase.from('orders').select('*')
          .eq('id', selectedOrder.id).eq('country_code', adminCountry).single();
        if (!error) refreshedOrder = data;
      } catch { /* Retain the confirmed status if the follow-up read is unavailable. */ }
      const applySavedStatus = (order: any) => refreshedOrder || {
        ...order, status: newStatus, order_status: newStatus,
      };
      setOrders(current => current.map(order => order.id === selectedOrder.id ? applySavedStatus(order) : order));
      setSelectedOrder((current: any) => current?.id === selectedOrder.id ? applySavedStatus(current) : current);
      setAuditRefreshKey(value => value + 1);
      setRefreshKey(value => value + 1);
      toast(refreshedOrder ? 'অর্ডারের status ও history সংরক্ষণ হয়েছে' :
        'Status সংরক্ষণ হয়েছে। সর্বশেষ অন্যান্য তথ্য দেখতে পরে order আবার খুলুন।');
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Status পরিবর্তন করা যায়নি', 'error');
      return false;
    } finally {
      statusRequestInFlight.current = false;
      setUpdatingStatus(false);
    }
  };

  const collectCodDue = async () => {
    if (!selectedOrder) return;

    const dueAmount = Math.max(
      0,
      Number(selectedOrder.payment_due_amount || 0)
    );

    if (selectedOrder.country_code !== 'IN' || selectedOrder.payment_method !== 'cod' || selectedOrder.status !== 'delivered' || dueAmount <= 0) {
      toast('এই অর্ডারে এখন COD due collection করা যাবে না', 'error');
      return;
    }

    setSettlingDue(true);
    const { data, error } = await supabase.rpc('collect_cod_due_atomic', {
      p_order_id: selectedOrder.id,
    });
    setSettlingDue(false);
    setAuditRefreshKey(value => value + 1);

    if (error || !data?.success) {
      toast(data?.error || error?.message || 'Due collection ব্যর্থ হয়েছে', 'error');
      return;
    }

    toast(`COD due ${formatAdminPrice(dueAmount)} collected successfully`);
    setSelectedOrder({
      ...selectedOrder,
      payment_status: 'paid',
      payment_due_amount: 0,
    });
    setRefreshKey((value) => value + 1);
  };

  const [printMode, setPrintMode] = useState<'invoice' | 'packing'>('invoice');

  const getProductDisplayName = (item: any) => {
    if (item.product_name && item.product_name.toLowerCase() !== 'product') return item.product_name;
    return 'বীজ / পণ্য';
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">অর্ডার ম্যানেজমেন্ট</h1>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
          {adminCountry === 'IN' ? '🇮🇳 India Branch • ₹' : '🇧🇩 Bangladesh Branch • ৳'}
        </span>
      </div>

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
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPageIndex(0); }} className="input-bangla w-full">
            <option value="all">সকল স্ট্যাটাস</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPageIndex(0); }} className="input-bangla w-full">
            {SOURCE_FILTERS.map((s) => <option key={s} value={s}>{s === 'all' ? 'সকল সোর্স' : ORDER_SOURCE_LABELS[s] || s}</option>)}
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
                role="button"
                tabIndex={0}
                aria-label={`অর্ডার ${o.order_number}, বিস্তারিত দেখুন`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void openOrder(o);
                  }
                }}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition active:scale-[0.99] cursor-pointer"
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

                <OrderPaymentSummary order={o} />
                <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between text-foreground font-medium">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" /> {o.customer_name}
                    </span>
                    <span className="text-primary font-bold text-sm">
                      {formatAdminPrice(o.final_amount ?? o.grand_total ?? o.total_amount ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {o.customer_phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" /> {ORDER_SOURCE_LABELS[o.order_source] || o.order_source}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {new Date(o.created_at).toLocaleDateString(dateLocale)}
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
                  <th className="p-3.5">পেমেন্ট</th><th className="p-3.5">স্ট্যাটাস</th>
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
                          <AlertTriangle className="h-3.5 w-3.5" /><span className="ml-1">সম্ভাব্য ডুপ্লিকেট</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">{o.customer_name}</td>
                    <td className="p-3.5 whitespace-nowrap">{o.customer_phone}</td>
                    <td className="p-3.5 capitalize whitespace-nowrap">{ORDER_SOURCE_LABELS[o.order_source] || o.order_source}</td>
                    <td className="p-3.5 font-bold text-primary whitespace-nowrap">{formatAdminPrice(o.final_amount ?? o.grand_total ?? o.total_amount ?? 0)}</td>
                    <td className="p-3.5 whitespace-nowrap"><OrderPaymentSummary order={o} /></td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted-foreground whitespace-nowrap">{new Date(o.created_at).toLocaleDateString(dateLocale)}</td>
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

      {!loading && totalCount > 0 && (
        <nav aria-label="Order pages" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
          <span aria-live="polite" className="text-muted-foreground">
            {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, totalCount)} / {totalCount}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPageIndex((page) => Math.max(0, page - 1))} disabled={pageIndex === 0}
              className="min-h-10 rounded-lg border border-border px-3 disabled:opacity-50">আগের</button>
            <button type="button" onClick={() => setPageIndex((page) => page + 1)} disabled={(pageIndex + 1) * PAGE_SIZE >= totalCount}
              className="min-h-10 rounded-lg border border-border px-3 disabled:opacity-50">পরের</button>
          </div>
        </nav>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => { if (!updatingStatus && !settlingDue && !verifyingPayment) setSelectedOrder(null); }} />
          <div className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-background p-4 pt-0 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-6 sm:pt-0 shadow-2xl border border-border">
            <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 border-b border-border bg-background pt-4 pb-3 sm:pt-6">
              <div>
                <h2 className="text-base sm:text-xl font-bold break-words">অর্ডার: {selectedOrder.order_number}</h2>
                <span className="text-xs text-muted-foreground">{new Date(selectedOrder.created_at).toLocaleDateString(dateLocale)}</span>
              </div>
              <button onClick={() => { if (!updatingStatus && !settlingDue && !verifyingPayment) setSelectedOrder(null); }} aria-label="Close order details" className="shrink-0 p-2 rounded-full hover:bg-secondary"><X className="h-6 w-6" /></button>
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
              <div><span className="text-muted-foreground">সোর্স: </span><span className="font-semibold capitalize">{ORDER_SOURCE_LABELS[selectedOrder.order_source] || selectedOrder.order_source}</span></div>
              <div><span className="text-muted-foreground">পেমেন্ট মেথড: </span><span className="font-semibold uppercase">{selectedOrder.payment_method || 'COD'}</span></div>
              <div><span className="text-muted-foreground">পেমেন্ট স্ট্যাটাস: </span><OrderPaymentSummary order={{ payment_status: selectedOrder.payment_status }} /></div>
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl border border-border/60 bg-background/70 p-2.5">
                <div><span className="text-muted-foreground">মোট: </span><span className="font-bold">{formatAdminPrice(selectedOrder.final_amount ?? selectedOrder.grand_total ?? selectedOrder.total_amount ?? 0)}</span></div>
                <div><span className="text-muted-foreground">পেইড: </span><span className="font-bold text-green-600">{formatAdminPrice(Math.max(0, Number(selectedOrder.final_amount ?? selectedOrder.grand_total ?? selectedOrder.total_amount ?? 0) - Number(selectedOrder.payment_due_amount || 0)))}</span></div>
                <div><span className="text-muted-foreground">বাকি: </span><span className="font-bold text-orange-600">{formatAdminPrice(Math.max(0, Number(selectedOrder.payment_due_amount || 0)))}</span></div>
              </div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">ঠিকানা: </span><span className="font-semibold">{selectedOrder.delivery_address}</span></div>
              <div><span className="text-muted-foreground">এলাকা: </span><span className="font-semibold">{selectedOrder.delivery_zone_name || selectedOrder.thana || selectedOrder.district || '-'}</span></div>
              {selectedOrder.utm_campaign && <div><span className="text-muted-foreground">ক্যাম্পেইন: </span>{selectedOrder.utm_campaign}</div>}
            </div>

            {selectedOrder.country_code === 'IN' && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-900">
                <p className="font-semibold">Delhivery shipment প্রস্তুতি</p>
                <p className="mt-1 text-xs">Shipment screen-এ orderটি আগে থেকে নির্বাচন হবে। মাপ যাচাই ও নিশ্চিত না করা পর্যন্ত booking হবে না।</p>
                <Link href={`/admin/india-shipping?order_id=${encodeURIComponent(selectedOrder.id)}`}
                  className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-800">
                  Shipment-এর জন্য প্রস্তুত করুন
                </Link>
              </div>
            )}

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
                              {item.quantity} × {item.is_free_gift ? 'FREE' : formatAdminPrice(item.unit_price)}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-primary shrink-0">
                          {item.is_free_gift ? formatAdminPrice(0) : formatAdminPrice(item.total_price || (item.unit_price * item.quantity))}
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
                  <span>{formatAdminPrice(selectedOrder.subtotal ?? selectedOrder.total_amount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>ডেলিভারি চার্জ</span>
                  <span>{formatAdminPrice(selectedOrder.delivery_charge ?? 0)}</span>
                </div>
                {Number(selectedOrder.discount || selectedOrder.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>ডিসকাউন্ট</span>
                    <span>-{formatAdminPrice(selectedOrder.discount || selectedOrder.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm sm:text-base font-bold pt-2 border-t border-border mt-2">
                  <span>মোট বিল</span>
                  <span className="text-primary">{formatAdminPrice(selectedOrder.final_amount ?? selectedOrder.grand_total ?? selectedOrder.total_amount ?? 0)}</span>
                </div>
              </div>
            </div>

            {selectedOrder.country_code === 'IN' && selectedOrder.payment_method === 'cod' && selectedOrder.status === 'delivered' && Number(selectedOrder.payment_due_amount || 0) > 0 && (
              <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-orange-800">COD বাকি সংগ্রহ</p>
                    <p className="mt-0.5 text-xs text-orange-700">ডেলিভারি সম্পন্ন। এখন বাকি টাকা সংগ্রহ করে Paid করা যাবে।</p>
                  </div>
                  <span className="text-sm font-bold text-orange-800">{formatAdminPrice(selectedOrder.payment_due_amount)}</span>
                </div>
                <button onClick={collectCodDue} disabled={settlingDue} className="mt-3 w-full rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                  {settlingDue ? 'সংগ্রহ হচ্ছে...' : `বাকি ${formatAdminPrice(selectedOrder.payment_due_amount)} Paid করুন`}
                </button>
              </div>
            )}

            {selectedOrder.country_code === 'IN' && (
              ['cashfree', 'online'].includes(String(selectedOrder.payment_method || '').toLowerCase()) ||
              ['paid', 'partially_paid'].includes(String(selectedOrder.payment_status || '').toLowerCase()) ||
              Number(selectedOrder.payment_advance_amount || 0) > 0
            ) && (
              <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
                <div className="text-sm font-bold">Cashfree Payment Verification</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cashfreeEnvironmentLabel} Cashfree API দিয়ে amount, INR, payment status ও refund যাচাই করুন।
                  Shipment-এর আগে আবার automatic verification হবে।
                </p>
                {verifiedCashfree && (
                  <div role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                    VERIFIED PAID — {formatAdminPrice(verifiedCashfree.amount)}
                    {verifiedCashfree.type === 'cod_advance'
                      ? ` (COD Advance; Due ${formatAdminPrice(verifiedCashfree.due)})`
                      : ' (Fully Paid)'}
                  </div>
                )}
                <button type="button" disabled={verifyingPayment || updatingStatus}
                  onClick={verifyCashfreePayment}
                  className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
                  {verifyingPayment ? 'Cashfree যাচাই হচ্ছে...' : 'Verify Cashfree Payment'}
                </button>
              </div>
            )}

            {selectedOrder.country_code === 'IN' && <PaymentAuditPanel key={selectedOrder.id} orderId={selectedOrder.id} refreshKey={auditRefreshKey} />}

            {selectedOrder.internal_notes && <div className="rounded-xl border border-border p-3 text-xs">
              <p className="font-semibold">সংরক্ষিত অভ্যন্তরীণ নোট</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{selectedOrder.internal_notes}</p>
            </div>}
            <OrderStatusActions key={selectedOrder.id} orderId={selectedOrder.id} status={selectedOrder.status} countryCode={adminCountry}
              disabled={updatingStatus || settlingDue || verifyingPayment} onAction={updateStatus} />
          </div>
        </div>
      )}
    </div>
  );
}
