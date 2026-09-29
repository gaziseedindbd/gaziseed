export function normalizeMessengerIntentText(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function isOtherProductRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);

  const hasAlternativeWord =
    /\b(?:other|another|different|more|additional)\b/i.test(normalized);
  const hasProductLikeWord =
    /\bprod[a-z0-9_-]*\b/i.test(normalized) ||
    /\bitem[a-z0-9_-]*\b/i.test(normalized) ||
    /(?:প্রোডাক্ট|পণ্য)/i.test(normalized);
  const hasBrowseWord =
    /\b(?:show|see|view|browse|looking|want|need)\b/i.test(normalized) ||
    /(?:dekh|dekha|dekhte|dekhan|dekhao|chai|chaie|chaye|দেখ|চাই)/i.test(
      normalized,
    );

  return (
    /\b(?:other|another|different|more|additional)\s+(?:prod[a-z0-9_-]*|item[a-z0-9_-]*)\b/i.test(
      normalized,
    ) ||
    /\b(?:prod[a-z0-9_-]*|item[a-z0-9_-]*)\s+(?:other|another|different|more|additional)\b/i.test(
      normalized,
    ) ||
    (hasAlternativeWord && hasProductLikeWord && hasBrowseWord) ||
    /(অন্য|আরও|আর|আরেক|অন্যটা|অন্যগুলো).*(প্রোডাক্ট|পণ্য|prod[a-z0-9_-]*|item[a-z0-9_-]*)/i.test(
      normalized,
    ) ||
    /(প্রোডাক্ট|পণ্য|prod[a-z0-9_-]*|item[a-z0-9_-]*).*(অন্য|আরও|আর|আরেক|অন্যটা|অন্যগুলো)/i.test(
      normalized,
    )
  );
}

export function isProductAvailabilityQuestion(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);

  return /(?:\b(?:ki|kono|kon|what|which|any|anything)\s+(?:products?|product)\s+(?:(?:is|are)\s+)?(?:ache|ase|nei|naie|available|there)\b|(?:ki|kono|kon|কী|কি|কোনো|কোন)\s*(?:কি\s*)?(?:প্রোডাক্ট|পণ্য|products?|product)\s*(?:আছে|আছেন|নেই|নাই|naie|nei|ache|ase|available|there)|(?:কোনো|কোন)\s*(?:প্রোডাক্ট|পণ্য|products?|product)\s*(?:নেই|নাই|আছে|আছেন)|\b(?:anything|any)\s+(?:available|in stock|there)\b)/i.test(
    normalized,
  );
}

export function isProductCatalogRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);

  return (
    isOtherProductRequest(normalized) ||
    isProductAvailabilityQuestion(normalized) ||
    /(products?|product list|catalog|কি কি প্রোডাক্ট|কী কী প্রোডাক্ট|কি কি পণ্য|কী কী পণ্য|পণ্যগুলো|পণ্য কী কী|কি কি আছে|কী কী আছে|available products|what products|what do you have|তোমাদের কাছে|আপনাদের কাছে|দাম|price|স্টক|stock|available|উপলব্ধ)/i.test(
      normalized,
    )
  );
}

export function isProductListRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return (
    isOtherProductRequest(normalized) ||
    isProductAvailabilityQuestion(normalized) ||
    /(products?|product list|catalog|কি কি প্রোডাক্ট|কী কী প্রোডাক্ট|কি কি পণ্য|কী কী পণ্য|পণ্যগুলো|পণ্য কী কী|কি কি আছে|কী কী আছে|available products|what products|what do you have|তোমাদের কাছে|আপনাদের কাছে)/i.test(
      normalized,
    )
  );
}

export function isMessengerDeliveryIntent(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(delivery|deliver|shipping|ship|courier|cod|cash on delivery|delivery charge|shipping charge|delivery fee|delivery time|কুরিয়ার|ডেলিভারি|শিপিং|ডেলিভারি চার্জ|ডেলিভারি ফি|ডেলিভারি খরচ|কত টাকা ডেলিভারি|কখন পাব|কত দিনে|ক্যাশ অন ডেলিভারি|সিওডি)/i.test(
    normalized,
  );
}

export function isMessengerSeedKnowledgeQuestion(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  const hasSeedTopic =
    /(seed|seeds|বীজ|চারা|গাছ|ফসল|সবজি|ফুল|বাগান|কৃষি|চাষ|রোপণ|বপন|অঙ্কুরোদগম|germination|sowing|planting|cultivation|variety|season|fertilizer|সার|মাটি|soil|পানি|জল|watering)/i.test(
      normalized,
    );
  const hasQuestionOrAdviceIntent =
    /(কীভাবে|কিভাবে|কী ভাবে|কি ভাবে|কী করে|কি করে|কখন|কতদিন|কত দিনে|অঙ্কুর|বপন|রোপণ|পরিচর্যা|মাটি|সার|পানি|জল|ব্র্যান্ড|জাত|variety|season|germination|sow|sowing|plant|planting|care|soil|fertilizer|water|watering|brand|origin|কোথাকার|উৎপত্তি|details|about|তথ্য|বিস্তারিত)/i.test(
      normalized,
    );

  return hasSeedTopic && hasQuestionOrAdviceIntent;
}

export function isMessengerHumanSupportIntent(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(human|agent|support|representative|talk to (a )?person|speak to (a )?person|customer care|customer service|মানুষের সাথে|মানুষের সঙ্গে|মানুষের সাথে কথা|কথা বলতে চাই|কথা বলতে চান|কাস্টমার কেয়ার|কাস্টমার কেয়ার|কাস্টমার সার্ভিস|সাপোর্টে কথা)/i.test(
    normalized,
  );
}

export function isMessengerOrderResumeRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(\b(?:continue|resume|go on|pick up|previous order|my previous order|old order)\b|আগের অর্ডার|আগেরটা|আগের অর্ডারটা|অর্ডার (?:চালু|চালিয়ে|চালিয়ে)|চালিয়ে যেতে চাই|চালিয়ে যেতে চাই|আবার অর্ডার|order continue)/i.test(
    normalized,
  );
}

export function isMessengerOrderInterruptRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);

  if (isMessengerOrderResumeRequest(normalized)) return false;
  if (isProductCatalogRequest(normalized)) return true;
  if (isMessengerDeliveryIntent(normalized)) return true;
  if (isMessengerHumanSupportIntent(normalized)) return true;
  if (isMessengerSeedKnowledgeQuestion(normalized)) return true;
  if (isMessengerOrderTrackingRequest(normalized)) return true;

  return /\b(?:help|information|info|details|about)\b/i.test(normalized);
}


export function isMessengerOrderTrackingRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  if (/\bGS-(?:IN|BD)-[A-Z0-9]{8}\b/i.test(normalized)) return true;
  return /(track|tracking|status|where.*order|order.*status|my order|previous order|last order|latest order|delivery status|কোথায়.*অর্ডার|অর্ডার.*কোথায়|অর্ডার.*স্ট্যাটাস|অর্ডারের.*অবস্থা|অর্ডার.*কখন পাব|আমার অর্ডার|আগের অর্ডার|শেষ অর্ডার|অর্ডার ট্র্যাক|অর্ডার.*ট্র্যাক)/i.test(
    normalized,
  );
}
