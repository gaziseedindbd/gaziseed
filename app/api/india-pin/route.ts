import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get('pin') || '';
  if (!/^[1-9][0-9]{5}$/.test(pin)) {
    return NextResponse.json({ error: 'Enter a valid 6-digit Indian PIN.' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    let response: Response;
    try {
      response = await fetch('https://api.postalpincode.in/pincode/' + pin, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error('Postal directory unavailable');
    const payload = await response.json();
    const result = Array.isArray(payload) ? payload[0] : null;
    const offices = result?.Status === 'Success' && Array.isArray(result?.PostOffice) ? result.PostOffice : [];
    const states = Array.from(new Set(offices.map((office: any) => String(office.State || '').trim()).filter(Boolean)));
    if (states.length !== 1) {
      return NextResponse.json({ error: 'PIN not found. Check the code and try again.' }, { status: 404 });
    }
    const districts = Array.from(new Set(offices.map((office: any) => String(office.District || '').trim()).filter(Boolean)));
    return NextResponse.json(
      { pin, state: states[0], district: districts.length === 1 ? districts[0] : '' },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } },
    );
  } catch {
    return NextResponse.json({ error: 'PIN verification unavailable. Please try again.' }, { status: 503 });
  }
}
