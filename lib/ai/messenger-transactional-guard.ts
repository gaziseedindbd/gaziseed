export type MessengerTransactionalCategory =
  | 'order_success'
  | 'payment_action'
  | 'payment_success'
  | null;

function normalizeTransactionalReply(reply: string): string {
  return reply.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Classify AI-generated transactional claims before a reply is sent.
 *
 * The AI is never an authority for order/payment state. These categories are
 * intentionally limited to claims/actions that require a deterministic backend
 * transaction or official payment flow.
 */
export function classifyMessengerTransactionalReply(
  reply: string,
): MessengerTransactionalCategory {
  const normalized = normalizeTransactionalReply(reply);

  // Explicit order-completion assertions, including broader wording that the
  // previous regex-only guard did not cover (processed/complete/purchase done).
  const orderSuccessClaim =
    /(?:\border\s+(?:is\s+)?(?:ready|prepared|created|confirmed|placed|processed|complete|completed|successful)\b|(?:your|the)\s+(?:order|purchase)\s+(?:has\s+been\s+)?(?:created|confirmed|placed|processed|completed|complete|successful|done)\b|(?:আপনার\s+)?(?:অর্ডার|কেনাকাটা|ক্রয়|ক্রয়)\s*(?:প্রস্তুত|তৈরি(?:\s*(?:হয়েছে|হয়েছে))?|কনফার্ম|নিশ্চিত|প্রসেস(?:ড|\s*হয়েছে|\s*হয়েছে)?|সম্পন্ন|সফল(?:ভাবে)?)) /i.test(
      normalized,
    ) ||
    /(?:\b(?:your\s+)?purchase\b).{0,30}\b(?:complete|completed|processed|confirmed|done)\b/i.test(
      normalized,
    );

  // Payment actions are unsafe when the AI presents or directs the customer to
  // a payment CTA/link/button, or asks for an advance payment.
  const paymentActionClaim =
    /(?:https?:\/\/\S+|payment\s+(?:button|link|url)|(?:click|tap|open|use)\s+(?:the\s+)?(?:payment\s+)?(?:button|link|url)|pay\s*(?:₹|৳|rs\.?|inr|bdt)?\s*\d+(?:\.\d+)?\s*(?:now|today)?|cod\s+advance|advance\s+payment|পেমেন্ট\s*(?:বাটন|লিংক|url)|(?:ক্লিক|ট্যাপ|ব্যবহার)\s*(?:করুন|করো).{0,30}(?:পেমেন্ট|লিংক|বাটন)|পেমেন্ট\s*করুন|cod\s*advance)/i.test(
      normalized,
    );

  // Payment-success assertions include transaction wording so novel but
  // common phrases such as "transaction went through" cannot pass as AI truth.
  const paymentSuccessClaim =
    /(?:payment\s+(?:is\s+)?(?:successful|successfully|completed|complete|received|done|processed|confirmed|approved|went\s+through)\b|(?:the\s+)?transaction\s+(?:is\s+)?(?:successful|successfully|completed|complete|received|done|processed|confirmed|approved|went\s+through)\b|(?:your\s+)?payment\s+(?:has\s+been\s+)?(?:received|processed|confirmed|approved)\b|পেমেন্ট\s*(?:সফল|সফলভাবে|সম্পন্ন|হয়ে গেছে|হয়েছে|পেয়েছি|পাওয়া গেছে|পাওয়া গেছে|প্রক্রিয়া(?:জাত|\s*হয়েছে|\s*হয়েছে)|নিশ্চিত)|(?:লেনদেন|ট্রানজ্যাকশন)\s*(?:সফল|সফলভাবে|সম্পন্ন|হয়ে গেছে|হয়েছে|নিশ্চিত|অনুমোদিত))/i.test(
      normalized,
    );

  if (orderSuccessClaim) return 'order_success';
  if (paymentActionClaim) return 'payment_action';
  if (paymentSuccessClaim) return 'payment_success';

  return null;
}

export function isUnsafeMessengerTransactionalReply(reply: string): boolean {
  return classifyMessengerTransactionalReply(reply) !== null;
}

export function getMessengerTransactionalGuardReply(): string {
  return 'আপনার অর্ডার বা পেমেন্ট আমি এই chat reply থেকে তৈরি/নিশ্চিত করতে পারি না। অর্ডার করতে product-এর “Order Now” ব্যবহার করুন, অথবা পণ্যের নাম লিখে অর্ডার শুরু করুন। নিরাপদ payment link শুধু official order flow থেকেই দেওয়া হবে।';
}
