import { NextRequest, NextResponse } from 'next/server';
import { sendMetaPurchaseForOrder } from '@/lib/server/meta-capi';
import { shouldSuppressMetaCapiUserIdentifiers } from '@/lib/meta-capi-policy';

export const dynamic = 'force-dynamic';

const ORDER_NUMBER_PATTERN = /^GS-(BD|IN)-[A-Z0-9-]+$/i;

function isCountryCode(value: unknown): value is 'BD' | 'IN' {
  return value === 'BD' || value === 'IN';
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const orderNumber =
      typeof body?.order_number === 'string'
        ? body.order_number.trim().toUpperCase()
        : '';
    const countryCode = body?.country_code;

    if (!ORDER_NUMBER_PATTERN.test(orderNumber) || !isCountryCode(countryCode)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid purchase tracking request' },
        { status: 400 },
      );
    }

    const isPreviewTestEvent = shouldSuppressMetaCapiUserIdentifiers(
      process.env.VERCEL_ENV,
      process.env.META_CAPI_TEST_EVENT_CODE,
    );

    const fbp = isPreviewTestEvent
      ? undefined
      : request.cookies.get('_fbp')?.value?.trim() || undefined;
    const fbc = isPreviewTestEvent
      ? undefined
      : request.cookies.get('_fbc')?.value?.trim() || undefined;

    const sourceUrl =
      body?.source_url && typeof body.source_url === 'string'
        ? body.source_url
        : request.nextUrl.origin +
          '/order-success?number=' +
          encodeURIComponent(orderNumber);

    const result = await sendMetaPurchaseForOrder(orderNumber, countryCode, {
      sourceUrl,
      clientIpAddress: isPreviewTestEvent
        ? undefined
        : request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      clientUserAgent: isPreviewTestEvent
        ? undefined
        : request.headers.get('user-agent') || undefined,
      fbp,
      fbc,
    });

    const status =
      result.status === 'not_found'
        ? 404
        : result.status === 'failed'
          ? 502
          : 200;

    return NextResponse.json(
      { ok: result.ok, status: result.status },
      { status },
    );
  } catch (error) {
    console.error('Meta CAPI purchase route failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Meta CAPI purchase tracking failed' },
      { status: 500 },
    );
  }
}
