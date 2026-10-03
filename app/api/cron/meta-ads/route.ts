import { NextRequest, NextResponse } from 'next/server';
import { syncMetaAdsInsights } from '@/lib/server/meta-ads';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret) return false;
  return request.headers.get('authorization') === 'Bearer ' + cronSecret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncMetaAdsInsights(30);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Meta Ads sync failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Meta Ads sync failed' },
      { status: 500 },
    );
  }
}
