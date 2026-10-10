'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type AuditEntry = {
  id: string; created_at: string; actor_type: 'admin' | 'system'; actor_id: string | null;
  event_type: string; outcome: 'success' | 'blocked' | 'started'; details: Record<string, unknown>;
};
const labels: Record<string, string> = {
  verification: 'পেমেন্ট যাচাই', dispatch: 'ডিসপ্যাচ', payment_completed: 'পেমেন্ট থেকে অর্ডার তৈরি',
  recovery_attempt: 'Recovery শুরু', recovery_failed: 'Recovery স্থগিত', recovery_completed: 'Recovery সম্পন্ন',
  cod_due_collected: 'COD বাকি সংগ্রহ',
};
const outcomes = { success: 'সফল', blocked: 'স্থগিত', started: 'শুরু' };

export function PaymentAuditPanel({ orderId, refreshKey }: { orderId: string; refreshKey: number }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [reload, setReload] = useState(0);
  const [cursor, setCursor] = useState<{ created_at: string; id: string } | null>(null);

  useEffect(() => { setCursor(null); setEntries([]); }, [orderId, refreshKey, reload]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const { data, error: queryError } = await supabase.rpc('get_order_payment_audit', {
          p_order_id: orderId, p_before_at: cursor?.created_at ?? null, p_before_id: cursor?.id ?? null,
        });
        if (!active) return;
        if (queryError) throw queryError;
        const rows = (data ?? []) as AuditEntry[];
        setEntries(previous => cursor ? [...previous, ...rows.filter(row => !previous.some(entry => entry.id === row.id))] : rows);
        setHasMore(rows.length === 50);
      } catch {
        if (active) setError('পেমেন্ট ইতিহাস লোড হয়নি। আবার চেষ্টা করুন।');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [orderId, refreshKey, reload, cursor]);

  return (
    <section className="rounded-xl border border-border p-3 sm:p-4" aria-label="Payment Audit Log">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Payment Audit Log</h3>
        <button type="button" disabled={loading} onClick={() => setReload(value => value + 1)} className="text-xs font-semibold text-primary disabled:opacity-50">রিফ্রেশ</button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">নতুন audit ব্যবস্থা চালুর পরের কার্যক্রম এখানে দেখা যাবে। সময় India সময় অনুযায়ী।</p>
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
      {!loading && !error && entries.length === 0 && <p className="mt-3 text-xs text-muted-foreground">এই অর্ডারে এখনও কোনো payment audit রেকর্ড নেই।</p>}
      <ol className="mt-3 max-h-72 space-y-3 overflow-y-auto">
        {entries.map(entry => (
          <li key={entry.id} className="rounded-lg bg-secondary/50 p-2.5 text-xs">
            <div className="flex justify-between gap-2"><span className="font-semibold">{labels[entry.event_type] ?? entry.event_type}</span><span className={entry.outcome === 'blocked' ? 'text-orange-700' : 'text-muted-foreground'}>{outcomes[entry.outcome]}</span></div>
            <time dateTime={entry.created_at} className="mt-1 block text-muted-foreground">{new Date(entry.created_at).toLocaleString('bn-IN', { timeZone: 'Asia/Kolkata' })} IST</time>
            <p className="mt-1 break-all">{entry.actor_type === 'system' ? 'স্বয়ংক্রিয় ব্যবস্থা' : `Admin ID: ${entry.actor_id}`}</p>
            {typeof entry.details.reason === 'string' && <p className="mt-1 break-words text-orange-700">{entry.details.reason}</p>}
            {(['verified_amount', 'amount', 'amount_collected', 'advance_amount', 'due_amount'] as const).map(key => (
              typeof entry.details[key] === 'number' && <span key={key} className="mr-3 mt-1 inline-block">{{ verified_amount: 'যাচাইকৃত', amount: 'পেমেন্ট', amount_collected: 'সংগৃহীত', advance_amount: 'অগ্রিম', due_amount: 'বাকি' }[key]}: ₹ {Number(entry.details[key]).toLocaleString('en-IN')}</span>
            ))}
          </li>
        ))}
      </ol>
      {loading && <p role="status" className="mt-3 text-xs text-muted-foreground">ইতিহাস লোড হচ্ছে...</p>}
      {hasMore && !loading && !error && <button type="button" onClick={() => { const last = entries.at(-1); if (last) setCursor({ created_at: last.created_at, id: last.id }); }} className="mt-3 text-xs font-semibold text-primary">আগের রেকর্ড দেখুন</button>}
    </section>
  );
}
