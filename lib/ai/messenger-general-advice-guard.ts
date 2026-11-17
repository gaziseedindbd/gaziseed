import type { AIChatMessage } from './types';

/**
 * Safety filter for general agricultural advice in Messenger replies.
 *
 * A general seed-growing answer (for example, how to sow chili seeds) must
 * NOT be refused just because it contains ordinary how-to numbers such as
 * soaking hours, sowing depth in cm, plant spacing, or watering frequency.
 * Only genuinely unsafe specifics are filtered:
 * - numbers/dosages tied to fertilizer, pesticide, chemical, or medicine
 *   words (including named chemical products),
 * - disease/pest diagnoses combined with a treatment, chemical, dosage, or
 *   diagnosis cue,
 * - unnamed mixture dosages ("50 gram per litre, mix and spray").
 *
 * When a reply is still flagged, the webhook retries the AI call once with
 * an instruction to answer again without any numbers or chemical specifics
 * (see MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION); only if that
 * retry is still flagged does the customer get the human-support reply.
 */

// ASCII + Bengali + Devanagari digits.
const DIGIT = '[0-9০-৯०-९]';

// A number, optionally a range ("6-8") and optionally a decimal.
const NUMBER = `${DIGIT}+(?:[.,]${DIGIT}+)?(?:\\s*[-–]\\s*${DIGIT}+(?:[.,]${DIGIT}+)?)?`;

// Wrap ASCII-only words in \b so short words (rot, spot, g, l) cannot match
// inside unrelated words. Bengali/Devanagari words keep substring matching,
// matching the rest of the Messenger intent code.
function wordPattern(words: string[]): string {
  const ascii = words
    .filter((word) => /^[A-Za-z]+$/.test(word))
    .map((word) => `\\b${word}\\b`);
  const other = words.filter((word) => !/^[A-Za-z]+$/.test(word));
  return [...other, ...ascii].join('|');
}

// Words that turn a nearby number into a chemical/fertilizer/pesticide
// dosage. Plain "spray" is included: a spray interval is a treatment
// schedule, and a water-only spray rewritten without numbers is still a
// correct answer.
const CHEMICAL_WORDS = [
  'সার',
  'কীটনাশক',
  'ছত্রাকনাশক',
  'আগাছানাশক',
  'রাসায়নিক',
  'ওষুধ',
  'ঔষধ',
  'মাত্রা',
  'ডোজ',
  'স্প্রে',
  'ইউরিয়া',
  'ডিএপি',
  'পটাশ',
  'এনপিকে',
  'টিএসপি',
  'বোরন',
  'কার্বেনডাজিম',
  'ম্যানকোজেব',
  'ইমিডাক্লোপ্রিড',
  'ক্লোরপাইরিফস',
  'ডাইমেথোয়েট',
  'জিংক সালফেট',
  'কপার অক্সিক্লোরাইড',
  'fertilizer',
  'fertiliser',
  'pesticide',
  'insecticide',
  'fungicide',
  'herbicide',
  'chemical',
  'medicine',
  'drug',
  'dosage',
  'dose',
  'spray',
  'urea',
  'potash',
  'boron',
  'उर्वरक',
  'कीटनाशक',
  'फफूंदनाशक',
  'खरपतवारनाशक',
  'रासायनिक',
  'दवा',
  'खुराक',
  'यूरिया',
  'पोटाश',
  'स्प्रे',
];

// Specific chemical product names. Naming one is forbidden even without a
// number (for example, "apply carbendazim"), so presence alone flags.
const NAMED_CHEMICALS = [
  'ইউরিয়া',
  'ডিএপি',
  'পটাশ',
  'এনপিকে',
  'টিএসপি',
  'কার্বেনডাজিম',
  'ম্যানকোজেব',
  'ইমিডাক্লোপ্রিড',
  'ক্লোরপাইরিফস',
  'ডাইমেথোয়েট',
  'জিংক সালফেট',
  'কপার অক্সিক্লোরাইড',
  'urea',
  'carbendazim',
  'mancozeb',
  'imidacloprid',
  'chlorpyrifos',
  'dimethoate',
  'copper oxychloride',
  'zinc sulphate',
  'zinc sulfate',
  'यूरिया',
  'डीएपी',
  'पोटाश',
  'एनपीके',
  'DAP',
  'MOP',
  'NPK',
  'TSP',
];

const DISEASE_PEST_WORDS = [
  'রোগ',
  'পোকা',
  'ছত্রাক',
  'ভাইরাস',
  'ব্যাকটেরিয়া',
  'পচা',
  'পচন',
  'দাগ',
  'ঝলসা',
  'মিলিবাগ',
  'এফিড',
  'জাবপোকা',
  'মাকড়',
  'শুঁয়োপোকা',
  'শুয়োপোকা',
  'কৃমি',
  'ঢলে',
  'মোজাইক',
  'disease',
  'pest',
  'fungus',
  'fungal',
  'virus',
  'bacteria',
  'bacterial',
  'rot',
  'blight',
  'spot',
  'mildew',
  'mealybug',
  'aphid',
  'mite',
  'caterpillar',
  'worm',
  'wilt',
  'mosaic',
  'रोग',
  'कीट',
  'फफूंद',
  'वायरस',
  'जीवाणु',
  'सड़न',
  'धब्बा',
  'झुलसा',
  'माहू',
  'एफिड',
  'मकड़ी',
  'सुंडी',
  'कृमि',
  'मुरझाना',
];

const TREATMENT_WORDS = [
  'চিকিৎসা',
  'নিরাময়',
  'প্রতিকার',
  'দমন',
  'প্রয়োগ',
  'স্প্রে',
  'সময়সূচি',
  'treatment',
  'cure',
  'remedy',
  'control',
  'apply',
  'application',
  'spray',
  'schedule',
  'diagnosis',
  'diagnose',
  'इलाज',
  'उपचार',
  'निदान',
  'रोकथाम',
  'छिड़काव',
  'प्रयोग',
];

const DIAGNOSIS_WORDS = [
  'লক্ষণ',
  'আক্রমণ',
  'আক্রান্ত',
  'সংক্রমণ',
  'উপসর্গ',
  'symptom',
  'attack',
  'infestation',
  'infected',
  'infection',
  'लक्षण',
  'हमला',
  'संक्रमण',
  'संक्रमित',
];

// Units that make a number a mixture dosage ("50 gram per litre").
const DOSAGE_UNITS = [
  'গ্রাম',
  'কেজি',
  'মিলি',
  'লিটার',
  'চামচ',
  'ফোঁটা',
  'grams',
  'gram',
  'kilograms',
  'kilogram',
  'millilitres',
  'milliliters',
  'millilitre',
  'milliliter',
  'litres',
  'liters',
  'litre',
  'liter',
  'teaspoons',
  'teaspoon',
  'tablespoons',
  'tablespoon',
  'spoons',
  'spoon',
  'drops',
  'drop',
  'ग्राम',
  'किलो',
  'मिली',
  'लीटर',
  'चम्मच',
  'बूंद',
  'mg',
  'kg',
  'ml',
  'g',
  'l',
];

const MIX_WORDS = [
  'প্রতি',
  'মিশিয়ে',
  'মিশান',
  'গুলে',
  'দ্রবণ',
  'মিশ্রণ',
  'per',
  'mix',
  'solution',
  'प्रति',
  'मिलाकर',
  'घोल',
];

const CHEMICAL_PATTERN = wordPattern(CHEMICAL_WORDS);
const NAMED_CHEMICAL_PATTERN = wordPattern(NAMED_CHEMICALS);
const DISEASE_PEST_PATTERN = wordPattern(DISEASE_PEST_WORDS);
const TREATMENT_PATTERN = wordPattern(TREATMENT_WORDS);
const DIAGNOSIS_PATTERN = wordPattern(DIAGNOSIS_WORDS);
const DOSAGE_UNIT_PATTERN = wordPattern(DOSAGE_UNITS);
const MIX_PATTERN = wordPattern(MIX_WORDS);

// A chemical word within 80 characters of a number (either direction).
const CHEMICAL_DOSAGE_PATTERN = new RegExp(
  `(?:${CHEMICAL_PATTERN})[^\\n]{0,80}${DIGIT}|${DIGIT}[^\\n]{0,80}(?:${CHEMICAL_PATTERN})`,
  'i',
);

const NAMED_CHEMICAL_PATTERN_REGEX = new RegExp(
  `(?:${NAMED_CHEMICAL_PATTERN})`,
  'i',
);

// A disease/pest word combined with a treatment, chemical, dosage, or
// diagnosis cue within 80 characters. A bare disease/pest mention with
// none of those (for example, "keep the area clean to avoid pests") is
// ordinary safe guidance and does not flag.
const DISEASE_TREATMENT_PATTERN = new RegExp(
  `(?:${DISEASE_PEST_PATTERN})[^\\n]{0,80}(?:${TREATMENT_PATTERN}|${CHEMICAL_PATTERN}|${DIAGNOSIS_PATTERN}|${DIGIT})` +
    `|(?:${TREATMENT_PATTERN}|${CHEMICAL_PATTERN}|${DIAGNOSIS_PATTERN}|${DIGIT})[^\\n]{0,80}(?:${DISEASE_PEST_PATTERN})`,
  'i',
);

// An unnamed mixture dosage: a number with a weight/volume unit next to a
// mixing word ("50 gram per litre", "প্রতি লিটারে ৫০ গ্রাম মিশিয়ে দিন").
// Ordinary watering ("২ লিটার পানি দিন") has no mixing word and does not flag.
const DOSAGE_MIX_PATTERN = new RegExp(
  `(?:${MIX_PATTERN})[^\\n]{0,40}${NUMBER}\\s*(?:${DOSAGE_UNIT_PATTERN})` +
    `|${NUMBER}\\s*(?:${DOSAGE_UNIT_PATTERN})[^\\n]{0,40}(?:${MIX_PATTERN})`,
  'i',
);

/**
 * True only when a reply contains genuinely unsafe agricultural specifics:
 * a chemical/fertilizer/pesticide dosage, a named chemical product, a
 * disease/pest diagnosis with a treatment, or an unnamed mixture dosage.
 * Ordinary how-to numbers (soaking hours, sowing depth, spacing, watering,
 * germination days) do not flag.
 */
export function hasUnsafeGeneralAgricultureSpecifics(text: string): boolean {
  // "Disease-free / pest-free seed" is safe preventive guidance, not a
  // diagnosis, so it must not trip the disease rule when a nearby number
  // (for example, germination days) is present.
  const normalized = text
    .toLocaleLowerCase()
    .replace(/রোগমুক্ত|রোগ মুক্ত|পোকামুক্ত|পোকা মুক্ত|disease-free|disease free|pest-free|pest free|रोग मुक्त|रोग-मुक्त/gi, '');
  return (
    CHEMICAL_DOSAGE_PATTERN.test(normalized) ||
    NAMED_CHEMICAL_PATTERN_REGEX.test(normalized) ||
    DISEASE_TREATMENT_PATTERN.test(normalized) ||
    DOSAGE_MIX_PATTERN.test(normalized)
  );
}

/**
 * One-time rewrite instruction used when a general-agriculture reply is
 * still flagged: answer again in 3-4 short lines with no numbers,
 * measurements, durations, dosages, chemical names, disease names, pest
 * diagnoses, or treatment schedules.
 */
export const MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION =
  "Answer the customer's latest question again in at most 3-4 short lines, in the same language as the customer question. " +
  'Use only safe, general, practical guidance. Do not include any numbers, measurements, durations, dosages, chemical names, fertilizer or pesticide names, disease names, pest diagnoses, or treatment schedules. Do not invent any specifics.';

/** True when a general-agriculture reply must be rewritten once. */
export function shouldRewriteGeneralAgricultureReply(
  isGeneralAgricultureMessage: boolean,
  content: string,
): boolean {
  return (
    isGeneralAgricultureMessage &&
    hasUnsafeGeneralAgricultureSpecifics(content)
  );
}

/** The retry call reuses the original messages plus the rewrite instruction. */
export function appendGeneralAgricultureRewriteInstruction(
  messages: AIChatMessage[],
): AIChatMessage[] {
  return [
    ...messages,
    {
      role: 'user',
      content: MESSENGER_GENERAL_AGRICULTURE_REWRITE_INSTRUCTION,
    },
  ];
}
