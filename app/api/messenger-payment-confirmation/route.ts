import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processMessengerOrderConfirmationNotifications } from '@/lib/ai/messenger-order-notification-delivery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is incomplete');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest) {
  let body: { payment_intent_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  const paymentIntentId = typeof body.payment_intent_id === 'string'
    ? body.payment_intent_id.trim()
    : '';
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(paymentIntentId)) {
    return NextResponse.json({ ok: false, error: 'Invalid payment intent' }, { status: 400 });
  }

  try {
    const admin = getAdmin();
    const { data: intent, error: intentError } = await admin
      .from('cashfree_payment_intents')
      .select('id,country_code,metadata,completed_order_id')
      .eq('id', paymentIntentId)
      .maybeSingle();

    if (intentError || !intent) {
      return NextResponse.json({ ok: false, error: 'Payment intent not found' }, { status: 404 });
    }
    if (
      intent.country_code !== 'IN' ||
      intent.metadata?.payment_method !== 'cod' ||
      intent.metadata?.order_source !== 'facebook_messenger_ai' ||
      !intent.completed_order_id
    ) {
      return NextResponse.json({ ok: false, error: 'Completed Messenger COD order not found' }, { status: 409 });
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id,country_code,payment_status,order_source')
      .eq('id', intent.completed_order_id)
      .maybeSingle();
    if (orderError || !order || order.country_code !== 'IN' ||
        order.order_source !== 'facebook_messenger_ai' ||
        !['paid', 'partially_paid'].includes(String(order.payment_status || '').toLowerCase())) {
      return NextResponse.json({ ok: false, error: 'Order payment is not confirmed' }, { status: 409 });
    }

    const result = await processMessengerOrderConfirmationNotifications(1, order.id);
    const { data: notification } = await admin
      .from('messenger_order_notifications')
      .select('status,last_error')
      .eq('order_id', order.id)
      .eq('event_type', 'order_confirmed')
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      sent: notification?.status === 'sent',
      pending: notification?.status === 'pending' || notification?.status === 'sending',
      result,
    });
  } catch (error) {
    console.error('Messenger payment confirmation failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'Messenger confirmation could not be delivered' }, { status: 500 });
  }
}
