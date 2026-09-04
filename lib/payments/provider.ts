export type PaymentGatewayStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type NormalizedPaymentEvent = {
  eventId: string;
  eventType: string;
  status: PaymentGatewayStatus;
  orderId?: string;
  transactionId?: string;
  providerTransactionId?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentGatewayAdapter = {
  provider: string;
  verifyWebhook(request: Request, rawBody: string): Promise<boolean>;
  parseWebhook(rawBody: string): NormalizedPaymentEvent;
};

function equalBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

async function hmacSha256(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Generic adapter used only as a safe integration contract until a Bangladesh
 * gateway is selected. It expects x-payment-signature and x-payment-event-id.
 * A real gateway adapter must implement that provider's official signature rules.
 */
export const genericHmacAdapter: PaymentGatewayAdapter = {
  provider: 'generic',
  async verifyWebhook(request, rawBody) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    const signature = request.headers.get('x-payment-signature') ?? '';
    if (!secret || !signature) return false;
    const expected = await hmacSha256(secret, rawBody);
    const provided = signature.startsWith('sha256=') ? hexToBytes(signature.slice(7)) : hexToBytes(signature);
    return !!provided && equalBytes(expected, provided);
  },
  parseWebhook(rawBody) {
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const status = String(body.status ?? 'pending') as PaymentGatewayStatus;
    if (!['pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'].includes(status)) throw new Error('Invalid payment event status');
    const eventId = String(body.event_id ?? '');
    if (!eventId) throw new Error('Missing event_id');
    return {
      eventId,
      eventType: String(body.event_type ?? 'payment.update'),
      status,
      orderId: body.order_id ? String(body.order_id) : undefined,
      transactionId: body.transaction_id ? String(body.transaction_id) : undefined,
      providerTransactionId: body.provider_transaction_id ? String(body.provider_transaction_id) : undefined,
      amount: body.amount == null ? undefined : Number(body.amount),
      currency: body.currency ? String(body.currency) : undefined,
      metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
    };
  },
};

export function getPaymentGatewayAdapter(provider: string): PaymentGatewayAdapter | null {
  if (provider === 'generic') return genericHmacAdapter;
  return null;
}
