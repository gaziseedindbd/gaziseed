import { NextResponse } from 'next/server';

const FALLBACK_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeHN0aG9oeWViYWhrd2JtaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzY2MDAsImV4cCI6MjEwNDAxMjYwMH0.oU3ISPzKV6PQ3G0OXoCLHkrVa6qAEjSYoQF8D2Shf-M';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_KEY;
    const url = new URL(`${supabaseUrl}/rest/v1/categories`);
    url.search = new URLSearchParams({
      select: '*',
      is_active: 'eq.true',
      order: 'display_order.asc',
    }).toString();

    const response = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: 'no-store',
    });

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
