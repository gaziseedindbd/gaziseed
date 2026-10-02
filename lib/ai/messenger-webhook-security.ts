import { createHmac, timingSafeEqual } from 'node:crypto';

export function safeEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyMessengerWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!appSecret || !signatureHeader) return false;

  const [scheme, signature, ...extra] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !signature || extra.length > 0) return false;

  const expected = createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  return safeEqual(expected, signature);
}
