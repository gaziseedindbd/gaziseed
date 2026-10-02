export type MessengerCountryCode = 'IN' | 'BD';

function normalizeCountryText(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,!?;:|/\\]+|[\s.,!?;:|/\\]+$/g, '');
}

function hasEnglishCountryIntent(
  normalized: string,
  country: string,
  adjective: string,
  branchWord: string,
): boolean {
  if (normalized === country || normalized === adjective) {
    return true;
  }

  const countryWord = country;

  return (
    new RegExp('\\b(?:in|from|to|into|for|near)\\s+' + countryWord + '\\b', 'i').test(normalized) ||
    new RegExp('\\b(?:deliver(?:y)?|ship(?:ping)?|send|available)\\s+(?:to|in|for)\\s+' + countryWord + '\\b', 'i').test(normalized) ||
    new RegExp('\\b' + branchWord + '\\s+(?:delivery|branch|customer|support|catalog|store|website|site)\\b', 'i').test(normalized) ||
    new RegExp('\\b(?:delivery|shipping|support|branch|customer|catalog|store|website|site)\\s+(?:in|for|of)\\s+' + countryWord + '\\b', 'i').test(normalized) ||
    new RegExp('\\b(?:country|location)\\s*(?:is|:)?\\s+' + countryWord + '\\b', 'i').test(normalized) ||
    new RegExp('\\b(?:customer|buyer|user)\\s+(?:from|in)\\s+' + countryWord + '\\b', 'i').test(normalized) ||
    new RegExp('\\b' + adjective + '\\s+(?:customer|buyer|user|branch|support|delivery|catalog|store|website|site)\\b', 'i').test(normalized)
  );
}

function hasBanglaCountryIntent(
  normalized: string,
  country: string,
  adjective: string,
  postposition: string,
): boolean {
  if (normalized === country || normalized === adjective || normalized === postposition) {
    return true;
  }

  return (
    normalized.includes(postposition + ' ডেলিভারি') ||
    normalized.includes(postposition + ' শিপিং') ||
    normalized.includes(postposition + ' অর্ডার') ||
    normalized.includes(country + ' থেকে') ||
    normalized.includes(country + ' ব্রাঞ্চ') ||
    normalized.includes(country + ' শাখা') ||
    normalized.includes(country + ' কাস্টমার') ||
    normalized.includes(country + ' সাপোর্ট') ||
    normalized.includes(country + ' ডেলিভারি') ||
    normalized.includes(country + ' শিপিং') ||
    normalized.includes('ডেলিভারি ' + postposition) ||
    normalized.includes('শিপিং ' + postposition) ||
    normalized.includes('অর্ডার ' + postposition)
  );
}

/**
 * Detects country only when the message itself expresses country/location intent.
 *
 * Product/variety adjectives such as "Indian seeds" or "বাংলাদেশি বীজ"
 * are intentionally not treated as a branch selection.
 *
 * When both countries are explicitly mentioned, the result is null so the
 * caller can keep the conversation country unchanged or request confirmation.
 */
export function detectExplicitMessengerCountry(
  text: string,
): MessengerCountryCode | null {
  const normalized = normalizeCountryText(text);

  const mentionsIndia =
    hasEnglishCountryIntent(normalized, 'india', 'indian', 'india') ||
    hasEnglishCountryIntent(normalized, 'bharat', 'indian', 'bharat') ||
    hasBanglaCountryIntent(normalized, 'ভারত', 'ভারতীয়', 'ভারতে') ||
    hasBanglaCountryIntent(normalized, 'ভারত', 'ভারতীয়', 'ভারতে');

  const mentionsBangladesh =
    hasEnglishCountryIntent(normalized, 'bangladesh', 'bangladeshi', 'bangladesh') ||
    hasBanglaCountryIntent(normalized, 'বাংলাদেশ', 'বাংলাদেশি', 'বাংলাদেশে') ||
    hasBanglaCountryIntent(normalized, 'বাংলাদেশ', 'বাংলাদেশী', 'বাংলাদেশে');

  if (mentionsIndia === mentionsBangladesh) return null;
  return mentionsIndia ? 'IN' : 'BD';
}
