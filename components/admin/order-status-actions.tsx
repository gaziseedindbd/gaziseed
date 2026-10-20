'use client';

import {useEffect, useRef, useState} from 'react';
import {supabase} from '@/lib/supabase/client';
import {nextOrderStatuses, ORDER_STATUS_LABELS, OrderStatus, STATUS_ACTION_LABELS, STATUS_CONFIRMATIONS,
  statusActionValid, statusReasonRequired} from '@/lib/admin-order-status';

type History = {id: string; status: string; previous_status: string | null; note: string | null;
  created_at: string | null; actor_label: string | null; source: string};
export default function OrderStatusActions({orderId, status, disabled, onAction}: {
  orderId: string; status: string; disabled: boolean;
  onAction: (next: OrderStatus, reason: string) => Promise<boolean>;
}) {
  const [action,setAction]=useState<OrderStatus | null>(null);
  const [reason,setReason]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [history,setHistory]=useState<History[]>([]);
  const [historyState,setHistoryState]=useState<'loading'|'ready'|'failed'>('loading');
  const [historyRefresh,setHistoryRefresh]=useState(0);
  const inFlight=useRef(false);
  useEffect(()=>{
    let active=true;
    setHistoryState('loading');setHistory([]);
    void (async()=>{
      try {
        const {data,error}=await supabase.rpc('get_admin_order_status_timeline',{p_order_id:orderId});
        if(!active)return;
        if(error){setHistoryState('failed');return;}
        setHistory(data??[]);setHistoryState('ready');
      }catch{if(active)setHistoryState('failed');}
    })();
    return ()=>{active=false;};
  },[orderId,status,historyRefresh]);
  async function submit() {
    if(inFlight.current||disabled||!action||!statusActionValid(status,action,reason,confirmed))return;
    inFlight.current=true;setBusy(true);
    try {if(await onAction(action,reason.trim())){setAction(null);setReason('');setConfirmed(false);}}
    finally {inFlight.current=false;setBusy(false);}
  }
  const locked=disabled||busy;
  const available=nextOrderStatuses(status);
  return <section className="space-y-4 border-t border-border pt-4" aria-label="Order status workflow">
    <div>
      <h3 className="text-sm font-bold">অর্ডারের অগ্রগতি</h3>
      <p className="mt-1 text-sm">বর্তমান অবস্থা: <strong>{ORDER_STATUS_LABELS[status]??status}</strong></p>
    </div>
    {!action&&<div className="grid gap-2 sm:grid-cols-2">
      {available.map(next=><button key={next} type="button" disabled={locked}
        onClick={()=>{setAction(next);setReason('');setConfirmed(false);}}
        className={`min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50 ${next==='cancelled'||next==='returned'?'border-orange-300 text-orange-800 dark:text-orange-300':'border-primary bg-primary text-primary-foreground'}`}>
        {STATUS_ACTION_LABELS[next]}
      </button>)}
    </div>}
    {available.length===0&&<p className="text-sm text-muted-foreground">এই অবস্থা থেকে আর কোনো পরিবর্তন অনুমোদিত নেই।</p>}
    {action&&<div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
      <p className="text-sm font-bold">{ORDER_STATUS_LABELS[status]??status} → {ORDER_STATUS_LABELS[action]}</p>
      {action==='shipped'&&<p className="text-xs text-muted-foreground">কুরিয়ারে বাস্তবে হস্তান্তর করার পরেই রেকর্ড করুন। এই action পার্সেল বুক বা pickup request করে না।</p>}
      {action==='delivered'&&<p className="text-xs text-muted-foreground">Courier tracking বা ক্রেতার নিশ্চিত তথ্য দেখে রেকর্ড করুন। COD বাকি টাকা আলাদাভাবে সংগ্রহের রেকর্ড করতে হবে।</p>}
      {action==='cancelled'&&<p className="text-xs text-muted-foreground">এটি অর্ডার বাতিলের রেকর্ড; payment refund আলাদাভাবে যাচাই করতে হবে।</p>}
      {action==='returned'&&<p className="text-xs text-muted-foreground">ফেরত পার্সেল হাতে পাওয়ার পর রেকর্ড করুন। এটি স্বয়ংক্রিয় refund করে না।</p>}
      <label className="block text-xs font-semibold" htmlFor="status-action-note">
        {statusReasonRequired(action)?'কারণ / যাচাইয়ের তথ্য (আবশ্যক)':'স্ট্যাটাসের নোট (ঐচ্ছিক)'}
      </label>
      <textarea id="status-action-note" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}
        disabled={locked} rows={3} required={statusReasonRequired(action)} className="input-bangla w-full text-sm"
        placeholder={statusReasonRequired(action)?'কমপক্ষে ৩ অক্ষরে কারণ বা যাচাইয়ের তথ্য লিখুন':'প্রয়োজনীয় নোট লিখুন'} />
      {STATUS_CONFIRMATIONS[action]&&<label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={confirmed} disabled={locked}
          onChange={e=>setConfirmed(e.target.checked)} />{STATUS_CONFIRMATIONS[action]}
      </label>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>void submit()} disabled={locked||!statusActionValid(status,action,reason,confirmed)}
          className="min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy?'সংরক্ষণ হচ্ছে…':'নিশ্চিত করে সংরক্ষণ করুন'}
        </button>
        <button type="button" disabled={locked} onClick={()=>setAction(null)} className="min-h-11 rounded-xl border px-4 py-3 text-sm">ফিরে যান</button>
      </div>
    </div>}
    <div className="space-y-2">
      <h4 className="text-sm font-bold">স্ট্যাটাসের ইতিহাস</h4>
      {historyState==='loading'&&<p role="status" className="text-xs text-muted-foreground">ইতিহাস লোড হচ্ছে…</p>}
      {historyState==='failed'&&<div role="alert" className="text-xs text-orange-700 dark:text-orange-300">ইতিহাস লোড করা যায়নি।
        <button type="button" disabled={locked} className="ml-2 underline" onClick={()=>setHistoryRefresh(x=>x+1)}>আবার দেখুন</button>
      </div>}
      {historyState==='ready'&&history.length===0&&<p className="text-xs text-muted-foreground">এখনও স্ট্যাটাসের রেকর্ড নেই।</p>}
      <ol className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {history.map(row=><li key={row.id} className="rounded-xl border border-border p-3 text-xs">
          <p className="font-semibold">{row.previous_status?`${ORDER_STATUS_LABELS[row.previous_status]??row.previous_status} → `:''}{ORDER_STATUS_LABELS[row.status]??row.status}</p>
          <p className="mt-1 text-muted-foreground">{row.created_at?new Date(row.created_at).toLocaleString('bn-BD'):'সময় অজানা'} · {row.actor_label??'পূর্বের রেকর্ড'}
            {row.source==='admin_manual'?' · Admin update':row.source==='verified_dispatch'?' · Verified dispatch':''}</p>
          {row.note&&<p className="mt-1 whitespace-pre-wrap break-words">{row.note}</p>}
        </li>)}
      </ol>
    </div>
  </section>;
}
