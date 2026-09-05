import { createBrowserClient } from '@supabase/ssr';

const FALLBACK_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeHN0aXNoeWViYWhrd2JtaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzY2MDAsImV4cCI6MjEwNDAxMjYwMH0.oU3ISPzKV6PQ3G0OXoCLHkrVa6qAEjSYoQF8D2Shf-M';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY;

const getVisitorCountry = (): 'BD' | 'IN' => {
  if (typeof window === 'undefined') return 'BD';
  const country = (window as typeof window & { __GAZI_COUNTRY__?: string }).__GAZI_COUNTRY__?.toUpperCase();
  return country === 'IN' ? 'IN' : 'BD';
};

const fetchWithCountry: typeof fetch = async (input, init) => {
  const headers = new Headers(
    init?.headers || (input instanceof Request ? input.headers : undefined)
  );
  headers.set('x-gazi-country', getVisitorCountry());
  return fetch(input, { ...init, headers });
};

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithCountry },
});

export const formatPrice = (price: number): string => {
  const country = getVisitorCountry();
  return country === 'IN'
    ? '₹ ' + Number(price).toLocaleString('en-IN')
    : '৳ ' + Number(price).toLocaleString('bn-BD');
};

export const formatPriceEn = (price: number): string => {
  const country = getVisitorCountry();
  return country === 'IN'
    ? '₹ ' + Number(price).toLocaleString('en-IN')
    : '৳ ' + Number(price).toLocaleString('en-US');
};
