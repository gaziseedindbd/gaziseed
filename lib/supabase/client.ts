import { createBrowserClient } from '@supabase/ssr';

const FALLBACK_URL = 'https://ufxsthshyebahkwbmioe.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeHN0aG9zdG5vZGUuLiJjb2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzY2MDAsImV4cCI6MjEwNDAxMjYwMH0.oU3ISPzKV6PQ3G0OXoCLHkrVa6qAEjSYoQF8D2Shf-M';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY;

const getManualCountryOverride = (): 'BD' | 'IN' | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem('gazi_country_override')?.toUpperCase();
    return value === 'IN' || value === 'BD' ? value : null;
  } catch {
    return null;
  }
};

export const getVisitorCountry = (): 'BD' | 'IN' => {
  if (typeof window === 'undefined') return 'BD';
  const manual = getManualCountryOverride();
  if (manual) return manual;
  const country = (window as typeof window & { __GAZI_COUNTRY__?: string }).__GAZI_COUNTRY__?.toUpperCase();
  return country === 'IN' ? 'IN' : 'BD';
};

export const setManualCountry = (country: 'BD' | 'IN' | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (country) {
      localStorage.setItem('gazi_country_override', country);
      document.cookie = `gazi_country_override=${country}; Path=/; Max-Age=31536000; SameSite=Lax`;
      (window as typeof window & { __GAZI_COUNTRY__?: string }).__GAZI_COUNTRY__ = country;
    } else {
      localStorage.removeItem('gazi_country_override');
      document.cookie = 'gazi_country_override=; Path=/; Max-Age=0; SameSite=Lax';
      (window as typeof window & { __GAZI_COUNTRY__?: string }).__GAZI_COUNTRY__ = 'BD';
    }
  } catch {
    // Ignore storage errors and keep the IP-detected country.
  }
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