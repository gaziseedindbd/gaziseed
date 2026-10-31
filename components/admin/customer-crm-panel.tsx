'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, Loader2, Plus, Tag, Trash2, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { makeCrmCustomerKey } from '@/lib/admin/crm-customer-key';
import type { OrderSummary } from '@/lib/admin/customer-aggregation';

type Branch = 'BD' | 'IN';
type Note = { id: string; note: string; created_at: string };
type CustomerTag = { id: string; tag: string; created_at: string };
type FollowUpTask = { id: string; title: string; due_at: string; priority: string; status: string; created_at: string; assigned_to: string | null };
type AdminAssignee = { user_id: string; display_name: string };
type SupportActivity = { id: string; subject: string; message: string; status: string | null; created_at: string };
type TimelineKind = 'all' | 'order' | 'support' | 'note' | 'task';

type Props = {
  branch: Branch;
  userId?: string | null;
  phone?: string | null;
  orderId?: string | null;
  orders?: OrderSummary[];
};

function defaultDueInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function CustomerCrmPanel({ branch, userId, phone, orderId, orders = [] }: Props) {
  const [customerKey, setCustomerKey] = useState('');
  const customerKeyRef = useRef('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [assignees, setAssignees] = useState<AdminAssignee[]>([]);
  const [supportActivity, setSupportActivity] = useState<SupportActivity[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [taskDueAt, setTaskDueAt] = useState(defaultDueInput);
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<TimelineKind>('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCustomerCrmData = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    const phoneValues = Array.from(new Set([phone, ...orders.map((order) => order.customer_phone)].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))).slice(0, 50);
    const [notesResult, tagsResult, tasksResult, supportResult, assigneesResult] = await Promise.all([
      supabase.from('crm_customer_notes').select('id,note,created_at').eq('country_code', branch).eq('customer_key', key).order('created_at', { ascending: false }).limit(20),
      supabase.from('crm_customer_tags').select('id,tag,created_at').eq('country_code', branch).eq('customer_key', key).order('created_at', { ascending: false }),
      supabase.from('crm_follow_up_tasks').select('id,title,due_at,priority,status,created_at,assigned_to').eq('country_code', branch).eq('customer_key', key).order('created_at', { ascending: false }).limit(10),
      phoneValues.length ? supabase.from('support_tickets').select('id,subject,message,status,created_at').eq('country_code', branch).in('customer_phone', phoneValues).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
      supabase.rpc('crm_branch_admins'),
    ]);
    const failure = notesResult.error || tagsResult.error || tasksResult.error || assigneesResult.error;
    if (customerKeyRef.current !== key) return;
    if (failure) {
      setError('CRM তথ্য লোড করা যায়নি। Branch access যাচাই করে আবার চেষ্টা করুন।');
    } else {
      setNotes((notesResult.data || []) as Note[]);
      setTags((tagsResult.data || []) as CustomerTag[]);
      setTasks((tasksResult.data || []) as FollowUpTask[]);
      const availableAssignees = (assigneesResult.data || []) as AdminAssignee[];
      setAssignees(availableAssignees);
      const { data: authData } = await supabase.auth.getUser();
      setTaskAssignee((current) => current && availableAssignees.some((admin) => admin.user_id === current)
        ? current
        : availableAssignees.find((admin) => admin.user_id === authData.user?.id)?.user_id || availableAssignees[0]?.user_id || '');
      setSupportActivity(supportResult.error ? [] : (supportResult.data || []) as SupportActivity[]);
    }
    setLoading(false);
  }, [branch]);

  useEffect(() => {
    let current = true;
    customerKeyRef.current = '';
    setCustomerKey('');
    setNotes([]);
    setTags([]);
    setTasks([]);
    setAssignees([]);
    setSupportActivity([]);
    setLoading(true);
    setError('');
    void makeCrmCustomerKey(userId, phone, orderId).then((key) => {
      if (!current) return;
      if (!key) {
        setError('এই customer-এর জন্য নিরাপদ identity key পাওয়া যায়নি।');
        setLoading(false);
        return;
      }
      customerKeyRef.current = key;
      setCustomerKey(key);
      void loadCustomerCrmData(key);
    }).catch(() => {
      if (!current) return;
      setError('নিরাপদ customer identity তৈরি করা যায়নি।');
      setLoading(false);
    });
    return () => { current = false; customerKeyRef.current = ''; };
  }, [userId, phone, orderId, loadCustomerCrmData]);

  const openTaskCount = tasks.length;
  const customerLink = useMemo(() => customerKey ? `/admin/crm/follow-ups?customer=${encodeURIComponent(customerKey)}` : '/admin/crm/follow-ups', [customerKey]);

  const saveNote = async (event: FormEvent) => {
    event.preventDefault();
    const note = noteDraft.trim();
    if (!customerKey || !note || saving) return;
    setSaving(true); setError(''); setNotice('');
    const { data: authData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from('crm_customer_notes').insert({ country_code: branch, customer_key: customerKey, note, created_by: authData.user?.id || null });
    if (insertError) setError('নোট সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।');
    else { setNoteDraft(''); setNotice('নোট সংরক্ষণ হয়েছে।'); await loadCustomerCrmData(customerKey); }
    setSaving(false);
  };

  const addTag = async (event: FormEvent) => {
    event.preventDefault();
    const tag = tagDraft.trim().replace(/\s+/g, ' ');
    if (!customerKey || !tag || saving) return;
    setSaving(true); setError(''); setNotice('');
    const { data: authData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from('crm_customer_tags').insert({ country_code: branch, customer_key: customerKey, tag, created_by: authData.user?.id || null });
    if (insertError) setError(insertError.code === '23505' ? 'এই tag আগে থেকেই আছে।' : 'Tag সংরক্ষণ করা যায়নি।');
    else { setTagDraft(''); setNotice('Tag যোগ হয়েছে।'); await loadCustomerCrmData(customerKey); }
    setSaving(false);
  };

  const removeTag = async (id: string) => {
    if (!customerKey || saving) return;
    setSaving(true); setError(''); setNotice('');
    const { error: deleteError } = await supabase.from('crm_customer_tags').delete().eq('id', id).eq('country_code', branch).eq('customer_key', customerKey);
    if (deleteError) setError('Tag সরানো যায়নি।');
    else { setTags((current) => current.filter((tag) => tag.id !== id)); setNotice('Tag সরানো হয়েছে।'); }
    setSaving(false);
  };

  const addTask = async (event: FormEvent) => {
    event.preventDefault();
    const title = taskDraft.trim();
    if (!customerKey || !title || !taskDueAt || saving) return;
    setSaving(true); setError(''); setNotice('');
    const { data: authData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from('crm_follow_up_tasks').insert({
      country_code: branch,
      customer_key: customerKey,
      title,
      due_at: new Date(taskDueAt).toISOString(),
      priority: taskPriority,
      assigned_to: taskAssignee || authData.user?.id || null,
      created_by: authData.user?.id || null,
    });
    if (insertError) setError('Follow-up task সংরক্ষণ করা যায়নি।');
    else { setTaskDraft(''); setNotice('Follow-up task তৈরি হয়েছে।'); await loadCustomerCrmData(customerKey); }
    setSaving(false);
  };

  const completeTask = async (taskId: string) => {
    if (!customerKey || saving) return;
    setSaving(true); setError(''); setNotice('');
    const { data, error: updateError } = await supabase.from('crm_follow_up_tasks').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', taskId).eq('country_code', branch).eq('customer_key', customerKey).eq('status', 'open').select('id').maybeSingle();
    if (updateError || !data) setError('Task complete করা যায়নি। আবার refresh করে দেখুন।');
    else { setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status: 'completed' } : task)); setNotice('Follow-up complete হয়েছে।'); }
    setSaving(false);
  };

  const timeline = useMemo(() => [
    ...orders.map((order) => ({ id: `order-${order.id}`, kind: 'order' as const, title: `অর্ডার ${order.order_number || order.id.slice(0, 8)}`, detail: order.status || 'স্ট্যাটাস নেই', at: order.created_at })),
    ...supportActivity.map((ticket) => ({ id: `support-${ticket.id}`, kind: 'support' as const, title: `Support · ${ticket.subject}`, detail: ticket.status ? `${ticket.status} · ${ticket.message}` : ticket.message, at: ticket.created_at })),
    ...notes.map((note) => ({ id: `note-${note.id}`, kind: 'note' as const, title: 'Internal note', detail: note.note, at: note.created_at })),
    ...tasks.map((task) => ({ id: `task-${task.id}`, kind: 'task' as const, title: task.title, detail: task.status === 'completed' ? 'Follow-up সম্পন্ন' : task.status === 'cancelled' ? 'Follow-up বাতিল' : `Follow-up · due ${formatDate(task.due_at)}`, at: task.created_at })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()).slice(0, 20), [orders, supportActivity, notes, tasks]);
  const visibleTimeline = useMemo(() => {
    const query = timelineSearch.trim().toLocaleLowerCase();
    return timeline.filter((item) => (timelineFilter === 'all' || item.kind === timelineFilter)
      && (!query || `${item.title} ${item.detail}`.toLocaleLowerCase().includes(query)));
  }, [timeline, timelineFilter, timelineSearch]);

  return <section aria-label="Customer CRM tools" className="rounded-2xl border border-primary/20 bg-primary/[.025] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">CRM workspace</p><h3 className="mt-1 text-base font-extrabold text-foreground">Notes, tags & follow-ups</h3></div>
      <Link href={customerLink} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-bold transition hover:bg-secondary">সব follow-up <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /><span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">{openTaskCount.toLocaleString('bn-BD')}</span></Link>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{notice}</p>}
    {loading ? <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />CRM তথ্য লোড হচ্ছে…</div>
      : customerKey ? <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-3">
          <h4 className="text-sm font-bold">Internal notes</h4>
          <form onSubmit={saveNote} className="mt-2 space-y-2"><label htmlFor={`crm-note-${customerKey}`} className="sr-only">কাস্টমার নোট লিখুন</label><textarea id={`crm-note-${customerKey}`} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={5000} rows={2} placeholder="শুধু team-এর জন্য নোট…" className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><button type="submit" disabled={saving || !noteDraft.trim()} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"><Plus className="h-3.5 w-3.5" aria-hidden="true" />নোট যোগ করুন</button></form>
          <div className="mt-3 max-h-36 space-y-2 overflow-y-auto">{notes.map((note) => <article key={note.id} className="rounded-lg bg-secondary/50 p-2.5"><p className="whitespace-pre-wrap text-xs leading-5 text-foreground">{note.note}</p><time className="mt-1 block text-[10px] text-muted-foreground">{formatDate(note.created_at)}</time></article>)}{!notes.length && <p className="text-xs text-muted-foreground">এখনও কোনো note নেই।</p>}</div>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <h4 className="flex items-center gap-2 text-sm font-bold"><Tag className="h-4 w-4 text-primary" aria-hidden="true" />Customer tags</h4>
          <form onSubmit={addTag} className="mt-2 flex gap-2"><label htmlFor={`crm-tag-${customerKey}`} className="sr-only">কাস্টমার tag</label><input id={`crm-tag-${customerKey}`} value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} maxLength={40} placeholder="যেমন: Repeat buyer" className="min-h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><button type="submit" aria-label="Tag যোগ করুন" disabled={saving || !tagDraft.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden="true" /></button></form>
          <div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">{tag.tag}<button type="button" onClick={() => void removeTag(tag.id)} disabled={saving} aria-label={`${tag.tag} tag সরান`} className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10 disabled:opacity-50"><Trash2 className="h-3 w-3" aria-hidden="true" /></button></span>)}{!tags.length && <p className="text-xs text-muted-foreground">এখনও কোনো tag নেই।</p>}</div>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <h4 className="text-sm font-bold">Follow-up task</h4>
          <form onSubmit={addTask} className="mt-2 space-y-2"><label htmlFor={`crm-task-${customerKey}`} className="sr-only">Follow-up কাজ</label><input id={`crm-task-${customerKey}`} value={taskDraft} onChange={(event) => setTaskDraft(event.target.value)} maxLength={160} placeholder="কাস্টমারকে ফোন করুন…" className="min-h-9 w-full rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><label className="block"><span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><UserRound className="h-3 w-3" aria-hidden="true" />দায়িত্বে</span><select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} className="min-h-9 w-full rounded-lg border border-border bg-card px-2 text-xs" disabled={!assignees.length}><option value="">অ্যাডমিন বাছুন</option>{assignees.map((admin) => <option key={admin.user_id} value={admin.user_id}>{admin.display_name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="min-w-0"><span className="sr-only">Due date</span><input type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} className="min-h-9 w-full rounded-lg border border-border bg-card px-2 text-[11px]" /></label><label className="min-w-0"><span className="sr-only">Priority</span><select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} className="min-h-9 w-full rounded-lg border border-border bg-card px-2 text-xs"><option value="low">কম priority</option><option value="normal">স্বাভাবিক</option><option value="high">জরুরি</option></select></label></div><button type="submit" disabled={saving || !taskDraft.trim() || !taskDueAt || !taskAssignee} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Task তৈরি করুন</button></form>
          <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">{tasks.map((task) => <article key={task.id} className="flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5">{task.status === 'open' ? <button type="button" onClick={() => void completeTask(task.id)} disabled={saving} aria-label={`${task.title} complete করুন`} className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-background text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><Check className="h-3 w-3" aria-hidden="true" /></button> : <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><Check className="h-3 w-3" aria-hidden="true" /></span>}<div className="min-w-0 flex-1"><p className="text-xs font-semibold text-foreground">{task.title}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{task.status === 'open' ? `${formatDate(task.due_at)} · ` : `${task.status === 'completed' ? 'সম্পন্ন' : 'বাতিল'} · `}{assignees.find((admin) => admin.user_id === task.assigned_to)?.display_name || 'Admin'} · {task.priority === 'high' ? 'জরুরি' : task.priority === 'low' ? 'কম priority' : 'স্বাভাবিক'}</p></div></article>)}{!tasks.length && <p className="text-xs text-muted-foreground">এখনও কোনো task নেই।</p>}</div>
      </div></div> : null}
    {!loading && customerKey && <div className="mt-4 rounded-xl border border-border bg-background p-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-primary">Customer 360°</p><h4 className="mt-1 text-sm font-extrabold">Activity timeline</h4></div><span className="text-[10px] text-muted-foreground">Order · support · note · follow-up</span></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><label className="sr-only" htmlFor={`crm-timeline-search-${customerKey}`}>Timeline খুঁজুন</label><input id={`crm-timeline-search-${customerKey}`} value={timelineSearch} onChange={(event) => setTimelineSearch(event.target.value)} placeholder="Activity খুঁজুন…" className="min-h-9 rounded-lg border border-border bg-card px-3 text-xs" /><div className="flex flex-wrap gap-1">{([['all','সব'],['order','অর্ডার'],['support','সাপোর্ট'],['note','নোট'],['task','Follow-up']] as [TimelineKind,string][]).map(([kind,label]) => <button key={kind} type="button" aria-pressed={timelineFilter === kind} onClick={() => setTimelineFilter(kind)} className={`min-h-9 rounded-lg px-2.5 text-[11px] font-bold ${timelineFilter === kind ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-secondary'}`}>{label}</button>)}</div></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{visibleTimeline.map((item) => <article key={item.id} className="flex gap-3 rounded-lg bg-secondary/40 p-2.5"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.kind === 'order' ? 'bg-blue-500' : item.kind === 'support' ? 'bg-rose-500' : item.kind === 'note' ? 'bg-violet-500' : 'bg-amber-500'}`} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-1"><p className="text-xs font-bold">{item.title}</p><time className="text-[10px] text-muted-foreground">{formatDate(item.at)}</time></div><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] leading-4 text-muted-foreground">{item.detail}</p></div></article>)}{!visibleTimeline.length && <p className="text-xs text-muted-foreground">এই filter-এ কোনো activity নেই।</p>}</div></div>}
  </section>;
}
