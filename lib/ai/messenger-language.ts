export type MessengerReplyLanguage = 'English' | 'Bengali' | 'Hindi';

const HINDI_LATIN_HINTS = new Set([
  'kaise', 'kya', 'hai', 'hain', 'ka', 'ki', 'ke',
  'haan', 'han', 'nahi', 'nahin', 'theek', 'sahi', 'ko', 'mein', 'me',
  'se', 'par', 'kab', 'kahan', 'kahaan', 'kitna', 'kitne', 'kitni',
  'chahiye', 'ugana', 'ugaye', 'ugayein', 'ugao', 'ugane', 'batao',
  'bataiye', 'bataye', 'karna', 'kare', 'karo', 'kijiye', 'mujhe',
  'mera', 'meri', 'mere', 'aap', 'aapka', 'aapki', 'aapke', 'yeh',
  'ye', 'woh', 'koi', 'milta', 'milega', 'denge', 'dena', 'do',
]);

const ENGLISH_LATIN_HINTS = new Set([
  'how', 'what', 'when', 'where', 'which', 'why', 'is', 'are', 'am',
  'the', 'this', 'that', 'these', 'those', 'price', 'grow', 'from',
  'seed', 'seeds', 'please', 'can', 'could', 'would', 'you', 'your',
  'tell', 'have', 'available', 'stock', 'buy', 'order', 'payment',
  'status', 'delivery', 'shipping', 'need', 'want', 'give', 'show',
]);

function tokenScore(text: string, hints: Set<string>): number {
  const tokens = text
    .toLocaleLowerCase()
    .match(/[a-z]+/g) || [];

  return tokens.reduce((score, token) => score + (hints.has(token) ? 1 : 0), 0);
}

export function detectMessengerReplyLanguage(text: string): MessengerReplyLanguage {
  const value = text.trim();

  // Native scripts are authoritative.
  if (/[\u0980-\u09FF]/.test(value)) return 'Bengali';
  if (/[\u0900-\u097F]/.test(value)) return 'Hindi';

  // Latin-script Hinglish/Roman-Hindi should remain Hindi even when the
  // message is short, e.g. "2 packet chahiye", "haan", or "mujhe chahiye".
  const hindiScore = tokenScore(value, HINDI_LATIN_HINTS);
  const englishScore = tokenScore(value, ENGLISH_LATIN_HINTS);

  if (hindiScore > englishScore && hindiScore >= 1) return 'Hindi';
  if (englishScore > 0) return 'English';

  return 'English';
}
