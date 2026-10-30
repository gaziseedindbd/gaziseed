'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Clock3, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { aggregateCustomers, type CustomerRow, type OrderSummary } from '@/lib/admin/customer-aggregation';
import { makeCrmCustomerKey } from '@/lib/admin/crm-customer-key';

type Branch = 'BD' | 'IN';
type Task = { id: string; customer_key: string; title: string; due_at: string; priority: 'low' | 'normal' | 'high'; status: 'open' | 'completed' | 'cancelled'; created_at: string };
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

export default function CrmFollowUpsPage() {
  const searchParams = useSearchParams();
  const customerFilter = searchParams.get('customer') || '';
  const [branch, setBranch] = useState<Branch | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
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
      let taskQuery = supabase.from('crm_follow_up_tasks').select('id,customer_key,title,due_at,priority,status,created_at').eq('country_code', currentBranch).order('created_at', { ascending: false }).limit(500);
      if (customerFilter) taskQuery = taskQuery.eq('customer_key', customerFilter);
      const [{ data: taskData, error: taskError }, orders] = await Promise.all([taskQuery, loadOrders(currentBranch)]);
      if (taskError) throw new Error('Follow-up task লোড করা যায়নি। CRM migration প্রয়োগ হয়েছে কি না দেখুন।');
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {loading ? <div className="p-8 text-sm text-muted-foreground">Follow-up লোড হচ্ছে…</div> : tasks.length ? <div className="divide-y divide-border">{tasks.map((task) => <article key={task.id} className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${task.status === 'open' ? 'bg-amber-100 text-amber-800' : task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-secondary text-muted-foreground'}`}><Clock3 className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><p className="font-bold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{names.get(task.customer_key) || 'Customer'} · Due {dateLabel(task.due_at)} · {task.priority === 'high' ? 'জরুরি' : task.priority === 'low' ? 'কম priority' : 'স্বাভাবিক'}</p></div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">{task.status === 'open' ? 'Open' : task.status === 'completed' ? 'Completed' : 'Cancelled'}</span>
        {task.status === 'open' && <div className="flex gap-2"><button onClick={() => void updateStatus(task, 'completed')} disabled={savingId === task.id} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"><Check className="h-3.5 w-3.5" />Complete</button><button onClick={() => void updateStatus(task, 'cancelled')} disabled={savingId === task.id} className="min-h-9 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-50">Cancel</button></div>}
      </article>)}</div> : <div className="p-10 text-center"><Clock3 className="mx-auto h-9 w-9 text-muted-foreground/50" /><h2 className="mt-3 font-bold">কোনো follow-up task নেই</h2><p className="mt-1 text-sm text-muted-foreground">Customer directory-তে customer খুলে follow-up তৈরি করুন।</p><Link href="/admin/customers" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Customer directory</Link></div>}
    </section>
  </main>;
}
