// Controlled Messenger delivery-policy source.
import type { SupabaseClient } from '@supabase/supabase-js';

export type MessengerDeliveryCountry = 'IN' | 'BD';

export type MessengerDeliveryPolicy = {
  country_settings: Array<{
    country_code: string;
    country_name: string | null;
    currency: string | null;
    hero_title: string | null;
    hero_subtitle: string | null;
    delivery_time_primary_label: string | null;
    delivery_time_primary_value: string | null;
    delivery_time_secondary_label: string | null;
    delivery_time_secondary_value: string | null;
    notes: string[] | null;
  }>;
  charge_rules: Array<{
    title: string | null;
    subtitle: string | null;
    min_order: number | null;
    max_order: number | null;
    charge: number | null;
    currency: string | null;
    is_free: boolean | null;
    featured: boolean | null;
    display_order: number | null;
  }>;
  zones: Array<{
    zone_name: string | null;
    charge: number | null;
    estimated_time: string | null;
    cod_enabled: boolean | null;
    display_order: number | null;
  }>;
};

const DELIVERY_POLICY_KEYWORDS = [
  'delivery',
  'deliver',
  'shipping',
  'ship',
  'courier',
  'cod',
  'cash on delivery',
  'delivery charge',
  'shipping charge',
  'delivery fee',
  'delivery time',
  'কুরিয়ার',
  'ডেলিভারি',
  'শিপিং',
  'ডেলিভারি চার্জ',
  'ডেলিভারি ফি',
  'ডেলিভারি খরচ',
  'কত টাকা ডেলিভারি',
  'কখন পাব',
  'কত দিনে',
  'ক্যাশ অন ডেলিভারি',
  'সিওডি',
];

export function isMessengerDeliveryPolicyQuestion(text: string): boolean {
  const normalized = text.toLocaleLowerCase().trim();
  return DELIVERY_POLICY_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLocaleLowerCase()),
  );
}

export async function getMessengerDeliveryPolicy(
  supabase: SupabaseClient,
  country: MessengerDeliveryCountry,
): Promise<MessengerDeliveryPolicy> {
  const [settingsResult, rulesResult, zonesResult] = await Promise.all([
    supabase
      .from('delivery_country_settings')
      .select(
        'country_code,country_name,currency,hero_title,hero_subtitle,delivery_time_primary_label,delivery_time_primary_value,delivery_time_secondary_label,delivery_time_secondary_value,notes',
      )
      .eq('country_code', country)
      .eq('is_active', true)
      .limit(1),
    supabase
      .from('delivery_charge_rules')
      .select(
        'title,subtitle,min_order,max_order,charge,currency,is_free,featured,display_order',
      )
      .eq('country_code', country)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('delivery_zones')
      .select(
        'zone_name,charge,estimated_time,cod_enabled,display_order',
      )
      .eq('country_code', country)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (rulesResult.error) throw rulesResult.error;
  if (zonesResult.error) throw zonesResult.error;

  return {
    country_settings: (settingsResult.data || []).map((row) => ({
      ...row,
      notes: Array.isArray(row.notes) ? row.notes : null,
    })),
    charge_rules: rulesResult.data || [],
    zones: zonesResult.data || [],
  };
}

export function serializeMessengerDeliveryPolicy(
  policy: MessengerDeliveryPolicy,
) {
  return {
    country_settings: policy.country_settings,
    charge_rules: policy.charge_rules,
    zones: policy.zones,
    instruction:
      'Use only this verified GAZI SEED delivery data for delivery, shipping, COD, delivery-time, and delivery-charge answers. Do not invent coverage, fees, timelines, or exceptions. If the data is insufficient for an exact answer, say so and ask for the missing order value or location.',
  };
}
