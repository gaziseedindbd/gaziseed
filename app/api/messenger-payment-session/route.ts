import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is incomplete');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id')?.trim();
  if (!orderId || !/^GS-CF-[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ ok: false, error: 'Invalid payment order' }, { status: 400 });
  }

  try {
    const admin = getAdmin();
    const { data, error } = await admin
      .from('cashfree_payment_intents')
      .select('id,cashfree_order_id,cashfree_payment_session_id,status,amount,currency,metadata')
      .eq('cashfree_order_id', orderId)
      .eq('country_code', 'IN')
      .maybeSingle();

    if (error || !data) return NextResponse.json({ ok: false, error: 'Payment session not found' }, { status: 404 });
    if (data.metadata?.payment_method !== 'cod') return NextResponse.json({ ok: false, error: 'Invalid payment type' }, { status: 400 });
    if (!data.cashfree_payment_session_id) return NextResponse.json({ ok: false, error: 'Payment session is not ready' }, { status: 409 });

    return NextResponse.json({
      ok: true,
      payment_intent_id: data.id,
      order_id: data.cashfree_order_id,
      payment_session_id: data.cashfree_payment_session_id,
      amount: Number(data.amount || 0),
      currency: data.currency || 'INR',
      status: data.status,
      quote_final: Number(data.metadata?.quote_final || 0),
      advance_amount: Number(data.metadata?.cod_advance || data.amount || 0),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Unable to load payment session' }, { status: 500 });
  }
}
