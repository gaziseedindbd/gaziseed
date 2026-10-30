'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { aggregateCustomers, type CustomerRow, type OrderSummary } from '@/lib/admin/customer-aggregation';

type Branch = 'BD' | 'IN';
type FilterKey = 'all' | 'repeat' | 'one_time' | 'inactive_90_days' | 'open_orders';
type Segment = { id: string; name: string; description: string | null; filter_key: FilterKey; created_at: string };
const PAGE_SIZE = 1000;
const FILTERS: { key: FilterKey; title: string; description: string }[] = [
  { key: 'all', title: 'সব customer', description: 'Branch-এর সব order-backed customer' },
  { key: 'repeat', title: 'Repeat customer', description: 'একাধিক active order আছে' },
  { key: 'one_time', title: 'একবারের customer', description: 'একটি active order আছে' },
  { key: 'inactive_90_days', title: '৯০ দিন নিষ্ক্রিয়', description: 'সর্বশেষ order ৯০ দিনের বেশি আগে' },
  { key: 'open_orders', title: 'চলমান order আছে', description: 'এক বা একাধিক order এখনো complete নয়' },
];
const CLOSED = new Set(['delivered', 'cancelled', 'canceled', 'returned', 'refunded']);

async function loadOrders(branch: Branch) {
  const orders: OrderSummary[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from('orders').select('id,order_number,user_id,customer_name,customer_phone,customer_email,status,grand_total,created_at').eq('country_code', branch).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('Customer order তথ্য লোড করা যায়নি।');
    const batch = (data || []) as OrderSummary[]; orders.push(...batch); if (batch.length < PAGE_SIZE) break;
  }
  return orders;
}

function activeOrderCount(customer: CustomerRow) { return customer.orders.filter((order) => !CLOSED.has((order.status || '').toLowerCase())).length; }

function matchesSegment(customer: CustomerRow, key: FilterKey, now: number) {
  const active = activeOrderCount(customer);
  if (key === 'repeat') return active > 1;
  if (key === 'one_time') return active === 1;
  if (key === 'open_orders') return active > 0;
  if (key === 'inactive_90_days') return now - new Date(customer.latestOrderAt).getTime() > 90 * 24 * 60 * 60 * 1000;
  return true;
}

export default function CrmSegmentsPage() {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('repeat');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const now = Date.now();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: country, error: branchError } = await supabase.rpc('current_admin_country');
      const code = String(country || '').toUpperCase();
      if (branchError || (code !== 'BD' && code !== 'IN')) throw new Error('Admin branch নিশ্চিত করা যায়নি।');
      const currentBranch = code as Branch;
      const [{ data: segmentData, error: segmentError }, orders] = await Promise.all([
        supabase.from('crm_saved_segments').select('id,name,description,filter_key,created_at').eq('country_code', currentBranch).order('created_at', { ascending: false }),
        loadOrders(currentBranch),
      ]);
      if (segmentError) throw new Error('Saved segment লোড করা যায়নি। CRM migration প্রয়োগ হয়েছে কি না দেখুন।');
      const userIds = Array.from(new Set(orders.map((order) => order.user_id).filter((id): id is string => Boolean(id))));
      const internal = new Set<string>();
      for (let from = 0; from < userIds.length; from += 100) {
        const { data, error: adminError } = await supabase.from('admin_users').select('user_id').in('user_id', userIds.slice(from, from + 100));
        if (adminError) throw new Error('Customer profile যাচাই করা যায়নি।');
        for (const row of data || []) internal.add(row.user_id);
      }
      setCustomers(aggregateCustomers(orders, internal).filter((customer) => customer.type !== 'order_only')); setSegments((segmentData || []) as Segment[]); setBranch(currentBranch);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Saved segment লোড করা যায়নি।'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((filter) => [filter.key, customers.filter((customer) => matchesSegment(customer, filter.key, now)).length])) as Record<FilterKey, number>, [customers, now]);
  const matchingCustomers = useMemo(() => customers
    .filter((customer) => matchesSegment(customer, selectedFilter, now))
    .sort((left, right) => right.latestOrderAt.localeCompare(left.latestOrderAt)), [customers, selectedFilter, now]);

  const saveSegment = async (event: FormEvent) => {
    event.preventDefault();
    const cleanedName = name.trim().replace(/\s+/g, ' ');
    if (!branch || !cleanedName || saving) return;
    setSaving(true); setError(''); setNotice('');
    const { data: authData } = await supabase.auth.getUser();
    const filter = FILTERS.find((item) => item.key === selectedFilter)!;
    const { error: insertError } = await supabase.from('crm_saved_segments').insert({ country_code: branch, name: cleanedName, description: filter.description, filter_key: selectedFilter, created_by: authData.user?.id || null });
    if (insertError) setError(insertError.code === '23505' ? 'এই নামে segment আগে থেকেই আছে।' : 'Segment save করা যায়নি।');
    else { setName(''); setNotice('Customer segment সংরক্ষণ হয়েছে।'); await load(); }
    setSaving(false);
  };

  const deleteSegment = async (segment: Segment) => {
    if (!branch || saving) return;
    setSaving(true); setError(''); setNotice('');
    const { error: deleteError } = await supabase.from('crm_saved_segments').delete().eq('id', segment.id).eq('country_code', branch);
    if (deleteError) setError('Segment মুছে ফেলা যায়নি।');
    else { setSegments((current) => current.filter((item) => item.id !== segment.id)); setNotice('Segment মুছে ফেলা হয়েছে।'); }
    setSaving(false);
  };

  return <main className="mx-auto w-full max-w-6xl space-y-6 pb-10">
    <div><Link href="/admin/crm" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />CRM Dashboard</Link><p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-primary">Customer segments</p><h1 className="mt-1 text-3xl font-black">Saved segments</h1><p className="mt-2 text-sm text-muted-foreground">{branch === 'IN' ? 'India' : branch === 'BD' ? 'Bangladesh' : 'Branch'} branch-এর order data থেকে dynamic customer group।</p></div>
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Available customer segments">{FILTERS.map((filter) => <article key={filter.key} className={`rounded-2xl border bg-card p-4 ${selectedFilter === filter.key ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border'}`}><p className="text-sm font-bold">{filter.title}</p><p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{filter.description}</p><p className="mt-3 text-2xl font-black">{loading ? '—' : counts[filter.key].toLocaleString('bn-BD')}<span className="ml-1 text-xs font-semibold text-muted-foreground">customer</span></p><button type="button" onClick={() => setSelectedFilter(filter.key)} className="mt-3 min-h-9 rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">{selectedFilter === filter.key ? 'Selected' : 'এই group বাছুন'}</button></article>)}</section>
    <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex flex-wrap items-end justify-between gap-2 border-b border-border p-4"><div><h2 className="font-extrabold">{FILTERS.find((filter) => filter.key === selectedFilter)?.title} customer</h2><p className="mt-1 text-xs text-muted-foreground">সর্বশেষ order আগে · সর্বোচ্চ ৫০টি preview</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{loading ? '—' : matchingCustomers.length.toLocaleString('bn-BD')} জন</span></div>{loading ? <p className="p-5 text-sm text-muted-foreground">Customer group লোড হচ্ছে…</p> : matchingCustomers.length ? <div className="divide-y divide-border">{matchingCustomers.slice(0, 50).map((customer) => <article key={customer.key} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{customer.name || 'নাম দেওয়া হয়নি'}</p><p className="mt-1 text-xs text-muted-foreground">{customer.type === 'registered' ? 'Registered' : customer.type === 'guest' ? 'Guest' : 'Order only'} · {customer.orders.length.toLocaleString('bn-BD')}টি মোট order</p></div><time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium' }).format(new Date(customer.latestOrderAt))}</time></article>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">এই group-এ এখনো customer নেই।</p>}</section>
    <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <form onSubmit={saveSegment} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /><h2 className="font-extrabold">Segment save করুন</h2></div><label className="mt-4 block text-xs font-bold" htmlFor="crm-segment-filter">Customer group</label><select id="crm-segment-filter" value={selectedFilter} onChange={(event) => setSelectedFilter(event.target.value as FilterKey)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">{FILTERS.map((filter) => <option key={filter.key} value={filter.key}>{filter.title} · {loading ? '—' : counts[filter.key]}</option>)}</select><label className="mt-3 block text-xs font-bold" htmlFor="crm-segment-name">Segment name</label><input id="crm-segment-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="যেমন: Repeat buyers BD" className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /><button type="submit" disabled={!branch || !name.trim() || saving} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? 'সংরক্ষণ হচ্ছে…' : 'Save segment'}</button><p className="mt-3 text-xs leading-5 text-muted-foreground">Saved segment-এ filter নিয়ম সংরক্ষিত হয়; customer list প্রতিবার বর্তমান order data থেকে হিসাব করা হয়।</p></form>
      <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border p-4"><h2 className="font-extrabold">আপনার saved segments</h2><p className="mt-1 text-xs text-muted-foreground">শুধু বর্তমান branch-এর segment</p></div>{loading ? <p className="p-5 text-sm text-muted-foreground">Segment লোড হচ্ছে…</p> : segments.length ? <div className="divide-y divide-border">{segments.map((segment) => { const filter = FILTERS.find((item) => item.key === segment.filter_key)!; return <article key={segment.id} className="flex items-center gap-3 p-4"><button type="button" onClick={() => setSelectedFilter(segment.filter_key)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold">{segment.name}</span><span className="mt-1 block text-xs text-muted-foreground">{filter.title} · বর্তমান match {counts[segment.filter_key].toLocaleString('bn-BD')} customer · দেখুন</span></button><button type="button" onClick={() => void deleteSegment(segment)} disabled={saving} aria-label={`${segment.name} segment মুছুন`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-destructive/30 hover:text-destructive disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></article>; })}</div> : <p className="p-8 text-center text-sm text-muted-foreground">এখনো কোনো saved segment নেই।</p>}</section>
    </section>
  </main>;
}
