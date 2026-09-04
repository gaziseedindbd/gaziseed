import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaymentGatewayAdapter } from '@/lib/payments/provider';

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const adapter = getPaymentGatewayAdapter(provider);
  if (!adapter) return NextResponse.json({ error: 'Payment provider is not configured' }, { status: 501 });

  const rawBody = await request.text();
  if (!rawBody) return NextResponse.json({ error: 'Empty webhook body' }, { status: 400 });

  try {
    if (!(await adapter.verifyWebhook(request, rawBody))) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    const event = adapter.parseWebhook(rawBody);
    const supabase = createServiceClient();
    const payloadHash = await sha256Hex(rawBody);

    const { data: existing } = await supabase
      .from('payment_webhook_events')
      .select('id,status')
      .eq('provider', provider)
      .eq('event_id', event.eventId)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, duplicate: true, status: existing.status });

    let txId = event.transactionId;
    if (!txId && event.providerTransactionId) {
      const { data: tx } = await supabase
        .from('payment_transactions')
        .select('id,amount,currency,order_id')
        .eq('provider', provider)
        .eq('provider_transaction_id', event.providerTransactionId)
        .maybeSingle();
      txId = tx?.id;
    }
    if (!txId) return NextResponse.json({ error: 'Payment transaction could not be identified' }, { status: 400 });

    const { data: tx, error: txError } = await supabase
      .from('payment_transactions')
      .select('id,order_id,amount,currency')
      .eq('id', txId)
      .maybeSingle();
    if (txError || !tx) return NextResponse.json({ error: 'Payment transaction not found' }, { status: 404 });

    if (event.amount != null && Number(event.amount) !== Number(tx.amount)) return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 });
    if (event.currency && event.currency.toUpperCase() !== String(tx.currency).toUpperCase()) return NextResponse.json({ error: 'Payment currency mismatch' }, { status: 400 });
    if (event.orderId && event.orderId !== tx.order_id) return NextResponse.json({ error: 'Order mismatch' }, { status: 400 });

    const { error: eventError } = await supabase.from('payment_webhook_events').insert({
      provider,
      event_id: event.eventId,
      event_type: event.eventType,
      transaction_id: tx.id,
      provider_transaction_id: event.providerTransactionId ?? null,
      payload_hash: payloadHash,
      status: 'received',
    });
    if (eventError) {
      if (eventError.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
      throw eventError;
    }

    const { data: result, error: resultError } = await supabase.rpc('mark_payment_transaction_result', {
      p_transaction_id: tx.id,
      p_status: event.status,
      p_provider_transaction_id: event.providerTransactionId ?? null,
      p_metadata: event.metadata ?? {},
    });

    if (resultError) {
      await supabase.from('payment_webhook_events').update({ status: 'failed', error_message: resultError.message }).eq('provider', provider).eq('event_id', event.eventId);
      throw resultError;
    }

    await supabase.from('payment_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('provider', provider).eq('event_id', event.eventId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed' }, { status: 400 });
  }
}
