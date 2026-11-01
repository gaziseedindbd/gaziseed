import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type MessengerCartContext = {
  country: 'BD' | 'IN';
  subtotal: number;
  hasFreeDeliveryProduct: boolean;
  language: 'bn' | 'en' | 'hi';
  expiresAt: number;
  nonce: string;
};

const MAX_CONTEXT_AGE_SECONDS = 10 * 60;

function getSecret() {
  return process.env.MESSENGER_CART_CONTEXT_SECRET || process.env.META_APP_SECRET || '';
}

function signatureFor(encodedPayload: string, secret: string) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function signMessengerCartContext(context: MessengerCartContext): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify(context)).toString('base64url');
  const signedEnvelope = JSON.stringify({ payload, signature: signatureFor(payload, secret) });
  return Buffer.from(signedEnvelope).toString('base64url');
}

export function verifyMessengerCartContext(token: unknown, now = Date.now()): MessengerCartContext | null {
  if (typeof token !== 'string' || token.length > 900) return null;
  const secret = getSecret();
  if (!secret || !/^[A-Za-z0-9_-]+$/.test(token)) return null;

  let envelope: { payload?: unknown; signature?: unknown };
  try {
    envelope = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as { payload?: unknown; signature?: unknown };
  } catch {
    return null;
  }
  const payload = envelope.payload;
  const signature = envelope.signature;
  if (typeof payload !== 'string' || typeof signature !== 'string') return null;

  const expected = Buffer.from(signatureFor(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<MessengerCartContext>;
    const nowSeconds = Math.floor(now / 1000);
    if (
      (value.country !== 'BD' && value.country !== 'IN') ||
      typeof value.subtotal !== 'number' || !Number.isFinite(value.subtotal) || value.subtotal < 0 || value.subtotal > 10_000_000 ||
      typeof value.hasFreeDeliveryProduct !== 'boolean' ||
      (value.language !== 'bn' && value.language !== 'en' && value.language !== 'hi') ||
      typeof value.expiresAt !== 'number' || !Number.isInteger(value.expiresAt) ||
      value.expiresAt <= nowSeconds || value.expiresAt > nowSeconds + MAX_CONTEXT_AGE_SECONDS + 30 ||
      typeof value.nonce !== 'string' || !/^[a-f0-9]{24}$/.test(value.nonce)
    ) return null;
    return value as MessengerCartContext;
  } catch {
    return null;
  }
}

export function createMessengerCartContext(args: Omit<MessengerCartContext, 'expiresAt' | 'nonce'>): MessengerCartContext {
  return {
    ...args,
    expiresAt: Math.floor(Date.now() / 1000) + MAX_CONTEXT_AGE_SECONDS,
    nonce: randomBytes(12).toString('hex'),
  };
}
