export function normalizeMessengerIntentText(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/\bprodcuts?\b/g, 'products')
    .replace(/\bprod(?:cut|cuct|ect|duct)\b/g, 'product')
    .replace(/\s+/g, ' ')
    .trim();
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

export function isMessengerChangeDetailsRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);

  return (
    normalized.includes('তথ্য পরিবর্তন') ||
    normalized.includes('তথ্য বদল') ||
    normalized.includes('ডিটেইলস পরিবর্তন') ||
    normalized.includes('ডিটেইলস বদল') ||
    normalized.includes('নাম পরিবর্তন') ||
    normalized.includes('নাম বদল') ||
    normalized.includes('ফোন পরিবর্তন') ||
    normalized.includes('ফোন বদল') ||
    normalized.includes('মোবাইল পরিবর্তন') ||
    normalized.includes('মোবাইল বদল') ||
    normalized.includes('ঠিকানা পরিবর্তন') ||
    normalized.includes('ঠিকানা বদল') ||
    /(^| )change( my)? (details|information|info|address|phone|mobile|name)( |$)/i.test(normalized) ||
    /(^| )edit( my)? (details|information|info|address|phone|mobile|name)( |$)/i.test(normalized) ||
    /(^| )use a different (details|address|phone|mobile|name)( |$)/i.test(normalized)
  );
}
export function isMessengerOrderResumeRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(\b(?:continue|resume|go on|pick up|previous order|my previous order|old order)\b|আগের অর্ডার|আগেরটা|আগের অর্ডারটা|অর্ডার (?:চালু|চালিয়ে|চালিয়ে)|চালিয়ে যেতে চাই|চালিয়ে যেতে চাই|আবার অর্ডার|order continue)/i.test(
    normalized,
  );
}

export function isMessengerRecommendationRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);

  return /(?:\brecommend(?:ed|ation)?\b|\bsuggest(?:ion|ions)?\b|what should i (?:buy|get|choose)|which (?:product|seed) should i (?:buy|get|choose)|what do you recommend|কোনটা\s+(?:নেব|নিতে|ভালো)|কোন\s+(?:পণ্য|বীজ)\s+(?:নেব|নিতে)|আমার জন্য\s+(?:কি|কী)\s+(?:নেব|ভালো)|পরামর্শ\s+দিন)/i.test(
    normalized,
  );
}

export function isMessengerOrderInterruptRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);

  if (isMessengerOrderResumeRequest(normalized)) return false;
  if (isProductCatalogRequest(normalized)) return true;
  if (isMessengerDeliveryIntent(normalized)) return true;
  if (isMessengerHumanSupportIntent(normalized)) return true;
  if (isMessengerRecommendationRequest(normalized)) return true;
  if (isMessengerSeedKnowledgeQuestion(normalized)) return true;
  if (isMessengerCustomerProfileRequest(normalized)) return true;
  if (isMessengerOrderHistoryRequest(normalized)) return true;
  if (isMessengerOrderTrackingRequest(normalized)) return true;

  return /\b(?:help|information|info|details|about)\b/i.test(normalized);
}


export function isMessengerOrderLinkRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  const hasOrderNumber = /\bGS-(?:IN|BD)-[A-Z0-9]{8}\b/i.test(normalized);
  const hasMobileNumber = /(?:\+?\d[\d\s().-]{8,}\d)/.test(normalized);
  return hasOrderNumber && hasMobileNumber;
}

export function isMessengerPaymentStatusRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);

  return (
    /\bGS-(?:IN|BD)-[A-Z0-9]{8}\b/i.test(normalized) &&
    /(?:payment|paid|advance|পেমেন্ট|পেমেন্টের|অগ্রিম|টাকা).*(?:status|check|done|successful|pending|failed|হয়েছে|হয়েছে|অবস্থা|স্ট্যাটাস|চেক)/i.test(
      normalized,
    )
  ) || /(?:payment\s*(?:status|check|done|successful|pending|failed)|payment\s*(?:হয়েছে|হয়েছে|হয়েছে কি|হয়েছে কি|কিনা|কী অবস্থা|কি অবস্থা)|পেমেন্ট(?:ের)?\s*(?:স্ট্যাটাস|অবস্থা|চেক|হয়েছে|হয়েছে|হয়েছে কি|হয়েছে কি|কিনা)|অগ্রিম\s*payment|advance\s*payment\s*(?:status|check)|টাকা\s*(?:গেছে|পেয়েছি|পেয়েছি)\s*কি)/i.test(
    normalized,
  );
}

export function isMessengerOrderTrackingRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  if (isMessengerOrderHistoryRequest(normalized)) return false;
  if (isMessengerOrderLinkRequest(normalized) && !/(track|tracking|status|where|অর্ডার.*স্ট্যাটাস|অর্ডার.*ট্র্যাক)/i.test(normalized)) {
    return false;
  }
  if (/\bGS-(?:IN|BD)-[A-Z0-9]{8}\b/i.test(normalized)) return true;
  return /(track|tracking|status|where.*order|order.*status|my order|previous order|last order|latest order|delivery status|কোথায়.*অর্ডার|অর্ডার.*কোথায়|অর্ডার.*স্ট্যাটাস|অর্ডারের.*অবস্থা|অর্ডার.*কখন পাব|আমার অর্ডার|আগের অর্ডার|শেষ অর্ডার|অর্ডার ট্র্যাক|অর্ডার.*ট্র্যাক)/i.test(
    normalized,
  );
}




export function isMessengerProductComparisonRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(?:compare|comparison|তুলনা|তুলনা করে|দুটো.*তুলনা|দুইটা.*তুলনা|কোনটা.*ভালো|which.*better)/i.test(normalized);
}

export function isMessengerCartViewRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(?:\bcart\b|shopping cart|basket|আমার কার্ট|কার্ট দেখ|কার্টে কী আছে|কার্টের পণ্য|কার্টটা দেখ|ঝুড়ি|ঝুড়ি)/i.test(normalized);
}

export function isMessengerCartRemoveRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(?:remove|delete|বাদ দাও|বাদ দিন|সরিয়ে দাও|সরিয়ে দাও|কার্ট থেকে.*বাদ|কার্ট থেকে.*সর)/i.test(normalized);
}

export function isMessengerCartQuantityChangeRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(?:quantity|qty|সংখ্যা|পরিমাণ|টা করে|টি করে|set|change).*?(?:\d|[০-৯])/i.test(normalized);
}

export function isMessengerAddToCartRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(?:add\s+(?:to\s+)?cart|add\s+this|কার্টে\s+(?:যোগ|দাও|রাখ)|কার্টে\s+নাও|cart\s+এ\s+(?:যোগ|দাও))/i.test(normalized);
}

export function isMessengerAddAnotherProductRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(add\s+(?:another|more|one\s+more)\s+(?:product|item)|another\s+product|more\s+products?|add\s+more|আরও\s+(?:পণ্য|প্রোডাক্ট)|অন্য\s+(?:পণ্য|প্রোডাক্ট)|আরেকটা\s+(?:পণ্য|প্রোডাক্ট)|আরও\s+যোগ|আরও\s+নিতে\s+চাই)/i.test(
    normalized,
  );
}

export function isMessengerCheckoutRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(\b(?:checkout|check\s*out|finish|complete\s+order|proceed)\b|অর্ডার\s+(?:শেষ|complete|করুন)|চেকআউট|এখন\s+অর্ডার|আর\s+কিছু\s+নেই|আর\s+কিছু\s+না)/i.test(
    normalized,
  );
}


export function isMessengerCustomerProfileRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  return /(?:\b(?:my|show\s+my|view\s+my)\s+(?:profile|details|information|info|account)\b|my\s+(?:name|phone|mobile|address)|(?:আমার|আমার\s+গাজী\s+সিড)\s*(?:প্রোফাইল|তথ্য|ইনফো|ডিটেইলস|অ্যাকাউন্ট|নাম|ফোন|মোবাইল|ঠিকানা)|saved\s+(?:details|address))/i.test(
    normalized,
  );
}

export function isMessengerOrderHistoryRequest(text: string): boolean {
  const normalized = normalizeMessengerIntentText(text);
  if (/(?:order\s+status|track(?:ing)?|delivery\s+status|অর্ডার\s+স্ট্যাটাস|অর্ডার\s+ট্র্যাক|অর্ডারের\s+অবস্থা)/i.test(normalized)) {
    return false;
  }

  return /(?:\border\s+(?:history|histories|list|records|archive)\b|previous\s+orders?|past\s+orders?|order\s+history|my\s+purchases?|orders?\s+i\s+(?:made|placed)|আগের\s+অর্ডার(?:গুলো|গুলি|গুলি)?|পূর্বের\s+অর্ডার|পুরনো\s+অর্ডার|অর্ডার\s+হিস্টোরি|অর্ডার\s+লিস্ট|অর্ডার\s+গুলোর\s+তথ্য|আমার\s+আগের\s+অর্ডার)/i.test(
    normalized,
  );
}
