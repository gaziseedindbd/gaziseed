import { NextRequest, NextResponse } from 'next/server';
import { processMessengerRestockNotifications } from '@/lib/ai/messenger-restock-delivery';
import { processMessengerOrderConfirmationNotifications } from '@/lib/ai/messenger-order-notification-delivery';
import { processMessengerOrderStatusNotifications } from '@/lib/ai/messenger-order-status-notification-delivery';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret) return false;

  const authorization = request.headers.get('authorization') || '';
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [restock, orderConfirmation, orderStatus] = await Promise.all([
      processMessengerRestockNotifications(50),
      processMessengerOrderConfirmationNotifications(50),
      processMessengerOrderStatusNotifications(50),
    ]);

    return NextResponse.json({ ok: true, restock, orderConfirmation, orderStatus });
  } catch (error) {
    console.error('Messenger notification cron failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Messenger notification worker failed' },
      { status: 500 },
    );
  }
}
