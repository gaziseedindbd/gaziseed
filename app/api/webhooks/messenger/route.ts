import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WEBHOOK_VERIFY_TOKEN =
  process.env.META_VERIFY_TOKEN ||
  process.env.META_WEBHOOK_VERIFY_TOKEN ||
  '';

const META_APP_SECRET = process.env.META_APP_SECRET || '';

function safeEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!META_APP_SECRET || !signatureHeader) return false;

  const [scheme, signature] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !signature) return false;

  const expected = createHmac('sha256', META_APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');

  return safeEqual(expected, signature);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const verifyToken = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    challenge &&
    WEBHOOK_VERIFY_TOKEN &&
    verifyToken &&
    safeEqual(WEBHOOK_VERIFY_TOKEN, verifyToken)
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { success: false, message: 'Webhook verification failed' },
    { status: 403 },
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json(
      { success: false, message: 'Invalid webhook signature' },
      { status: 401 },
    );
  }

  try {
    const payload = JSON.parse(rawBody) as {
      object?: string;
      entry?: unknown[];
    };

    if (payload.object !== 'page') {
      return NextResponse.json({ success: true });
    }

    // Intentionally acknowledge events only at this stage.
    // AI routing, conversation persistence, provider failover,
    // and human handoff will be added after Meta verification succeeds.
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid webhook payload' },
      { status: 400 },
    );
  }
}
