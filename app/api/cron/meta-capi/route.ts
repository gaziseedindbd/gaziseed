import { NextRequest, NextResponse } from 'next/server';
import { processMetaCapiPurchases } from '@/lib/server/meta-capi';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret) return false;

  const authorization = request.headers.get('authorization') || '';
  return authorization === 'Bearer ' + cronSecret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processMetaCapiPurchases(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Meta CAPI cron failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Meta CAPI worker failed' },
      { status: 500 },
    );
  }
}
