'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/country';

function TrackContent() {
  const q = useSearchParams();
  const [token, setToken] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(q.get('token') || '');
  }, [q]);

  useEffect(() => {
    const value = q.get('token') || '';
    if (!value) return;
    let cancelled = false;
    async function find() {
      setError('');
      const s = createClient();
      const { data: result, error: rpcError } = await s.rpc('track_guest_order', { p_token: value.trim() });
      if (cancelled) return;
      if (rpcError || !result) {
        setError(rpcError?.message || 'Order not found or tracking token expired');
        setData(null);
      } else {
        setData(result);
      }
    }
    find();
    return () => { cancelled = true; };
  }, [q]);

  async function findByToken() {
    const value = token.trim();
    if (!value) return;
    setError('');
    const s = createClient();
    const { data: result, error: rpcError } = await s.rpc('track_guest_order', { p_token: value });
    if (rpcError || !result) {
      setError(rpcError?.message || 'Order not found or tracking token expired');
      setData(null);
    } else setData(result);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-black">Track Order</h1>
        <div className="mt-6 rounded-2xl border bg-white p-6">
          <div className="flex gap-2">
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="Guest tracking token" className="flex-1 rounded-xl border px-4 py-3" />
            <button onClick={findByToken} className="rounded-xl bg-[#1f6b3b] px-5 font-bold text-white">Track</button>
          </div>
          {error && <p className="mt-4 text-red-600">{error}</p>}
        </div>
        {data && (
          <div className="mt-6 rounded-2xl border bg-white p-6">
            <h2 className="text-2xl font-black">Order {data.order?.order_number}</h2>
            <p className="mt-2">Status: <b>{data.order?.status}</b></p>
            <p>Total: <b>{formatMoney(Number(data.order?.total || 0), data.order?.currency_code === 'INR' ? 'IN' : 'BD')}</b></p>
            <h3 className="mt-6 font-bold">Status History</h3>
            <div className="mt-3 space-y-3">
              {(data.history || []).map((h: any) => (
                <div key={h.id} className="rounded-xl bg-gray-50 p-3">
                  <b>{h.new_status}</b>
                  <span className="ml-2 text-sm text-gray-500">{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Track() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#f7f8f4] p-6"><p>Loading order tracker…</p></main>}>
      <TrackContent />
    </Suspense>
  );
}
