import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeHN0aHNoeWViYWhrd2JtaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzY2MDAsImV4cCI6MjEwNDAxMjYwMH0.oU3ISPzKV6PQ3G0OXoCLHkrVa6qAEjSYoQF8D2Shf-M';

function getCountry(req: NextRequest): 'BD' | 'IN' {
  const headerCountry = req.headers.get('x-gazi-country')?.toUpperCase();
  const cookieCountry = req.cookies.get('gazi_country_override')?.value?.toUpperCase();
  const platformCountry = (
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    'BD'
  ).toUpperCase();

  if (headerCountry === 'IN' || headerCountry === 'BD') return headerCountry;
  if (cookieCountry === 'IN' || cookieCountry === 'BD') return cookieCountry;
  return platformCountry === 'IN' ? 'IN' : 'BD';
}

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_KEY;
    const country = getCountry(req);

    if (!anonKey) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({
      select: '*',
      is_active: 'eq.true',
      is_ads_only: 'eq.false',
      country_code: `eq.${country}`,
      order: 'created_at.desc',
    });

    const url = new URL(`${supabaseUrl}/rest/v1/products`);
    url.search = params.toString();

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'x-gazi-country': country,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: 'Failed to load products', detail },
        { status: response.status }
      );
    }

    const products = await response.json();
    return NextResponse.json(products, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
