'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type Branch = 'BD' | 'IN';
type Recipient = { id: string; name: string; orders: number };

export default function CrmMessagesPage() {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data: country, error: branchError } = await supabase.rpc('current_admin_country');
        if (branchError || (country !== 'BD' && country !== 'IN')) throw new Error('Admin branch যাচাই করা যায়নি।');
        const activeBranch = country as Branch;
        const { data: audience, error: audienceError } = await supabase.rpc('crm_branch_message_recipients', { p_country_code: activeBranch });
        if (audienceError) throw new Error('Eligible registered customer তালিকা যাচাই করা যায়নি। নিরাপত্তার জন্য recipient তালিকা বন্ধ রাখা হয়েছে.');
        if (!alive) return;
        setBranch(activeBranch);
        const eligibleRecipients: Recipient[] = (audience || []).map((recipient: { user_id: string; display_name: string }) => ({ id: recipient.user_id, name: recipient.display_name, orders: 0 }));
        setRecipients(eligibleRecipients.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Customer তালিকা লোড করা যায়নি।');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const eligible = useMemo(() => recipients.map((r) => r.id), [recipients]);
  const send = async () => {
    setError(''); setNotice('');
    if (!branch || !title.trim() || !body.trim() || eligible.length === 0) return;
    if (!window.confirm(`${eligible.length} জন registered customer-এর account inbox-এ এই message পাঠাবেন? এটি WhatsApp বা email-এ যাবে না।`)) return;
    setSending(true);
    const { data, error: sendError } = await supabase.rpc('crm_send_customer_message', {
      p_country_code: branch, p_title: title.trim(), p_body: body.trim(), p_user_ids: eligible,
    });
    setSending(false);
    if (sendError) { setError(sendError.message || 'Message পাঠানো যায়নি।'); return; }
    const result = Array.isArray(data) ? data[0] : data;
    setNotice(`${Number(result?.delivered_count || 0).toLocaleString('bn-BD')} জনের account inbox-এ message পাঠানো হয়েছে।`);
    setTitle(''); setBody('');
  };

  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <div><Link href="/admin/crm" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4"/> CRM Dashboard</Link><p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">Customer inbox</p><h1 className="mt-1 text-3xl font-black">Account message পাঠান</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Registered customer-রা login করে তাদের GAZI SEED account dashboard-এর Messages tab-এ এটি দেখবেন। WhatsApp বা email পাঠানো হবে না।</p></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <label className="block text-sm font-bold">Message title<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 font-normal" placeholder="যেমন: এই সপ্তাহের বিশেষ অফার"/></label>
        <label className="block text-sm font-bold">Message<textarea value={body} maxLength={2000} rows={7} onChange={(e) => setBody(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal" placeholder="Offer-এর বিস্তারিত লিখুন…"/></label>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-bold text-primary">Preview</p><h2 className="mt-2 font-extrabold">{title || 'Message title'}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{body || 'আপনার লেখা message এখানে দেখা যাবে।'}</p></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <button type="button" onClick={() => void send()} disabled={loading || sending || !title.trim() || !body.trim() || eligible.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}{sending ? 'পাঠানো হচ্ছে…' : `${eligible.length.toLocaleString('bn-BD')} জনকে account inbox-এ পাঠান`}</button>
      </section>
      <aside className="h-fit rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary"/><h2 className="font-extrabold">Recipient</h2></div><p className="mt-2 text-3xl font-black">{loading ? '—' : recipients.length.toLocaleString('bn-BD')}</p><p className="text-sm text-muted-foreground">{branch === 'IN' ? 'India' : branch === 'BD' ? 'Bangladesh' : 'বর্তমান'} branch-এর valid registered customer, যাদের ওই branch-এ order আছে। Admin ও account-বিহীন order বাদ।</p><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">পাঠানোর আগে preview ও recipient সংখ্যা যাচাই করুন। Send করলে নির্বাচিত customer-দের account inbox-এ message সঙ্গে সঙ্গে যোগ হবে।</p></aside>
    </div>
  </div>;
}
