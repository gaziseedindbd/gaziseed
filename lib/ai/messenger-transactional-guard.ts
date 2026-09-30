export function isUnsafeMessengerTransactionalReply(reply: string): boolean {
  const normalized = reply.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

  const positiveOrderClaim =
    /(?:\border\s+(?:is\s+)?(?:ready|prepared|created|confirmed|placed)\b|(?:your|আপনার)\s+order\s+(?:has\s+been\s+)?(?:created|confirmed|placed)\b|অর্ডার\s*(?:প্রস্তুত|তৈরি হয়েছে|তৈরি হয়েছে|কনফার্ম|নিশ্চিত)\b)/i.test(
      normalized,
    );

  const paymentActionClaim =
    /(?:payment\s+(?:button|link|url)|pay\s*(?:৳|₹|rs\.?|inr|bdt)?\s*\d+|cod\s+advance|পেমেন্ট\s*(?:বাটন|লিংক|url)|পেমেন্ট\s*করুন|cod\s*advance)/i.test(
      normalized,
    );

  const paymentSuccessClaim =
    /(?:payment\s+(?:successful|successfully|completed|complete|received|done)\b|পেমেন্ট\s*(?:সফল|সফলভাবে|সম্পন্ন|হয়ে গেছে|হয়েছে|পেয়েছি))/i.test(
      normalized,
    );

  return positiveOrderClaim || paymentActionClaim || paymentSuccessClaim;
}

export function getMessengerTransactionalGuardReply(): string {
  return 'আপনার অর্ডার বা পেমেন্ট আমি এই chat reply থেকে তৈরি/নিশ্চিত করতে পারি না। অর্ডার করতে product-এর “Order Now” ব্যবহার করুন, অথবা পণ্যের নাম লিখে অর্ডার শুরু করুন। নিরাপদ payment link শুধু official order flow থেকেই দেওয়া হবে।';
}
