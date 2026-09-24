import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const cachedClients = new Map<'BD' | 'IN', SupabaseClient>();

export function createWhatsAppSupabase(country: 'BD' | 'IN' = 'BD'): SupabaseClient {
  const cached = cachedClients.get(country);
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('WhatsApp integration requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'x-gazi-country': country,
      },
    },
  });

  cachedClients.set(country, client);
  return client;
}
