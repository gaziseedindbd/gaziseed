'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/data';
import { Search, Eye, X, Mail, Phone, MapPin, Package, Shield, KeyRound, Unlock, AlertTriangle, Copy, Check, Clock, RefreshCw, FileText } from 'lucide-react';

type AuditLog = {
  id: string;
  admin_email: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
};

type CustomerDetail = {
  user: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    banned_until: string | null;
    app_metadata: Record<string, any>;
    user_metadata: Record<string, any>;
  };
  addresses: any[];
  orders: any[];
  audit_logs: AuditLog[];
  total_orders: number;
  total_spend: number;
  account_status: string;
  must_change_password: boolean;
};

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-customer-support`;

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerEmail, setSelectedCustomerEmail] = useState<string>('');
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => { loadCustomers(); checkAdminRole(); }, []);

  const checkAdminRole = async () => {
    const { data } = await supabase.rpc('is_master_admin');
    setIsMasterAdmin(!!data);
  };

  const loadCustomers = async () => {
    const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const phoneMap = new Map<string, any>();
    const userMap = new Map<string, any>();

    (orders || []).forEach((o: any) => {
      if (o.user_id) {
        if (!userMap.has(o.user_id)) {
          userMap.set(o.user_id, { user_id: o.user_id, name: o.customer_name, phone: o.customer_phone, email: o.customer_email, orders: [], totalSpend: 0, type: 'registered' });
        }
        const u = userMap.get(o.user_id);
        u.orders.push(o);
        if (o.status !== 'cancelled') u.totalSpend += Number(o.grand_total);
      } else {
        if (!phoneMap.has(o.customer_phone)) {
          phoneMap.set(o.customer_phone, { name: o.customer_name, phone: o.customer_phone, orders: [], totalSpend: 0, type: 'guest' });
        }
        const g = phoneMap.get(o.customer_phone);
        g.orders.push(o);
        if (o.status !== 'cancelled') g.totalSpend += Number(o.grand_total);
      }
    });

    setCustomers(Array.from(userMap.values()));
    setGuests(Array.from(phoneMap.values()));
    setLoading(false);
  };

  const openCustomer = async (c: any) => {
    if (c.type === 'guest') return;
    setSelectedCustomerId(c.user_id);
    setSelectedCustomerEmail(c.email || '');
    setDetailLoading(true);
    setDetail(null);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setDetailLoading(false); return; }

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_customer_detail', target_user_id: c.user_id }),
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setDetail(data as CustomerDetail);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const callSupportFunction = async (action: string, extra?: Record<string, any>) => {
    if (!selectedCustomerId) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, target_user_id: selectedCustomerId, ...extra }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  };

  const allCustomers = [...customers, ...guests];
  const filtered = allCustomers.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(s) || c.email?.toLowerCase().includes(s);
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">কাস্টমার</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, ফোন, ইমেইল খুঁজুন..." className="input-bangla pl-10" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3">নাম</th>
              <th className="p-3">ফোন</th>
              <th className="p-3">ধরন</th>
              <th className="p-3">অর্ডার</th>
              <th className="p-3">মোট খরচ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${c.type === 'registered' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.type === 'registered' ? 'নিবন্ধিত' : 'গেস্ট'}</span></td>
                <td className="p-3">{c.orders?.length || 0}</td>
                <td className="p-3 font-bold">{formatPrice(c.totalSpend)}</td>
                <td className="p-3">
                  <button onClick={() => openCustomer(c)} disabled={c.type === 'guest'} className="rounded-lg p-1.5 hover:bg-secondary disabled:opacity-30" title={c.type === 'guest' ? 'গেস্ট কাস্টমার' : 'বিস্তারিত দেখুন'}>
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন কাস্টমার নেই</p>}
      </div>

      {selectedCustomerId && (
        <CustomerDetailModal
          loading={detailLoading}
          detail={detail}
          email={selectedCustomerEmail}
          isMasterAdmin={isMasterAdmin}
          onClose={() => { setSelectedCustomerId(null); setDetail(null); }}
          onAction={callSupportFunction}
          onRefresh={() => openCustomer({ user_id: selectedCustomerId, email: selectedCustomerEmail, type: 'registered' })}
        />
      )}
    </div>
  );
}

function CustomerDetailModal({ loading, detail, email, isMasterAdmin, onClose, onAction, onRefresh }: {
  loading: boolean;
  detail: CustomerDetail | null;
  email: string;
  isMasterAdmin: boolean;
  onClose: () => void;
  onAction: (action: string, extra?: Record<string, any>) => Promise<any>;
  onRefresh: () => void;
}) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAction = async (action: string, extra?: Record<string, any>) => {
    setActionLoading(action);
    setActionMessage(null);
    try {
      const data = await onAction(action, extra);
      if (action === 'set_temp_password' && data?.temp_password) {
        setTempPassword(data.temp_password);
        setActionMessage({ type: 'success', text: 'নতুন টেম্পোরারি পাসওয়ার্ড তৈরি হয়েছে' });
      } else if (action === 'send_reset_link') {
        setActionMessage({ type: 'success', text: 'পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে' });
      } else if (action === 'force_password_change') {
        setActionMessage({ type: 'success', text: 'পরবর্তী লগইনে পাসওয়ার্ড পরিবর্তন বাধ্য করা হয়েছে' });
      } else if (action === 'unlock_account') {
        setActionMessage({ type: 'success', text: 'অ্যাকাউন্ট আনলক করা হয়েছে' });
      }
      onRefresh();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'অজানা ত্রুটি' });
    } finally {
      setActionLoading(null);
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeModal = () => {
    setTempPassword(null);
    setActionMessage(null);
    onClose();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatDateTime = (d: string) => new Date(d).toLocaleString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const actionLabels: Record<string, string> = {
    set_temp_password: 'টেম্পোরারি পাসওয়ার্ড সেট করুন',
    send_reset_link: 'পাসওয়ার্ড রিসেট লিংক পাঠান',
    force_password_change: 'পাসওয়ার্ড পরিবর্তন বাধ্য করুন',
    unlock_account: 'অ্যাকাউন্ট আনলক করুন',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">কাস্টমার বিস্তারিত</h2>
          <button onClick={closeModal}><X className="h-6 w-6" /></button>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-secondary" />
        ) : detail ? (
          <div className="space-y-5">
            {/* Profile Section */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-lg text-primary">
                    {(detail.user.user_metadata?.name || detail.user.email)?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{detail.user.user_metadata?.name || 'নাম নেই'}</p>
                    <p className="text-sm text-muted-foreground">{detail.user.email}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${detail.account_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {detail.account_status === 'active' ? 'সক্রিয়' : 'লক করা'}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> <span>{detail.user.user_metadata?.phone || detail.orders[0]?.customer_phone || '-'}</span></div>
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> <span>{detail.user.email}</span></div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> <span>নিবন্ধন: {formatDate(detail.user.created_at)}</span></div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> <span>শেষ লগইন: {detail.user.last_sign_in_at ? formatDate(detail.user.last_sign_in_at) : 'কখনো নয়'}</span></div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground"><Package className="h-4 w-4" /><span className="text-sm">মোট অর্ডার</span></div>
                <p className="mt-1 text-2xl font-bold text-primary">{detail.total_orders}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground"><Shield className="h-4 w-4" /><span className="text-sm">মোট খরচ</span></div>
                <p className="mt-1 text-2xl font-bold text-primary">{formatPrice(detail.total_spend)}</p>
              </div>
            </div>

            {/* Saved Addresses */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4" /> সংরক্ষিত ঠিকানা</h3>
              {detail.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">কোন ঠিকানা সংরক্ষিত নেই</p>
              ) : (
                <div className="space-y-2">
                  {detail.addresses.map((a: any) => (
                    <div key={a.id} className="rounded-lg bg-secondary/20 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.name}</span>
                        {a.is_default && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">ডিফল্ট</span>}
                      </div>
                      <p className="text-muted-foreground">{a.phone}</p>
                      <p className="text-muted-foreground">{a.address}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order History */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><Package className="h-4 w-4" /> অর্ডার হিস্ট্রি</h3>
              {detail.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">কোন অর্ডার নেই</p>
              ) : (
                <div className="space-y-2">
                  {detail.orders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg bg-secondary/20 p-3 text-sm">
                      <div><p className="font-medium">{o.order_number}</p><p className="text-xs text-muted-foreground">{formatDate(o.created_at)} — {o.status}</p></div>
                      <span className="font-bold">{formatPrice(o.grand_total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Account Support Controls */}
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
              <h3 className="mb-1 flex items-center gap-2 font-semibold"><Shield className="h-4 w-4" /> অ্যাকাউন্ট সাপোর্ট</h3>
              <p className="mb-4 text-xs text-muted-foreground">কাস্টমার সাপোর্ট এর জন্য বিশেষ নিয়ন্ত্রণ</p>

              {actionMessage && (
                <div className={`mb-3 rounded-lg p-3 text-sm ${actionMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {actionMessage.text}
                </div>
              )}

              {/* Temp Password One-Time Display */}
              {tempPassword && (
                <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">টেম্পোরারি পাসওয়ার্ড — একবারই দেখানো হবে</span>
                  </div>
                  <p className="mb-3 text-sm text-amber-700">এই পাসওয়ার্ডটি এখনই কপি করুন এবং কাস্টমারকে দিন। এটি আর কখনো দেখানো যাবে না বা পুনরুদ্ধার করা যাবে না।</p>
                  <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-3">
                    <code className="flex-1 text-lg font-mono font-bold tracking-wider">{tempPassword}</code>
                    <button onClick={copyPassword} className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
                      {copied ? <><Check className="h-4 w-4" /> কপি হয়েছে</> : <><Copy className="h-4 w-4" /> কপি করুন</>}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-amber-600">কাস্টমার এই পাসওয়ার্ড দিয়ে লগইন করলে নতুন পাসওয়ার্ড সেট করতে বাধ্য হবেন।</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {isMasterAdmin && (
                  <button
                    onClick={() => handleAction('set_temp_password')}
                    disabled={actionLoading === 'set_temp_password'}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {actionLoading === 'set_temp_password' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    টেম্পোরারি পাসওয়ার্ড সেট করুন
                  </button>
                )}
                <button
                  onClick={() => handleAction('send_reset_link')}
                  disabled={actionLoading === 'send_reset_link'}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                >
                  {actionLoading === 'send_reset_link' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  রিসেট লিংক পাঠান
                </button>
                {detail.account_status === 'locked' && (
                  <button
                    onClick={() => handleAction('unlock_account')}
                    disabled={actionLoading === 'unlock_account'}
                    className="flex items-center gap-2 rounded-lg border border-green-500 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                  >
                    {actionLoading === 'unlock_account' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                    অ্যাকাউন্ট আনলক করুন
                  </button>
                )}
              </div>
              {!isMasterAdmin && (
                <p className="mt-3 text-xs text-muted-foreground">টেম্পোরারি পাসওয়ার্ড সেট করতে মাস্টার অ্যাডমিন অনুমতি প্রয়োজন।</p>
              )}
            </div>

            {/* Audit Log */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> অডিট লগ</h3>
              {detail.audit_logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">কোন অডিট রেকর্ড নেই</p>
              ) : (
                <div className="space-y-2">
                  {detail.audit_logs.map((log: AuditLog) => (
                    <div key={log.id} className="flex items-start justify-between rounded-lg bg-secondary/20 p-3 text-sm">
                      <div>
                        <p className="font-medium">{actionLabels[log.action] || log.action}</p>
                        <p className="text-xs text-muted-foreground">অ্যাডমিন: {log.admin_email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-muted-foreground">কাস্টমার তথ্য লোড করা যায়নি</p>
        )}
      </div>
    </div>
  );
}
