import { NextRequest, NextResponse } from 'next/server';
import {
  processMessengerOrderConfirmationNotifications,
} from '@/lib/ai/messenger-order-notification-delivery';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.SUPABASE_DB_WEBHOOK_SECRET || '';
  if (!secret) return false;

  const authorization = request.headers.get('authorization') || '';
  const headerSecret = request.headers.get('x-supabase-webhook-secret') || '';

  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const result = await processMessengerOrderConfirmationNotifications(20);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Messenger order notification webhook failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Order notification worker failed' },
      { status: 500 },
    );
  }
}
