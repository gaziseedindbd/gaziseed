'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  LifeBuoy,
  Layers,
  Clock3,
  MessageCircle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { aggregateCustomers, type CustomerRow, type OrderSummary } from '@/lib/admin/customer-aggregation';

type Branch = 'BD' | 'IN';

type CrmOverview = {
  branch: Branch;
  customers: CustomerRow[];
  orders: OrderSummary[];
  openOrders: number;
  openTickets: number;
  overdueTasks: number;
  dueTodayTasks: number;
};

const PAGE_SIZE = 1000;
const CLOSED_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'canceled', 'returned', 'refunded']);

function orderStatusLabel(status: string | null) {
  const labels: Record<string, string> = {
    pending: 'অপেক্ষমাণ',
    processing: 'প্রস্তুত হচ্ছে',
    packed: 'প্যাক করা',
    shipped: 'পাঠানো হয়েছে',
    delivered: 'ডেলিভার হয়েছে',
    cancelled: 'বাতিল',
    canceled: 'বাতিল',
    returned: 'ফেরত',
    refunded: 'রিফান্ড',
  };
  return status ? labels[status.toLowerCase()] || status : 'স্ট্যাটাস নেই';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

async function loadBranchOrders(branch: Branch) {
  const allOrders: OrderSummary[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('orders')
      .select('id,order_number,user_id,customer_name,customer_phone,customer_email,status,grand_total,created_at')
      .eq('country_code', branch)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('অর্ডার থেকে CRM summary লোড করা যায়নি।');
    const batch = (data || []) as OrderSummary[];
    allOrders.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return allOrders;
}

async function loadInternalAccountIds(orders: OrderSummary[]) {
  const registeredIds = Array.from(new Set(orders.map((order) => order.user_id).filter((id): id is string => Boolean(id))));
  const internalIds = new Set<string>();
  for (let from = 0; from < registeredIds.length; from += 100) {
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .in('user_id', registeredIds.slice(from, from + 100));
    if (error) throw new Error('অভ্যন্তরীণ অ্যাকাউন্ট যাচাই করা যায়নি।');
    for (const row of data || []) internalIds.add(row.user_id);
  }
  return internalIds;
}

export default function AdminCrmPage() {
  const [overview, setOverview] = useState<CrmOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    setError('');
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: country, error: branchError } = await supabase.rpc('current_admin_country');
      const normalized = String(country || '').toUpperCase();
      if (branchError || (normalized !== 'BD' && normalized !== 'IN')) {
        throw new Error('Admin branch নিশ্চিত করা যায়নি। আবার লগইন করে চেষ্টা করুন।');
      }
      const branch = normalized as Branch;
      const [orders, ticketCountResult, taskResult] = await Promise.all([
        loadBranchOrders(branch),
        supabase
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('country_code', branch)
          .in('status', ['open', 'in_review']),
        supabase.from('crm_follow_up_tasks').select('due_at').eq('country_code', branch).eq('status', 'open'),
      ]);
      if (ticketCountResult.error) throw new Error('সাপোর্ট summary লোড করা যায়নি।');
      if (taskResult.error) throw new Error('Follow-up reminder লোড করা যায়নি।');
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const taskDueTimes = (taskResult.data || []).map((task) => new Date(task.due_at).getTime());
      const internalIds = await loadInternalAccountIds(orders);
      const customers = aggregateCustomers(orders, internalIds).filter((customer) => customer.type !== 'order_only');
      setOverview({
        branch,
        customers,
        orders,
        openOrders: orders.filter((order) => !CLOSED_ORDER_STATUSES.has((order.status || '').toLowerCase())).length,
        openTickets: ticketCountResult.count || 0,
        overdueTasks: taskDueTimes.filter((dueAt) => dueAt < startOfToday.getTime()).length,
        dueTodayTasks: taskDueTimes.filter((dueAt) => dueAt >= startOfToday.getTime() && dueAt < startOfTomorrow.getTime()).length,
      });
    } catch (loadError) {
      setOverview(null);
      setError(loadError instanceof Error ? loadError.message : 'CRM summary লোড করা যায়নি।');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const repeatCustomers = overview?.customers.filter((customer) =>
    customer.orders.filter((order) => !CLOSED_ORDER_STATUSES.has((order.status || '').toLowerCase())).length > 1,
  ).length || 0;
  const repeatRate = overview?.customers.length
    ? Math.round((repeatCustomers / overview.customers.length) * 100)
    : 0;
  const recentOrders = overview?.orders.slice(0, 6) || [];
  const branchName = overview?.branch === 'IN' ? 'India · INR' : 'Bangladesh · BDT';

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-2 -top-6 h-44 w-44 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.16em] text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Customer relationship workspace
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">GAZI SEED CRM</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/85 sm:text-base">
              Customer, order ও service activity এক জায়গায় দেখুন—বর্তমান branch-এর তথ্য আলাদা রেখে।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold">
              <span className="h-2 w-2 rounded-full bg-lime-300" aria-hidden="true" />
              {loading ? 'Branch যাচাই হচ্ছে' : overview ? branchName : 'Branch unavailable'}
            </span>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> রিফ্রেশ
            </button>
          </div>
        </div>
      </section>

      {error && <section role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</section>}

      <section aria-label="CRM summary" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <MetricCard icon={<Users className="h-4 w-4" />} label="কাস্টমার প্রোফাইল" value={loading ? '—' : (overview?.customers.length || 0).toLocaleString('bn-BD')} detail="Registered ও guest অর্ডার থেকে" />
        <MetricCard icon={<Sparkles className="h-4 w-4" />} label="Repeat customers" value={loading ? '—' : `${repeatRate.toLocaleString('bn-BD')}%`} detail={`${repeatCustomers.toLocaleString('bn-BD')} জনের একাধিক active order`} />
        <MetricCard icon={<ShoppingBag className="h-4 w-4" />} label="চলমান অর্ডার" value={loading ? '—' : (overview?.openOrders || 0).toLocaleString('bn-BD')} detail="Delivery সম্পন্ন বা বাতিল নয়" />
        <MetricCard icon={<LifeBuoy className="h-4 w-4" />} label="খোলা support case" value={loading ? '—' : (overview?.openTickets || 0).toLocaleString('bn-BD')} detail="Open ও review-তে থাকা ticket" />
        <Link href="/admin/crm/follow-ups?filter=overdue" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 sm:p-5"><div className="flex items-center gap-2 text-sm font-semibold text-rose-800"><Clock3 className="h-4 w-4" /><span>Follow-up reminder</span></div><p className="mt-3 text-3xl font-black tracking-tight text-rose-950">{loading ? '—' : (overview?.overdueTasks || 0).toLocaleString('bn-BD')}<span className="ml-2 text-sm font-bold">বাকি</span></p><p className="mt-1 text-xs leading-5 text-rose-800">আজ due: {loading ? '—' : (overview?.dueTodayTasks || 0).toLocaleString('bn-BD')} · খুলে task দেখুন</p></Link>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Customer activity</p><h2 className="mt-1 text-lg font-extrabold">সাম্প্রতিক অর্ডার</h2></div>
            <Link href="/admin/orders" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-bold transition hover:bg-secondary">সব অর্ডার <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          {loading ? <div className="space-y-3 p-5" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary/70" />)}</div>
            : recentOrders.length ? <div className="divide-y divide-border/70">
              {recentOrders.map((order) => <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShoppingBag className="h-4 w-4" aria-hidden="true" /></span>
                  <div className="min-w-0"><p className="truncate font-bold text-foreground">{order.customer_name || 'নাম দেওয়া হয়নি'}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{order.order_number || order.id.slice(0, 8)} · {formatDate(order.created_at)}</p></div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />{orderStatusLabel(order.status)}</span>
              </article>)}
            </div> : <div className="p-8 text-center text-sm text-muted-foreground">এই branch-এ এখনো কোনো অর্ডার নেই।</div>}
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Workspace</p>
            <h2 className="mt-1 text-lg font-extrabold">CRM-এর বিদ্যমান অংশ</h2>
            <div className="mt-4 space-y-2">
              <WorkspaceLink href="/admin/customers" icon={<Users className="h-4 w-4" />} title="Customer directory" detail="Search, branch অনুযায়ী customer ও order history" />
              <WorkspaceLink href="/admin/crm/follow-ups" icon={<Clock3 className="h-4 w-4" />} title="Follow-up tasks" detail="Due task দেখুন, complete বা cancel করুন" />
              <WorkspaceLink href="/admin/crm/segments" icon={<Layers className="h-4 w-4" />} title="Saved segments" detail="Repeat, inactive ও active customer group save করুন" />
              <WorkspaceLink href="/admin/support" icon={<LifeBuoy className="h-4 w-4" />} title="Support desk" detail="Contact message ও customer support ticket" />
              <WorkspaceLink href="/admin/ai-messenger" icon={<Bot className="h-4 w-4" />} title="AI Messenger" detail="Messenger conversation ও human handoff queue" />
            </div>
          </section>
          <section className="rounded-2xl border border-primary/15 bg-primary/[.035] p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">CRM workspace</p>
            <h2 className="mt-1 font-extrabold">Customer কাজ এক জায়গায় রাখুন</h2>
            <div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
              <p>Customer directory থেকে internal note, tag এবং follow-up যোগ করুন।</p>
              <p>Follow-up page-এ due task complete বা cancel করুন।</p>
              <p>Saved segment-এ repeat, one-time, inactive ও চলমান order customer group সংরক্ষণ করুন।</p>
              <p className="text-xs">Customer detail-এ order, support ticket, note ও follow-up timeline search/filter করুন। Messenger conversation AI Messenger page-এ থাকে।</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">{icon}<span>{label}</span></div><p className="mt-3 text-3xl font-black tracking-tight text-foreground">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></article>;
}

function WorkspaceLink({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:border-primary/30 hover:bg-primary/[.025] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground transition group-hover:bg-primary/10 group-hover:text-primary">{icon}</span><span className="min-w-0 flex-1"><span className="block font-bold text-foreground">{title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{detail}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" /></Link>;
}

