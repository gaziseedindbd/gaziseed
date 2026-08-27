'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Check, X, Trash2, MessageCircle, Star, Edit, Loader2 } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingReply, setEditingReply] = useState<string | null>(null);

  useEffect(() => { loadReviews(); }, []);

  const loadReviews = async () => {
    const { data } = await supabase.from('reviews').select('*, products(name_bn, name_en)').order('created_at', { ascending: false });
    setReviews(data || []);
    setLoading(false);
  };

  const approve = async (id: string) => {
    await supabase.from('reviews').update({ is_approved: true, status: 'approved' }).eq('id', id);
    toast('রিভিউ অনুমোদিত');
    loadReviews();
  };

  const reject = async (id: string) => {
    await supabase.from('reviews').update({ is_approved: false, status: 'rejected' }).eq('id', id);
    toast('রিভিউ অননুমোদিত');
    loadReviews();
  };

  const remove = async (id: string) => {
    if (!confirm('রিভিউ মুছতে চান?')) return;
    await supabase.from('reviews').delete().eq('id', id);
    toast('রিভিউ মুছে ফেলা হয়েছে');
    loadReviews();
  };

  const saveReply = async (id: string) => {
    if (!replyText.trim()) { toast('উত্তর লিখুন', 'error'); return; }
    await supabase.from('reviews').update({ admin_reply: replyText.trim() }).eq('id', id);
    toast('উত্তর সংরক্ষিত হয়েছে');
    setReplyingTo(null);
    setEditingReply(null);
    setReplyText('');
    loadReviews();
  };

  const deleteReply = async (id: string) => {
    await supabase.from('reviews').update({ admin_reply: null }).eq('id', id);
    toast('উত্তর মুছে ফেলা হয়েছে');
    loadReviews();
  };

  const startEditReply = (r: any) => {
    setEditingReply(r.id);
    setReplyText(r.admin_reply || '');
    setReplyingTo(r.id);
  };

  const filtered = filter === 'all' ? reviews : reviews.filter((r) => (r.status || (r.is_approved ? 'approved' : 'pending')) === filter);

  const statusBadge = (r: any) => {
    const status = r.status || (r.is_approved ? 'approved' : 'pending');
    const map: Record<string, string> = { pending: 'bg-orange-100 text-orange-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };
    const labels: Record<string, string> = { pending: 'অপেক্ষমাণ', approved: 'অনুমোদিত', rejected: 'অননুমোদিত' };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>{labels[status]}</span>;
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">রিভিউ</h1>

      <div className="mb-4 flex gap-2">
        {[
          { key: 'all', label: 'সব' },
          { key: 'pending', label: 'অপেক্ষমাণ' },
          { key: 'approved', label: 'অনুমোদিত' },
          { key: 'rejected', label: 'অননুমোদিত' },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f.key ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:bg-secondary'}`}>
            {f.label} {f.key !== 'all' && `(${reviews.filter((r) => (r.status || (r.is_approved ? 'approved' : 'pending')) === f.key).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.customer_name}</p>
                  <span className="flex gap-0.5">
                    {[1,2,3,4,5].map((s) => <Star key={s} className={`h-4 w-4 ${r.rating >= s ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />)}
                  </span>
                  {r.verified_purchase && <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"><Check className="h-3 w-3" /> Verified</span>}
                  {statusBadge(r)}
                </div>
                {r.products && <p className="text-xs text-muted-foreground">প্রোডাক্ট: {r.products.name_bn || r.products.name_en}</p>}
                <p className="mt-1 text-sm text-muted-foreground">{r.review}</p>
                {r.photo && <img src={r.photo} alt="" className="mt-2 h-20 w-20 rounded-lg border border-border object-cover" />}
                <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('bn-BD')}</p>

                {r.admin_reply && (
                  <div className="mt-3 rounded-xl border-l-4 border-primary bg-primary/5 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-primary">SEED BARI-এর উত্তর:</p>
                      <div className="flex gap-1">
                        <button onClick={() => startEditReply(r)} className="rounded p-1 hover:bg-secondary"><Edit className="h-3 w-3" /></button>
                        <button onClick={() => deleteReply(r.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.admin_reply}</p>
                  </div>
                )}

                {replyingTo === r.id && (
                  <div className="mt-3 rounded-xl border border-border bg-secondary/10 p-3">
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="input-bangla min-h-[60px]" placeholder="SEED BARI-এর উত্তর লিখুন..." />
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => saveReply(r.id)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{editingReply ? 'আপডেট' : 'সংরক্ষণ'}</button>
                      <button onClick={() => { setReplyingTo(null); setEditingReply(null); setReplyText(''); }} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">বাতিল</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {(r.status || (r.is_approved ? 'approved' : 'pending')) !== 'approved' && (
                  <button onClick={() => approve(r.id)} className="rounded-lg p-2 text-green-600 hover:bg-green-50" title="অনুমোদন"><Check className="h-4 w-4" /></button>
                )}
                {(r.status || (r.is_approved ? 'approved' : 'pending')) === 'approved' && (
                  <button onClick={() => reject(r.id)} className="rounded-lg p-2 text-orange-600 hover:bg-orange-50" title="অননুমোদন"><X className="h-4 w-4" /></button>
                )}
                {replyingTo !== r.id && (
                  <button onClick={() => { setReplyingTo(r.id); setEditingReply(null); setReplyText(''); }} className="rounded-lg p-2 text-primary hover:bg-primary/10" title="উত্তর দিন"><MessageCircle className="h-4 w-4" /></button>
                )}
                <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title="মুছুন"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন রিভিউ নেই</p>}
      </div>
    </div>
  );
}
