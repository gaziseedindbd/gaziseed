import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

const FALLBACK_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeHN0aHNoeWViYWhrd2JtaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzY2MDAsImV4cCI6MjEwNDAxMjYwMH0.oU3ISPzKV6PQ3G0OXoCLHkrVa6qAEjSYoQF8D2Shf-M';

export async function createServerSupabase() {
  const cookieStore = cookies();
  const headerStore = headers();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY;

  const detectedCountry = (
    headerStore.get('x-vercel-ip-country') ||
    headerStore.get('cf-ipcountry') ||
    'BD'
  ).toUpperCase();
  const visitorCountry = detectedCountry === 'IN' ? 'IN' : 'BD';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
    global: {
      headers: {
        'x-gazi-country': visitorCountry,
      },
    },
  });
}
