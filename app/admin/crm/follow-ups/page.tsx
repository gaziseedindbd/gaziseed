'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Clock3, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { aggregateCustomers, type CustomerRow, type OrderSummary } from '@/lib/admin/customer-aggregation';
import { makeCrmCustomerKey } from '@/lib/admin/crm-customer-key';

type Branch = 'BD' | 'IN';
type Task = { id: string; customer_key: string; title: string; due_at: string; priority: 'low' | 'normal' | 'high'; status: 'open' | 'completed' | 'cancelled'; created_at: string; assigned_to: string | null };
type TaskFilter = 'open' | 'overdue' | 'today' | 'upcoming' | 'completed' | 'all';
type AdminAssignee = { user_id: string; display_name: string };
const PAGE_SIZE = 1000;

async function loadOrders(branch: Branch) {
  const orders: OrderSummary[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from('orders').select('id,order_number,user_id,customer_name,customer_phone,customer_email,status,grand_total,created_at').eq('country_code', branch).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('অর্ডারের customer তথ্য লোড করা যায়নি।');
    const batch = (data || []) as OrderSummary[];
    orders.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return orders;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function localDayBounds(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const next = new Date(start); next.setDate(next.getDate() + 1);
  return { start: start.getTime(), next: next.getTime() };
}

export default function CrmFollowUpsPage() {
  const searchParams = useSearchParams();
  const customerFilter = searchParams.get('customer') || '';
  const initialFilter = searchParams.get('filter');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [assigneeNames, setAssigneeNames] = useState<Map<string, string>>(new Map());
  const [currentUserId, setCurrentUserId] = useState('');
  const [filter, setFilter] = useState<TaskFilter>(initialFilter === 'overdue' || initialFilter === 'today' || initialFilter === 'upcoming' ? initialFilter : 'open');
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: country, error: branchError } = await supabase.rpc('current_admin_country');
      const code = String(country || '').toUpperCase();
      if (branchError || (code !== 'BD' && code !== 'IN')) throw new Error('Admin branch নিশ্চিত করা যায়নি।');
      const currentBranch = code as Branch;
      let taskQuery = supabase.from('crm_follow_up_tasks').select('id,customer_key,title,due_at,priority,status,created_at,assigned_to').eq('country_code', currentBranch).order('created_at', { ascending: false }).limit(500);
      if (customerFilter) taskQuery = taskQuery.eq('customer_key', customerFilter);
      const [{ data: taskData, error: taskError }, orders, { data: adminData, error: adminError }, { data: authData }] = await Promise.all([
        taskQuery,
        loadOrders(currentBranch),
        supabase.rpc('crm_branch_admins'),
        supabase.auth.getUser(),
      ]);
      if (taskError) throw new Error('Follow-up task লোড করা যায়নি। CRM migration প্রয়োগ হয়েছে কি না দেখুন।');
      if (adminError) throw new Error('Branch admin-এর তালিকা লোড করা যায়নি।');
      const ids = Array.from(new Set(orders.map((order) => order.user_id).filter((id): id is string => Boolean(id))));
      const internal = new Set<string>();
      for (let from = 0; from < ids.length; from += 100) {
        const { data, error: adminError } = await supabase.from('admin_users').select('user_id').in('user_id', ids.slice(from, from + 100));
        if (adminError) throw new Error('Customer পরিচয় যাচাই করা যায়নি।');
        for (const row of data || []) internal.add(row.user_id);
      }
      const customers: CustomerRow[] = aggregateCustomers(orders, internal).filter((customer) => customer.type !== 'order_only');
      const entries = await Promise.all(customers.map(async (customer) => [await makeCrmCustomerKey(customer.user_id, customer.phone, customer.orders[0]?.id), customer.name || customer.phone || 'Customer'] as const));
      const customerNames = new Map<string, string>();
      for (const [key, label] of entries) if (key) customerNames.set(key, label);
      setAssigneeNames(new Map(((adminData || []) as AdminAssignee[]).map((admin) => [admin.user_id, admin.display_name])));
      setCurrentUserId(authData.user?.id || '');
      setNames(customerNames);
      const orderedTasks = ((taskData || []) as Task[]).sort((left, right) => {
        if (left.status !== right.status) return left.status === 'open' ? -1 : right.status === 'open' ? 1 : 0;
        return left.status === 'open'
          ? new Date(left.due_at).getTime() - new Date(right.due_at).getTime()
          : new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
      setTasks(orderedTasks); setBranch(currentBranch);
    } catch (loadError) {
      setTasks([]); setError(loadError instanceof Error ? loadError.message : 'Follow-up লোড করা যায়নি।');
    } finally { setLoading(false); }
  }, [customerFilter]);

  useEffect(() => { void load(); }, [load]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status === 'open'), [tasks]);
  const { start: todayStart, next: tomorrowStart } = localDayBounds();
  const overdueTasks = openTasks.filter((task) => new Date(task.due_at).getTime() < todayStart);
  const dueTodayTasks = openTasks.filter((task) => new Date(task.due_at).getTime() >= todayStart && new Date(task.due_at).getTime() < tomorrowStart);
  const filteredTasks = tasks.filter((task) => {
    const due = new Date(task.due_at).getTime();
    if (mineOnly && task.assigned_to !== currentUserId) return false;
    if (filter === 'open') return task.status === 'open';
    if (filter === 'overdue') return task.status === 'open' && due < todayStart;
    if (filter === 'today') return task.status === 'open' && due >= todayStart && due < tomorrowStart;
    if (filter === 'upcoming') return task.status === 'open' && due >= tomorrowStart;
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const updateStatus = async (task: Task, status: 'completed' | 'cancelled') => {
    if (!branch || savingId) return;
    setSavingId(task.id); setError('');
    const { data, error: updateError } = await supabase.from('crm_follow_up_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', task.id).eq('country_code', branch).eq('status', 'open').select('id').maybeSingle();
    if (updateError || !data) setError('Task update করা যায়নি। আবার refresh করে দেখুন।');
    else setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    setSavingId('');
  };

  return <main className="mx-auto w-full max-w-6xl space-y-6 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><Link href="/admin/crm" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />CRM Dashboard</Link><p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-primary">Customer follow-up</p><h1 className="mt-1 text-3xl font-black">Follow-up tasks</h1><p className="mt-2 text-sm text-muted-foreground">{branch === 'IN' ? 'India' : branch === 'BD' ? 'Bangladesh' : 'Branch'} branch · {openTasks.length.toLocaleString('bn-BD')}টি open task</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
    {customerFilter && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">একজন customer-এর task দেখানো হচ্ছে। <Link href="/admin/crm/follow-ups" className="ml-2 font-bold text-primary underline">সব task দেখুন</Link></div>}
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    <section aria-label="Task reminders" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {([
        ['overdue', 'Overdue', overdueTasks.length, 'bg-rose-50 text-rose-800 border-rose-200'],
        ['today', 'আজ due', dueTodayTasks.length, 'bg-amber-50 text-amber-900 border-amber-200'],
        ['upcoming', 'পরের দিনগুলো', openTasks.filter((task) => new Date(task.due_at).getTime() >= tomorrowStart).length, 'bg-sky-50 text-sky-900 border-sky-200'],
        ['completed', 'সম্পন্ন', tasks.filter((task) => task.status === 'completed').length, 'bg-emerald-50 text-emerald-900 border-emerald-200'],
      ] as [TaskFilter,string,number,string][]).map(([key,label,count,style]) => <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${style} ${filter === key ? 'ring-2 ring-primary/30' : ''}`}><span className="block text-xs font-bold">{label}</span><span className="mt-1 block text-2xl font-black">{loading ? '—' : count.toLocaleString('bn-BD')}</span></button>)}
    </section>
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3"><div className="flex flex-wrap gap-1.5">{([['open','Open'],['overdue','Overdue'],['today','আজ'],['upcoming','আসছে'],['completed','সম্পন্ন'],['all','সব']] as [TaskFilter,string][]).map(([key,label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`min-h-8 rounded-lg px-2.5 text-xs font-bold ${filter === key ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-secondary'}`}>{label}</button>)}</div><button type="button" aria-pressed={mineOnly} onClick={() => setMineOnly((value) => !value)} className={`min-h-8 rounded-lg px-3 text-xs font-bold ${mineOnly ? 'bg-primary/10 text-primary' : 'border border-border text-muted-foreground hover:bg-secondary'}`}>শুধু আমার task</button></div>
      {loading ? <div className="p-8 text-sm text-muted-foreground">Follow-up লোড হচ্ছে…</div> : filteredTasks.length ? <div className="divide-y divide-border">{filteredTasks.map((task) => {
        const isOverdue = task.status === 'open' && new Date(task.due_at).getTime() < todayStart;
        return <article key={task.id} className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOverdue ? 'bg-rose-100 text-rose-800' : task.status === 'open' ? 'bg-amber-100 text-amber-800' : task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-secondary text-muted-foreground'}`}><Clock3 className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><p className="font-bold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{names.get(task.customer_key) || 'Customer'} · Due {dateLabel(task.due_at)} · {assigneeNames.get(task.assigned_to || '') || (task.assigned_to === currentUserId ? 'আমি' : 'অ্যাডমিন')} · {task.priority === 'high' ? 'জরুরি' : task.priority === 'low' ? 'কম priority' : 'স্বাভাবিক'}</p></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-secondary'}`}>{isOverdue ? 'Overdue' : task.status === 'open' ? 'Open' : task.status === 'completed' ? 'Completed' : 'Cancelled'}</span>
        {task.status === 'open' && <div className="flex gap-2"><button onClick={() => void updateStatus(task, 'completed')} disabled={savingId === task.id} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"><Check className="h-3.5 w-3.5" />Complete</button><button onClick={() => void updateStatus(task, 'cancelled')} disabled={savingId === task.id} className="min-h-9 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-50">Cancel</button></div>}
      </article>})}</div> : <div className="p-10 text-center"><Clock3 className="mx-auto h-9 w-9 text-muted-foreground/50" /><h2 className="mt-3 font-bold">এই filter-এ task নেই</h2><p className="mt-1 text-sm text-muted-foreground">Filter বদলান, অথবা customer detail থেকে নতুন follow-up তৈরি করুন।</p><Link href="/admin/customers" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Customer directory</Link></div>}
    </section>
  </main>;
}
