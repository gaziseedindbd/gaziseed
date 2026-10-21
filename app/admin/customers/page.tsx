'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowDown, ArrowUp, Check, Clock3, Copy, Eye, FileText, Filter,
  Mail, MapPin, Package, Phone, RefreshCw, Search, Shield, Unlock, Users, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type Branch = 'BD' | 'IN';
type CustomerKind = 'registered' | 'guest';
type CustomerTypeFilter = 'all' | CustomerKind;
type SortField = 'recent' | 'orders' | 'spend' | 'name';

type OrderSummary = {
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

type CustomerRow = {
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

type AuditLog = {
  id: string;
  admin_email: string;
  action: string;
  created_at: string;
};

type CustomerDetail = {
  user: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    banned_until: string | null;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
  };
  addresses: Array<{
    id: string;
    name: string | null;
    phone: string | null;
    address: string | null;
    is_default: boolean;
  }>;
  orders: OrderSummary[];
  audit_logs: AuditLog[];
  total_orders: number;
  total_spend: number;
  account_status: string;
  must_change_password: boolean;
};

const PAGE_SIZE = 20;
const ORDER_FETCH_SIZE = 1000;
const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-customer-support`;
const isCancelled = (status: string | null) => ['cancelled', 'canceled'].includes((status || '').toLowerCase());
const normalize = (value: string | null | undefined) => (value || '').trim().toLocaleLowerCase();
const numberOrZero = (value: number | string | null | undefined) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

function formatBranchPrice(value: number, branch: Branch) {
  const currency = branch === 'IN' ? 'INR' : 'BDT';
  const locale = branch === 'IN' ? 'en-IN' : 'bn-BD';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(numberOrZero(value));
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('bn-BD', {
    year: 'numeric', month: 'short', day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function aggregateCustomers(orders: OrderSummary[]): CustomerRow[] {
  const groups = new Map<string, CustomerRow>();
  for (const order of orders) {
    const registered = Boolean(order.user_id);
    const phone = (order.customer_phone || '').trim();
    const key = registered
      ? `registered:${order.user_id}`
      : phone
        ? `guest:${phone.replace(/\s+/g, '')}`
        : `guest-order:${order.id}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        key,
        user_id: order.user_id,
        name: (order.customer_name || '').trim(),
        phone,
        email: (order.customer_email || '').trim(),
        orders: [],
        totalSpend: 0,
        latestOrderAt: order.created_at,
        type: registered ? 'registered' : 'guest',
      };
      groups.set(key, row);
    }
    row.orders.push(order);
    if (isCancelled(order.status) === false) row.totalSpend += numberOrZero(order.grand_total);
    if (order.created_at > row.latestOrderAt) row.latestOrderAt = order.created_at;
    if (!row.name && order.customer_name) row.name = order.customer_name.trim();
    if (!row.email && order.customer_email) row.email = order.customer_email.trim();
    if (!row.phone && phone) row.phone = phone;
  }
  return Array.from(groups.values());
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CustomerTypeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('recent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [branch, setBranch] = useState<Branch>('BD');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerEmail, setSelectedCustomerEmail] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<CustomerRow | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const detailRequest = useRef(0);

  const loadCustomers = useCallback(async (isRefresh = false) => {
    setLoadError('');
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [{ data: branchData, error: branchError }, { data: masterData }] = await Promise.all([
        supabase.rpc('current_admin_country'),
        supabase.rpc('is_master_admin'),
      ]);
      if (branchError) throw new Error('Admin branch যাচাই করা যায়নি। আবার চেষ্টা করুন।');
      const normalizedCountry = String(branchData || '').toUpperCase();
      if (normalizedCountry !== 'IN' && normalizedCountry !== 'BD') {
        throw new Error('Admin branch যাচাই করা যায়নি। আবার লগইন করে চেষ্টা করুন।');
      }
      const country: Branch = normalizedCountry;
      setBranch(country);
      setIsMasterAdmin(Boolean(masterData));

      const allOrders: OrderSummary[] = [];
      for (let from = 0; ; from += ORDER_FETCH_SIZE) {
        const { data, error } = await supabase
          .from('orders')
          .select('id,order_number,user_id,customer_name,customer_phone,customer_email,status,grand_total,created_at')
          .eq('country_code', country)
          .order('created_at', { ascending: false })
          .range(from, from + ORDER_FETCH_SIZE - 1);
        if (error) throw new Error(error.message || 'কাস্টমার তালিকা লোড করা যায়নি।');
        const batch = (data || []) as OrderSummary[];
        allOrders.push(...batch);
        if (batch.length < ORDER_FETCH_SIZE) break;
      }
      setCustomers(aggregateCustomers(allOrders));
    } catch (error) {
      setCustomers([]);
      setLoadError(error instanceof Error ? error.message : 'কাস্টমার তালিকা লোড করা যায়নি।');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  const openCustomer = async (customer: CustomerRow) => {
    if (!customer.user_id) {
      setSelectedGuest(customer);
      return;
    }
    setSelectedGuest(null);
    const requestId = ++detailRequest.current;
    setSelectedCustomerId(customer.user_id);
    setSelectedCustomerEmail(customer.email);
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Admin session পাওয়া যায়নি। আবার লগইন করে চেষ্টা করুন।');
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_customer_detail', target_user_id: customer.user_id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'কাস্টমার তথ্য লোড করা যায়নি।');
      if (requestId === detailRequest.current) setDetail(result as CustomerDetail);
    } catch (error) {
      if (requestId === detailRequest.current) setDetailError(error instanceof Error ? error.message : 'কাস্টমার তথ্য লোড করা যায়নি।');
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  };

  const callSupportFunction = async (action: string, extra?: Record<string, unknown>) => {
    if (!selectedCustomerId) throw new Error('কাস্টমার নির্বাচন করা হয়নি।');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (sessionError || !token) throw new Error('Admin session পাওয়া যায়নি। আবার লগইন করে চেষ্টা করুন।');
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, target_user_id: selectedCustomerId, ...extra }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'অনুরোধটি সম্পন্ন করা যায়নি।');
    return result;
  };

  const filtered = useMemo(() => {
    const query = normalize(search);
    const result = customers.filter((customer) => {
      if (typeFilter !== 'all' && customer.type !== typeFilter) return false;
      if (!query) return true;
      return [customer.name, customer.phone, customer.email].some((value) => normalize(value).includes(query));
    });
    const compare = (a: CustomerRow, b: CustomerRow) => {
      if (sortField === 'name') return a.name.localeCompare(b.name, 'bn');
      if (sortField === 'orders') return a.orders.length - b.orders.length;
      if (sortField === 'spend') return a.totalSpend - b.totalSpend;
      return new Date(a.latestOrderAt).getTime() - new Date(b.latestOrderAt).getTime();
    };
    return result.sort((a, b) => compare(a, b) * (sortDirection === 'asc' ? 1 : -1));
  }, [customers, search, sortDirection, sortField, typeFilter]);

  useEffect(() => { setPage(1); }, [search, typeFilter, sortField, sortDirection]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleCustomers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const registeredCount = customers.filter((customer) => customer.type === 'registered').length;
  const guestCount = customers.length - registeredCount;
  const orderCount = customers.reduce((sum, customer) => sum + customer.orders.length, 0);

  const changeSort = (field: SortField) => {
    if (field === sortField) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection(field === 'name' ? 'asc' : 'desc'); }
  };

  const closeCustomer = () => {
    detailRequest.current++;
    setSelectedGuest(null);
    setSelectedCustomerId(null);
    setSelectedCustomerEmail('');
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Customer management</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">কাস্টমার</h1>
          <p className="mt-1 text-sm text-muted-foreground">নিবন্ধিত ও গেস্ট কাস্টমারের অর্ডার ও যোগাযোগের তথ্য দেখুন।</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground">
            {branch === 'IN' ? '🇮🇳 India · INR' : '🇧🇩 Bangladesh · BDT'}
          </span>
          <button type="button" onClick={() => void loadCustomers(true)} disabled={loading || refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">রিফ্রেশ</span>
          </button>
        </div>
      </header>

      {loadError ? (
        <section role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden="true" /><div><h2 className="font-bold">তালিকা লোড হয়নি</h2><p className="mt-1 text-sm text-muted-foreground">{loadError}</p><button type="button" onClick={() => void loadCustomers()} className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">আবার চেষ্টা করুন</button></div></div>
        </section>
      ) : (
        <>
          <section aria-label="Customer overview" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={<Users className="h-4 w-4" />} label="মোট কাস্টমার" value={customers.length.toLocaleString('bn-BD')} />
            <StatCard icon={<Shield className="h-4 w-4" />} label="নিবন্ধিত" value={registeredCount.toLocaleString('bn-BD')} />
            <StatCard icon={<Users className="h-4 w-4" />} label="গেস্ট" value={guestCount.toLocaleString('bn-BD')} />
            <StatCard icon={<Package className="h-4 w-4" />} label="মোট অর্ডার" value={orderCount.toLocaleString('bn-BD')} />
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="customer-search" className="sr-only">নাম, ফোন বা ইমেইল দিয়ে খুঁজুন</label>
                <input id="customer-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নাম, ফোন বা ইমেইল খুঁজুন" className="input-bangla min-h-11 w-full rounded-xl pl-10 pr-4" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Filter className="h-3.5 w-3.5" aria-hidden="true" /> ধরন</span>
                {([
                  ['all', 'সব'], ['registered', 'নিবন্ধিত'], ['guest', 'গেস্ট'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={typeFilter === value} onClick={() => setTypeFilter(value)} className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${typeFilter === value ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-muted-foreground hover:bg-secondary'}`}>
                    {label}
                  </button>
                ))}
                <label htmlFor="customer-sort" className="sr-only">কাস্টমার সাজান</label>
                <select id="customer-sort" value={sortField} onChange={(event) => { setSortField(event.target.value as SortField); setSortDirection(event.target.value === 'name' ? 'asc' : 'desc'); }} className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                  <option value="recent">সাম্প্রতিক অর্ডার</option>
                  <option value="orders">অর্ডার সংখ্যা</option>
                  <option value="spend">মোট খরচ</option>
                  <option value="name">নাম</option>
                </select>
                <button type="button" onClick={() => setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')} aria-label={sortDirection === 'asc' ? 'উর্ধ্বক্রমে সাজানো' : 'নিম্নক্রমে সাজানো'} title={sortDirection === 'asc' ? 'উর্ধ্বক্রমে' : 'নিম্নক্রমে'} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                  {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 p-4" aria-label="কাস্টমার তালিকা লোড হচ্ছে" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-secondary/70" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="h-6 w-6" aria-hidden="true" /></div>
                <h2 className="mt-4 font-bold">{search || typeFilter !== 'all' ? 'মিল থাকা কাস্টমার নেই' : 'এখনও কোনো কাস্টমার নেই'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{search || typeFilter !== 'all' ? 'অনুসন্ধান বা ধরন পরিবর্তন করে আবার চেষ্টা করুন।' : 'অর্ডার এলে কাস্টমাররা এখানে দেখা যাবে।'}</p>
                {(search || typeFilter !== 'all') && <button type="button" onClick={() => { setSearch(''); setTypeFilter('all'); }} className="mt-4 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary">ফিল্টার মুছুন</button>}
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[780px] text-sm">
                    <caption className="sr-only">কাস্টমার তালিকা — {branch === 'IN' ? 'India' : 'Bangladesh'} branch</caption>
                    <thead className="bg-secondary/40 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <SortableHeader label="কাস্টমার" field="name" sortField={sortField} direction={sortDirection} onSort={changeSort} />
                        <th scope="col" className="px-4 py-3">ফোন</th>
                        <th scope="col" className="px-4 py-3">ধরন</th>
                        <SortableHeader label="অর্ডার" field="orders" sortField={sortField} direction={sortDirection} onSort={changeSort} />
                        <SortableHeader label="মোট খরচ" field="spend" sortField={sortField} direction={sortDirection} onSort={changeSort} />
                        <th scope="col" className="px-4 py-3 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {visibleCustomers.map((customer) => <CustomerTableRow key={customer.key} customer={customer} branch={branch} onOpen={openCustomer} />)}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 p-3 md:hidden">
                  {visibleCustomers.map((customer) => <CustomerMobileCard key={customer.key} customer={customer} branch={branch} onOpen={openCustomer} />)}
                </div>
                <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p aria-live="polite">{filtered.length.toLocaleString('bn-BD')} জনের মধ্যে {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length).toLocaleString('bn-BD')}–{Math.min(page * PAGE_SIZE, filtered.length).toLocaleString('bn-BD')} দেখানো হচ্ছে</p>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="min-h-9 rounded-lg border border-border px-3 font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40">আগের</button>
                    <span aria-current="page" className="min-w-16 text-center font-semibold text-foreground">{page.toLocaleString('bn-BD')} / {pageCount.toLocaleString('bn-BD')}</span>
                    <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount} className="min-h-9 rounded-lg border border-border px-3 font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40">পরের</button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {selectedGuest && <GuestCustomerDetailModal customer={selectedGuest} branch={branch} onClose={closeCustomer} />}

      {selectedCustomerId && (
        <CustomerDetailModal
          loading={detailLoading}
          error={detailError}
          detail={detail}
          email={selectedCustomerEmail}
          branch={branch}
          isMasterAdmin={isMasterAdmin}
          onClose={closeCustomer}
          onAction={callSupportFunction}
          onRefresh={() => {
            if (!selectedCustomerId) return;
            const customer = customers.find((item) => item.user_id === selectedCustomerId);
            if (customer) void openCustomer(customer);
          }}
        />
      )}
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon}<span>{label}</span></div><p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</p></div>;
}

function SortableHeader({ label, field, sortField, direction, onSort }: { label: string; field: SortField; sortField: SortField; direction: 'asc' | 'desc'; onSort: (field: SortField) => void }) {
  const active = sortField === field;
  return <th scope="col" aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3"><button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1.5 text-left hover:text-foreground focus-visible:outline-none focus-visible:underline">{label}{active && (direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />)}</button></th>;
}

function CustomerTableRow({ customer, branch, onOpen }: { customer: CustomerRow; branch: Branch; onOpen: (customer: CustomerRow) => void }) {
  const title = customer.name || 'নাম নেই';
  return <tr className="transition-colors hover:bg-secondary/30 focus-within:bg-secondary/30">
    <td className="max-w-[280px] px-4 py-3.5"><div className="flex min-w-0 items-center gap-3"><Avatar name={title} /><div className="min-w-0"><p className="truncate font-semibold text-foreground">{title}</p>{customer.email && <p className="truncate text-xs text-muted-foreground">{customer.email}</p>}</div></div></td>
    <td className="whitespace-nowrap px-4 py-3.5 text-foreground">{customer.phone || '—'}</td>
    <td className="px-4 py-3.5"><CustomerTypeBadge type={customer.type} /></td>
    <td className="px-4 py-3.5 tabular-nums text-foreground">{customer.orders.length.toLocaleString('bn-BD')}</td>
    <td className="whitespace-nowrap px-4 py-3.5 font-bold tabular-nums text-foreground">{formatBranchPrice(customer.totalSpend, branch)}</td>
    <td className="px-4 py-3.5 text-right"><button type="button" onClick={() => onOpen(customer)} aria-label={`${title} — বিস্তারিত দেখুন`} title="অর্ডার ও যোগাযোগের তথ্য দেখুন" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><Eye className="h-4 w-4" aria-hidden="true" /><span>বিস্তারিত</span></button></td>
  </tr>;
}

function CustomerMobileCard({ customer, branch, onOpen }: { customer: CustomerRow; branch: Branch; onOpen: (customer: CustomerRow) => void }) {
  const title = customer.name || 'নাম নেই';
  return <article className="rounded-xl border border-border bg-background p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Avatar name={title} /><div className="min-w-0"><h2 className="truncate font-bold text-foreground">{title}</h2>{customer.email && <p className="truncate text-xs text-muted-foreground">{customer.email}</p>}</div></div><CustomerTypeBadge type={customer.type} /></div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">ফোন</p><p className="mt-0.5 truncate font-medium text-foreground">{customer.phone || '—'}</p></div><div><p className="text-xs text-muted-foreground">অর্ডার</p><p className="mt-0.5 font-semibold text-foreground">{customer.orders.length.toLocaleString('bn-BD')}</p></div><div><p className="text-xs text-muted-foreground">মোট খরচ</p><p className="mt-0.5 font-bold text-foreground">{formatBranchPrice(customer.totalSpend, branch)}</p></div><div><p className="text-xs text-muted-foreground">সর্বশেষ অর্ডার</p><p className="mt-0.5 text-foreground">{formatDate(customer.latestOrderAt)}</p></div></div>
    <button type="button" onClick={() => onOpen(customer)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><Eye className="h-4 w-4" aria-hidden="true" />কাস্টমার বিস্তারিত</button>
  </article>;
}

function Avatar({ name }: { name: string }) {
  return <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">{name.trim().charAt(0).toLocaleUpperCase() || 'ক'}</span>;
}

function CustomerTypeBadge({ type }: { type: CustomerKind }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${type === 'registered' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-secondary text-muted-foreground'}`}>{type === 'registered' ? 'নিবন্ধিত' : 'গেস্ট'}</span>;
}

function GuestCustomerDetailModal({ customer, branch, onClose }: { customer: CustomerRow; branch: Branch; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  const name = customer.name || 'নাম নেই';
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="guest-customer-detail-title" tabIndex={-1} className="flex h-full max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-none border border-border bg-background shadow-2xl outline-none sm:h-auto sm:rounded-3xl">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 py-3 sm:px-6">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{branch === 'IN' ? 'India customer' : 'Bangladesh customer'}</p><h2 id="guest-customer-detail-title" className="mt-0.5 truncate text-lg font-extrabold sm:text-xl">গেস্ট কাস্টমার বিস্তারিত</h2></div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="কাস্টমার বিস্তারিত বন্ধ করুন" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><X className="h-5 w-5" aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3"><Avatar name={name} /><div className="min-w-0"><h3 className="truncate text-lg font-bold text-foreground">{name}</h3><CustomerTypeBadge type="guest" /></div></div>
          <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><DetailFact icon={<Phone className="h-4 w-4" />} label="ফোন" value={customer.phone || '—'} /><DetailFact icon={<Mail className="h-4 w-4" />} label="ইমেইল" value={customer.email || '—'} /><DetailFact icon={<Clock3 className="h-4 w-4" />} label="সর্বশেষ অর্ডার" value={formatDate(customer.latestOrderAt, true)} /></dl>
        </section>
        <section aria-label="Guest customer totals" className="grid grid-cols-2 gap-3"><StatCard icon={<Package className="h-4 w-4" />} label="মোট অর্ডার" value={customer.orders.length.toLocaleString('bn-BD')} /><StatCard icon={<Shield className="h-4 w-4" />} label="মোট খরচ" value={formatBranchPrice(customer.totalSpend, branch)} /></section>
        <DetailSection icon={<Package className="h-4 w-4" />} title="অর্ডার হিস্ট্রি" empty="কোনো অর্ডার নেই" count={customer.orders.length}>
          {customer.orders.map((order) => <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm"><div className="min-w-0"><p className="truncate font-bold text-foreground">{order.order_number || order.id}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(order.created_at, true)} · {order.status || 'স্ট্যাটাস নেই'}</p></div><span className="font-bold tabular-nums text-foreground">{formatBranchPrice(numberOrZero(order.grand_total), branch)}</span></article>)}
        </DetailSection>
        <p className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">গেস্ট কাস্টমারের লগইন অ্যাকাউন্ট নেই। তাই এখানে শুধু অর্ডার ও যোগাযোগের তথ্য দেখানো হচ্ছে।</p>
      </div>
    </section>
  </div>;
}

function CustomerDetailModal({ loading, error, detail, email, branch, isMasterAdmin, onClose, onAction, onRefresh }: {
  loading: boolean;
  error: string;
  detail: CustomerDetail | null;
  email: string;
  branch: Branch;
  isMasterAdmin: boolean;
  onClose: () => void;
  onAction: (action: string, extra?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onRefresh: () => void;
}) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  const handleAction = async (action: string) => {
    setActionLoading(action); setActionMessage(null); setCopyError('');
    try {
      const result = await onAction(action);
      if (action === 'set_temp_password' && typeof result.temp_password === 'string') {
        setTempPassword(result.temp_password);
        setActionMessage({ type: 'success', text: 'টেম্পোরারি পাসওয়ার্ড তৈরি হয়েছে। এটি একবারই দেখা যাবে।' });
      } else if (action === 'send_reset_link') setActionMessage({ type: 'success', text: 'পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।' });
      else if (action === 'unlock_account') setActionMessage({ type: 'success', text: 'অ্যাকাউন্ট আনলক করা হয়েছে।' });
      onRefresh();
    } catch (error) {
      setActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'অনুরোধটি সম্পন্ন করা যায়নি।' });
    } finally { setActionLoading(null); }
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true); setCopyError('');
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopyError('ক্লিপবোর্ডে কপি করা যায়নি। পাসওয়ার্ডটি হাতে কপি করুন।'); }
  };

  const name = String(detail?.user.user_metadata?.name || '').trim() || 'নাম নেই';
  const phone = String(detail?.user.user_metadata?.phone || detail?.orders[0]?.customer_phone || '').trim() || '—';
  const isLocked = detail?.account_status === 'locked';
  const actionLabels: Record<string, string> = {
    set_temp_password: 'টেম্পোরারি পাসওয়ার্ড সেট করুন',
    send_reset_link: 'পাসওয়ার্ড রিসেট লিংক পাঠান',
    unlock_account: 'অ্যাকাউন্ট আনলক করুন',
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" tabIndex={-1} className="flex h-full max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-none border border-border bg-background shadow-2xl outline-none sm:h-auto sm:rounded-3xl">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{branch === 'IN' ? 'India customer' : 'Bangladesh customer'}</p><h2 id="customer-detail-title" className="mt-0.5 truncate text-lg font-extrabold sm:text-xl">কাস্টমার বিস্তারিত</h2></div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="কাস্টমার বিস্তারিত বন্ধ করুন" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><X className="h-5 w-5" aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {loading ? <div aria-label="কাস্টমার তথ্য লোড হচ্ছে" aria-busy="true" className="space-y-4"><div className="h-40 animate-pulse rounded-2xl bg-secondary" /><div className="grid grid-cols-2 gap-3"><div className="h-24 animate-pulse rounded-2xl bg-secondary" /><div className="h-24 animate-pulse rounded-2xl bg-secondary" /></div><div className="h-32 animate-pulse rounded-2xl bg-secondary" /></div>
          : error ? <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm"><p className="font-bold text-foreground">কাস্টমার তথ্য লোড হয়নি</p><p className="mt-1 text-muted-foreground">{error}</p><button type="button" onClick={onRefresh} className="mt-3 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground">আবার চেষ্টা করুন</button></div>
          : detail ? <>
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Avatar name={name === 'নাম নেই' ? detail.user.email : name} /><div className="min-w-0"><h3 className="truncate text-lg font-bold text-foreground">{name}</h3><p className="truncate text-sm text-muted-foreground">{detail.user.email || email || '—'}</p></div></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${isLocked ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>{isLocked ? 'লক করা' : 'সক্রিয়'}</span></div>
              <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><DetailFact icon={<Phone className="h-4 w-4" />} label="ফোন" value={phone} /><DetailFact icon={<Mail className="h-4 w-4" />} label="ইমেইল" value={detail.user.email || email || '—'} /><DetailFact icon={<Clock3 className="h-4 w-4" />} label="নিবন্ধন" value={formatDate(detail.user.created_at)} /><DetailFact icon={<Clock3 className="h-4 w-4" />} label="শেষ লগইন" value={detail.user.last_sign_in_at ? formatDate(detail.user.last_sign_in_at, true) : 'কখনো নয়'} /></dl>
            </section>
            <section aria-label="Customer totals" className="grid grid-cols-2 gap-3"><StatCard icon={<Package className="h-4 w-4" />} label="মোট অর্ডার" value={numberOrZero(detail.total_orders).toLocaleString('bn-BD')} /><StatCard icon={<Shield className="h-4 w-4" />} label="মোট খরচ" value={formatBranchPrice(detail.total_spend, branch)} /></section>
            <DetailSection icon={<MapPin className="h-4 w-4" />} title="সংরক্ষিত ঠিকানা" empty="কোনো ঠিকানা সংরক্ষিত নেই" count={detail.addresses.length}>
              {detail.addresses.map((address) => <article key={address.id} className="rounded-xl border border-border bg-background p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{address.name || 'নাম নেই'}</p>{address.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">ডিফল্ট</span>}</div><p className="mt-1 text-muted-foreground">{address.phone || '—'}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{address.address || 'ঠিকানা দেওয়া নেই'}</p></article>)}
            </DetailSection>
            <DetailSection icon={<Package className="h-4 w-4" />} title="অর্ডার হিস্ট্রি" empty="কোনো অর্ডার নেই" count={detail.orders.length}>
              {detail.orders.map((order) => <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm"><div className="min-w-0"><p className="truncate font-bold text-foreground">{order.order_number || order.id}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(order.created_at, true)} · {order.status || 'স্ট্যাটাস নেই'}</p></div><span className="font-bold tabular-nums text-foreground">{formatBranchPrice(numberOrZero(order.grand_total), branch)}</span></article>)}
            </DetailSection>
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
              <div className="flex items-start gap-3"><Shield className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" /><div><h3 className="font-bold text-foreground">অ্যাকাউন্ট সাপোর্ট</h3><p className="mt-1 text-xs text-muted-foreground">সংবেদনশীল অ্যাকাউন্ট পরিবর্তন মাস্টার অ্যাডমিনের অনুমতিতে হয়।</p></div></div>
              {actionMessage && <div role={actionMessage.type === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm font-medium ${actionMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'}`}>{actionMessage.text}</div>}
              {tempPassword && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex items-center gap-2 font-bold"><AlertCircle className="h-5 w-5" aria-hidden="true" />টেম্পোরারি পাসওয়ার্ড — একবারই দেখানো হবে</div><p className="mt-2 text-sm">এটি নিরাপদে কাস্টমারকে দিন। অডিট লগে পাসওয়ার্ড সংরক্ষিত হয় না।</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-lg border border-amber-300 bg-white px-3 py-2.5 font-mono font-bold">{tempPassword}</code><button type="button" onClick={() => void copyPassword()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 text-sm font-bold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{copied ? 'কপি হয়েছে' : 'কপি করুন'}</button></div>{copyError && <p role="alert" className="mt-2 text-xs font-semibold">{copyError}</p>}</div>}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {isMasterAdmin && <button type="button" onClick={() => void handleAction('set_temp_password')} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50">{actionLoading === 'set_temp_password' ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Shield className="h-4 w-4" aria-hidden="true" />}{actionLabels.set_temp_password}</button>}
                <button type="button" onClick={() => void handleAction('send_reset_link')} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50">{actionLoading === 'send_reset_link' ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}{actionLabels.send_reset_link}</button>
                {isMasterAdmin && isLocked && <button type="button" onClick={() => void handleAction('unlock_account')} disabled={Boolean(actionLoading)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 disabled:opacity-50">{actionLoading === 'unlock_account' ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Unlock className="h-4 w-4" aria-hidden="true" />}{actionLabels.unlock_account}</button>}
              </div>
              {!isMasterAdmin && <p className="mt-3 text-xs text-muted-foreground">টেম্পোরারি পাসওয়ার্ড ও অ্যাকাউন্ট আনলক করতে মাস্টার অ্যাডমিন অনুমতি লাগে।</p>}
            </section>
            <DetailSection icon={<FileText className="h-4 w-4" />} title="অডিট লগ" empty="কোনো অডিট রেকর্ড নেই" count={detail.audit_logs.length}>
              {detail.audit_logs.map((log) => <article key={log.id} className="flex flex-col gap-1 rounded-xl border border-border bg-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold text-foreground">{actionLabels[log.action] || log.action}</p><p className="text-xs text-muted-foreground">{log.admin_email || 'অ্যাডমিন'} · {formatDate(log.created_at, true)}</p></article>)}
            </DetailSection>
          </> : <p className="py-10 text-center text-sm text-muted-foreground">কাস্টমার তথ্য পাওয়া যায়নি।</p>}
      </div>
    </section>
  </div>;
}

function DetailFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex min-w-0 items-start gap-2"><span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span><div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="break-words font-medium text-foreground">{value}</dd></div></div>;
}

function DetailSection({ icon, title, empty, count, children }: { icon: React.ReactNode; title: string; empty: string; count: number; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold text-foreground">{icon}{title}</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">{count.toLocaleString('bn-BD')}</span></div>{count ? <div className="space-y-2">{children}</div> : <p className="rounded-xl bg-secondary/30 px-3 py-4 text-sm text-muted-foreground">{empty}</p>}</section>;
}
