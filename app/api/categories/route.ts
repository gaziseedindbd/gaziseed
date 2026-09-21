import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_KEY = 'sb_publishable_vCaz5OGrHocUTgpOXmE9xg_QVsuUJc0';

function getCountry(req: NextRequest): 'BD' | 'IN' {
  const queryCountry = req.nextUrl.searchParams.get('country')?.toUpperCase();
  const headerCountry = req.headers.get('x-gazi-country')?.toUpperCase();
  const cookieCountry = req.cookies.get('gazi_country_override')?.value?.toUpperCase();
  const platformCountry = (
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    'BD'
  ).toUpperCase();

  if (queryCountry === 'IN' || queryCountry === 'BD') return queryCountry;
  if (headerCountry === 'IN' || headerCountry === 'BD') return headerCountry;
  if (cookieCountry === 'IN' || cookieCountry === 'BD') return cookieCountry;
  return platformCountry === 'IN' ? 'IN' : 'BD';
}

async function fetchCategories(url: URL, key: string, country: 'BD' | 'IN') {
  return fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'x-gazi-country': country,
    },
    cache: 'no-store',
  });
}

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_URL;
    const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const country = getCountry(req);

    const url = new URL(`${supabaseUrl}/rest/v1/categories`);
    url.search = new URLSearchParams({
      select: '*',
      is_active: 'eq.true',
      country_code: `eq.${country}`,
      order: 'display_order.asc',
    }).toString();

    let response = await fetchCategories(url, configuredKey || FALLBACK_KEY, country);

    // If the Vercel environment key is stale/invalid, retry with the current
    // Supabase publishable key verified for this project.
    if (!response.ok && [401, 403].includes(response.status)) {
      response = await fetchCategories(url, FALLBACK_KEY, country);
    }

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: 'Failed to load categories', detail }, { status: response.status });
    }

    const categories = await response.json();
    return NextResponse.json(categories, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
