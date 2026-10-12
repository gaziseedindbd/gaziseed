// Controlled Messenger delivery-policy source.
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeMessengerIntentText } from './messenger-intents';
import {
  detectMessengerReplyLanguage,
  type MessengerReplyLanguage,
} from './messenger-language';

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
  // Normalize Hindi and Romanized Bangla before matching, so the same policy
  // router works for Bengali, English, Hindi, and common transliterations.
  const normalized = normalizeMessengerIntentText(text);
  return DELIVERY_POLICY_KEYWORDS.some((keyword) =>
    normalized.includes(normalizeMessengerIntentText(keyword)),
  );
}

export function isMessengerDeliveryChargeQuestion(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(?:charge|fee|cost|how much|কত টাকা|চার্জ|ফি|খরচ|মূল্য|शुल्क|कितना|कितनी|खर्च)/i.test(normalized);
}

export function isMessengerDeliveryTimeQuestion(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(?:delivery time|shipping time|how long|how many days|when.*arrive|কত দিনে|কখন পাব|কবে পৌঁছাবে|ডেলিভারির সময়|ডেলিভারি.*কতদিন|कितने दिन|कब पहुंचेगा|डिलीवरी समय)/i.test(normalized);
}

function normalizeDigits(value: string): string {
  const bengali = '০১২৩৪৫৬৭৮৯';
  const devanagari = '०१२३४५६७८९';
  return value
    .replace(/[০-৯]/g, (digit) => String(bengali.indexOf(digit)))
    .replace(/[०-९]/g, (digit) => String(devanagari.indexOf(digit)));
}

function localizeDigits(value: string, language: MessengerReplyLanguage): string {
  const digits = language === 'Bengali'
    ? '০১২৩৪৫৬৭৮৯'
    : language === 'Hindi'
      ? '०१२३४५६७८९'
      : '0123456789';
  return value.replace(/[0-9]/g, (digit) => digits[Number(digit)]);
}

function formatMoney(
  amount: number,
  currencySymbol: string,
  country: MessengerDeliveryCountry,
  language: MessengerReplyLanguage,
): string {
  const locale = language === 'Bengali'
    ? 'bn-BD'
    : language === 'Hindi'
      ? 'hi-IN'
      : country === 'IN'
        ? 'en-IN'
        : 'en-US';
  return currencySymbol + localizeDigits(Math.round(amount).toLocaleString(locale), language);
}

function formatTimeValue(value: string, language: MessengerReplyLanguage): string {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/(\d+)\s*[-–]\s*(\d+)\s*(business\s+days?|days?|দিন|দিনে)?/i);
  if (!match) return value;

  const range = `${localizeDigits(match[1], language)}–${localizeDigits(match[2], language)}`;
  const isBusinessDays = /business/i.test(match[3] || '');
  if (language === 'English') return `${range} ${isBusinessDays ? 'business days' : 'days'}`;
  if (language === 'Hindi') return `${range} ${isBusinessDays ? 'कार्यदिवस' : 'दिन'}`;
  return `${range} ${isBusinessDays ? 'কার্যদিবস' : 'দিন'}`;
}

function formatDeliveryRuleRange(
  rule: MessengerDeliveryPolicy['charge_rules'][number],
  symbol: string,
  country: MessengerDeliveryCountry,
  language: MessengerReplyLanguage,
): string {
  const minimum = rule.min_order ?? 0;
  const maximum = rule.max_order;
  const minimumMoney = formatMoney(minimum, symbol, country, language);
  const maximumMoney = maximum == null
    ? null
    : formatMoney(maximum, symbol, country, language);

  if (maximum == null) {
    if (language === 'English') return `Orders of ${minimumMoney} or more`;
    if (language === 'Hindi') return `${minimumMoney} या उससे अधिक के ऑर्डर`;
    return `${minimumMoney} বা তার বেশি অর্ডার`;
  }

  if (minimum <= 0) {
    if (language === 'English') return `Orders up to ${maximumMoney}`;
    if (language === 'Hindi') return `${maximumMoney} तक के ऑर्डर`;
    return `${maximumMoney} পর্যন্ত অর্ডার`;
  }

  if (language === 'English') return `Orders ${minimumMoney}–${maximumMoney}`;
  if (language === 'Hindi') return `${minimumMoney}–${maximumMoney} के ऑर्डर`;
  return `${minimumMoney}–${maximumMoney} টাকার অর্ডার`;
}

function findOrderValue(text: string): number | null {
  const normalized = normalizeDigits(text);
  const patterns = [
    /(?:৳|₹|\bBDT\b|\bINR\b)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:৳|₹|\bBDT\b|\bINR\b|taka(?:r|e)?|tk\b|rupees?|rs\.?|টাকা(?:র|য়|য়)?|রুপি|रुपये|रुपए)/i,
    /(?:order(?:\s+(?:total|value|amount))?|অর্ডার(?:\s+(?:মোট|মূল্য))?|ऑर्डर(?:\s+(?:कुल|मूल्य))?)\s*(?:of|is|=|হলো|এর)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(value) && value >= 0) return value;
    }
  }
  return null;
}

export function formatMessengerDeliveryPolicyReply(
  policy: MessengerDeliveryPolicy,
  country: MessengerDeliveryCountry,
  text: string,
  language = detectMessengerReplyLanguage(text),
): string | null {
  const settings = policy.country_settings[0];
  const rules = policy.charge_rules.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const countrySymbol = country === 'IN' ? '₹' : '৳';
  const normalized = normalizeMessengerIntentText(text);
  const wantsCharge = isMessengerDeliveryChargeQuestion(text);
  const wantsTime = isMessengerDeliveryTimeQuestion(text);
  const asksCodOnly = /(?:\bcod\b|cash on delivery|ক্যাশ অন ডেলিভারি|সিওডি|कैश ऑन डिलीवरी)/i.test(normalized)
    && !wantsCharge
    && !wantsTime;
  const asksCoverage = /(?:do you deliver|delivery to|deliver to|delivery area|pincode|pin code|postcode|deliverable|ডেলিভারি হবে|ডেলিভারি করেন|কোন এলাকায়|কোন এলাকায়|পৌঁছাবে|পিন কোড|এলাকা|कहाँ डिलीवरी|डिलीवरी करते|पिन कोड|किस इलाके)/i.test(normalized);

  // A list of general rates cannot verify whether a particular postal area is covered.
  if (asksCoverage && !wantsCharge && !wantsTime && !asksCodOnly) return null;

  if (asksCodOnly) {
    if (country === 'BD') return null; // The existing BD payment-method handler gives the canonical COD-only answer.
    if (!policy.zones.some((zone) => zone.cod_enabled === true)) return null;
    if (language === 'English') {
      return 'Cash on Delivery is available for configured India delivery options. Some orders may require an advance; the checkout will confirm eligibility and the exact amount.';
    }
    if (language === 'Hindi') {
      return 'भारत में कॉन्फ़िगर किए गए delivery विकल्पों पर Cash on Delivery उपलब्ध है। कुछ ऑर्डर पर अग्रिम राशि लग सकती है; checkout पात्रता और सही राशि की पुष्टि करेगा।';
    }
    return 'ভারতের কনফিগার করা delivery option-গুলোতে Cash on Delivery পাওয়া যায়। কিছু অর্ডারে অগ্রিম লাগতে পারে; checkout-এ যোগ্যতা ও সঠিক পরিমাণ নিশ্চিত হবে।';
  }

  const amount = wantsCharge ? findOrderValue(text) : null;
  const matchingRule = amount == null
    ? null
    : rules.find((rule) =>
        amount >= (rule.min_order ?? 0) &&
        (rule.max_order == null || amount <= rule.max_order),
      );

  const lines: string[] = [];
  if (wantsCharge || (!wantsTime && !asksCodOnly)) {
    const shownRules = matchingRule ? [matchingRule] : rules;
    if (!shownRules.length) return null;
    lines.push(
      language === 'English'
        ? '🚚 Delivery charge based on order subtotal'
        : language === 'Hindi'
          ? '🚚 ऑर्डर के कुल मूल्य के अनुसार डिलीवरी शुल्क'
          : '🚚 অর্ডারের সাবটোটাল অনুযায়ী ডেলিভারি চার্জ',
    );

    for (const rule of shownRules) {
      const range = formatDeliveryRuleRange(rule, countrySymbol, country, language);
      const free = rule.is_free === true || Number(rule.charge ?? 0) <= 0;
      const charge = free
        ? language === 'English'
          ? 'Free delivery'
          : language === 'Hindi'
            ? 'मुफ़्त डिलीवरी'
            : 'ফ্রি ডেলিভারি'
        : language === 'English'
          ? `Delivery charge: ${formatMoney(Number(rule.charge), countrySymbol, country, language)}`
          : language === 'Hindi'
            ? `डिलीवरी शुल्क: ${formatMoney(Number(rule.charge), countrySymbol, country, language)}`
            : `ডেলিভারি চার্জ: ${formatMoney(Number(rule.charge), countrySymbol, country, language)}`;
      lines.push(`• ${range}: ${charge}`);
    }

    if (matchingRule && amount != null) {
      const note = language === 'English'
        ? 'This uses the current order-value rule; an active free-delivery offer may override it. Check the final amount at checkout.'
        : language === 'Hindi'
          ? 'यह मौजूदा ऑर्डर-मूल्य नियम पर आधारित है; सक्रिय free-delivery offer इसे बदल सकता है। अंतिम राशि checkout पर देखें।'
          : 'এটি বর্তমান অর্ডার-মূল্যের নিয়ম অনুযায়ী; সক্রিয় free-delivery offer থাকলে চার্জ বদলাতে পারে। checkout-এ চূড়ান্ত পরিমাণ দেখুন।';
      lines.push(note);
    } else if (rules.length) {
      lines.push(
        language === 'English'
          ? 'Tell us your order subtotal if you need help identifying the applicable slab.'
          : language === 'Hindi'
            ? 'सही slab बताने के लिए ऑर्डर का कुल मूल्य भेजें।'
            : 'সঠিক স্ল্যাবটি নির্দিষ্ট করতে অর্ডারের সাবটোটাল জানান।',
      );
    }
  }

  if (wantsTime || (!wantsCharge && settings)) {
    if (settings?.delivery_time_primary_value || settings?.delivery_time_secondary_value) {
      const primaryLabel = country === 'BD'
        ? language === 'English'
          ? 'Inside Dhaka'
          : language === 'Hindi'
            ? 'ढाका के अंदर'
            : 'ঢাকার ভিতরে'
        : language === 'English'
          ? 'Metro / city areas'
          : language === 'Hindi'
            ? 'मेट्रो / शहर क्षेत्र'
            : 'মেট্রো / সিটি এলাকা';
      const secondaryLabel = country === 'BD'
        ? language === 'English'
          ? 'Outside Dhaka'
          : language === 'Hindi'
            ? 'ढाका के बाहर'
            : 'ঢাকার বাইরে'
        : language === 'English'
          ? 'Other areas'
          : language === 'Hindi'
            ? 'अन्य क्षेत्र'
            : 'অন্যান্য এলাকা';

      lines.push(
        language === 'English'
          ? '⏱️ Estimated delivery time'
          : language === 'Hindi'
            ? '⏱️ अनुमानित डिलीवरी समय'
            : '⏱️ সম্ভাব্য ডেলিভারি সময়',
      );
      if (settings.delivery_time_primary_value) {
        lines.push(`• ${primaryLabel}: ${formatTimeValue(settings.delivery_time_primary_value, language)}`);
      }
      if (settings.delivery_time_secondary_value) {
        lines.push(`• ${secondaryLabel}: ${formatTimeValue(settings.delivery_time_secondary_value, language)}`);
      }
    }
  }

  if (!lines.length) return null;
  return lines.join('\n\n');
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
