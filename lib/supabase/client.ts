import { createBrowserClient } from '@supabase/ssr';

const FALLBACK_URL = 'https://pfvwovplgwrsewwkkoir.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmdndvdnBsZ3dyc2V3d2trb2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NDEyNTMsImV4cCI6MjEwMjUxNzI1M30.iiw9wnAwxL7OAGmYsRhEsUJKW7d14HZj2IGRwjP-YGw';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export const formatPrice = (price: number): string => {
  return '৳ ' + Number(price).toLocaleString('bn-BD');
};

export const formatPriceEn = (price: number): string => {
  return '৳ ' + Number(price).toLocaleString('en-US');
};
