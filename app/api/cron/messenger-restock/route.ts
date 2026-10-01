import { NextRequest, NextResponse } from 'next/server';
import { processMessengerRestockNotifications } from '@/lib/ai/messenger-restock-delivery';

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
    const result = await processMessengerRestockNotifications(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Messenger restock cron failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Restock notification worker failed' },
      { status: 500 },
    );
  }
}
