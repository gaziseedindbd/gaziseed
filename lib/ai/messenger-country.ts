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

function hasRomanBanglishCountryIntent(normalized: string, country: string): boolean {
  // Roman-Banglish country statements, the Latin-script equivalent of the
  // Bengali-script "<country> থেকে" pattern above:
  // - "<country> theke" — "Bangladesh theke order korte chai",
  //   "ami Bangladesh theke bolchi", "India theke delivery hobe?"
  // - "ami <country>" — "ami Bangladesh", "ami India theke achi".
  // The word boundary after the country word keeps product adjectives out:
  // "Bangladeshi beej" / "Indian seeds" do not match.
  return (
    new RegExp('\\b' + country + '\\s+theke\\b', 'i').test(normalized) ||
    new RegExp('\\bami\\s+' + country + '\\b', 'i').test(normalized)
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
    // An explicit country followed by a seed/catalog request selects that branch too.
    new RegExp(postposition + '.{0,80}(?:বীজ|পণ্য|প্রোডাক্ট|তালিকা|লিস্ট|দাম|স্টক)', 'i').test(normalized) ||
    // Allow an amount or order subtotal between the country phrase and the
    // delivery/order keyword, e.g. "বাংলাদেশে ৳৫০০ টাকার অর্ডারে ডেলিভারি...".
    new RegExp(postposition + '.{0,48}(?:অর্ডার|ডেলিভারি|শিপিং)', 'i').test(normalized) ||
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
    hasRomanBanglishCountryIntent(normalized, 'india') ||
    hasRomanBanglishCountryIntent(normalized, 'bharat') ||
    hasBanglaCountryIntent(normalized, 'ভারত', 'ভারতীয়', 'ভারতে') ||
    hasBanglaCountryIntent(normalized, 'ভারত', 'ভারতীয়', 'ভারতে');

  const mentionsBangladesh =
    hasEnglishCountryIntent(normalized, 'bangladesh', 'bangladeshi', 'bangladesh') ||
    hasRomanBanglishCountryIntent(normalized, 'bangladesh') ||
    hasBanglaCountryIntent(normalized, 'বাংলাদেশ', 'বাংলাদেশি', 'বাংলাদেশে') ||
    hasBanglaCountryIntent(normalized, 'বাংলাদেশ', 'বাংলাদেশী', 'বাংলাদেশে');

  if (mentionsIndia === mentionsBangladesh) return null;
  return mentionsIndia ? 'IN' : 'BD';
}

/**
 * Whether a detected country gets the explicit confirmation + catalog reply
 * (the "ঠিক আছে। আপনার জন্য Bangladesh 🇧🇩 সাপোর্ট তথ্য ব্যবহার করা হবে।"
 * message) instead of falling through to the AI reply.
 *
 * - An exact country word ("india" / "bangladesh") always confirms, as before.
 * - A free-text sentence that CHANGES the country ("ami Bangladesh theke
 *   bolchi" from an India conversation) also confirms, so the customer is
 *   told the country actually switched instead of the AI improvising a
 *   misleading acknowledgement ("জানিয়ে ভালো লাগল") while nothing changed.
 * - No confirmation when the free-text country is the one already verified
 *   (nothing changed), and quick-reply button taps keep their existing flow.
 */
export function shouldConfirmMessengerCountrySelection(options: {
  quickReplyCountry: MessengerCountryCode | null;
  freeTextCountry: MessengerCountryCode | null;
  currentCountry: MessengerCountryCode | null;
  isExactCountrySelection: boolean;
}): boolean {
  if (options.isExactCountrySelection) return true;
  return (
    options.quickReplyCountry === null &&
    options.freeTextCountry !== null &&
    options.freeTextCountry !== options.currentCountry
  );
}
