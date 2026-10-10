import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const json = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cashfreeId = process.env.CASHFREE_APP_ID;
  const cashfreeSecret = process.env.CASHFREE_SECRET_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey || !cashfreeId || !cashfreeSecret) {
    return json('Dispatch verification is not configured. Order has not been shipped.', 503);
  }

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json('Sign in as an admin', 401);
  const token = authorization.slice(7);
  const user = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization, 'x-gazi-country': 'IN' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: authError } = await user.auth.getUser(token);
  if (authError || !identity.user) return json('Invalid admin session', 401);
  const [{ data: isAdmin, error: adminError }, { data: adminCountry, error: countryError }] =
    await Promise.all([user.rpc('is_admin'), user.rpc('current_admin_country')]);
  if (adminError || countryError || isAdmin !== true || String(adminCountry).toUpperCase() !== 'IN') {
    return json('India branch administrator access required', 403);
  }

  let input: { orderId?: string; status?: string; note?: string };
  try { input = await request.json(); } catch { return json('Invalid request', 400); }
  if (!input.orderId || !/^[0-9a-f-]{36}$/i.test(input.orderId) || input.status !== 'shipped') {
    return json('Only verified shipment is supported', 400);
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id,country_code,status,payment_method,payment_status,final_amount,payment_advance_amount,payment_due_amount')
    .eq('id', input.orderId).maybeSingle();
  if (orderError || !order || order.country_code !== 'IN' || order.status !== 'packed') {
    return json('Order is not an eligible packed India order', 409);
  }
  const requiresCashfree = ['cashfree', 'online'].includes(String(order.payment_method || '').toLowerCase())
    || ['paid', 'partially_paid'].includes(String(order.payment_status || '').toLowerCase())
    || Number(order.payment_advance_amount || 0) > 0;
  if (!requiresCashfree) return json('This endpoint is for Cashfree-paid India orders only', 409);

  const { data: intents, error: intentError } = await admin
    .from('cashfree_payment_intents')
    .select('id,cashfree_order_id,amount,currency,status,completed_order_id,metadata')
    .eq('completed_order_id', order.id)
    .eq('status', 'completed');
  if (intentError || !intents || intents.length !== 1) {
    return json('Cashfree completed payment intent is missing or ambiguous. Hold dispatch.', 409);
  }
  const intent = intents[0];
  const method = String(intent.metadata?.payment_method || '').toLowerCase();
  const cod = method === 'cod';
  const expectedAmount = cod ? Number(order.payment_advance_amount) : Number(order.final_amount);
  const recordedAmount = Number(intent.amount);
  if (intent.currency !== 'INR' || !intent.cashfree_order_id ||
      !Number.isFinite(expectedAmount) || expectedAmount <= 0 ||
      !Number.isFinite(recordedAmount) || Math.abs(recordedAmount - expectedAmount) > 0.01 ||
      (cod && !(Number(order.payment_due_amount) >= 0)) ||
      (!cod && Number(order.payment_due_amount || 0) > 0)) {
    return json('Cashfree amount, payment method or due balance mismatch. Hold dispatch.', 409);
  }
  let cf: { order_status?: string; order_amount?: number; order_currency?: string };
  try {
    const response = await fetch(
      'https://api.cashfree.com/pg/orders/' + encodeURIComponent(intent.cashfree_order_id),
      { headers: { 'x-api-version': '2025-01-01', 'x-client-id': cashfreeId,
          'x-client-secret': cashfreeSecret }, cache: 'no-store' },
    );
    if (!response.ok) return json('Cashfree verification unavailable. Hold dispatch.', 502);
    cf = await response.json();
  } catch {
    return json('Cashfree verification unavailable. Hold dispatch.', 502);
  }
  if (cf.order_status !== 'PAID' || cf.order_currency !== 'INR' ||
      !Number.isFinite(Number(cf.order_amount)) ||
      Math.abs(Number(cf.order_amount) - expectedAmount) > 0.01) {
    return json('Cashfree did not confirm expected paid amount. Hold dispatch.', 409);
  }

  // The database trigger rejects browser-originated shipment even if the UI is bypassed.
  // Keep the timestamp write and dispatch in a single trusted server request.
  const { data: changed, error: updateError } = await admin.from('orders')
    .update({
      status: 'shipped',
      internal_notes: typeof input.note === 'string' ? input.note.slice(0, 2000) : '',
      cashfree_dispatch_verified_at: new Date().toISOString(),
    }).eq('id', order.id).eq('status', 'packed').select('id,status').maybeSingle();
  if (updateError || !changed) return json('Order changed or verified dispatch failed', 409);
  return NextResponse.json({ ok: true, verified: true, status: changed.status });
}
