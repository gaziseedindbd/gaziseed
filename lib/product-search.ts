const BENGALI_TO_LATIN: Record<string, string> = {
  'অ':'o','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou',
  'া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou',
  'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng','চ':'ch','ছ':'chh','জ':'j','ঝ':'jh','ঞ':'ny',
  'ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n','ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n',
  'প':'p','ফ':'ph','ব':'b','ভ':'bh','ম':'m','য':'j','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s','হ':'h',
  'ড়':'r','ঢ়':'rh','য়':'y','ং':'ng','ঃ':'h','ঁ':'n','্':'','়':'',
};

export function normalizeProductSearch(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function transliterateBengali(value: string): string {
  const chars = Array.from(value);
  let output = '';
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const mapped = BENGALI_TO_LATIN[char];
    if (mapped === undefined) {
      output += char;
      continue;
    }
    if (char === '্') continue;
    output += mapped;
    const isConsonant = /[ক-হড়ঢ়য়]/.test(char);
    const next = chars[i + 1];
    if (isConsonant && next === '্') {
      i += 1;
    } else if (isConsonant && next && !/[া-ৌ]/.test(next)) {
      output += 'o';
    }
  }
  return normalizeProductSearch(output);
}

export function productMatchesSearch(product: { name_bn?: string | null; name_en?: string | null; sku?: string | null; slug?: string | null }, query: string): boolean {
  const needle = normalizeProductSearch(query);
  if (!needle) return true;
  const searchable = [product.name_bn, product.name_en, product.sku, product.slug].filter(Boolean).join(' ');
  const direct = normalizeProductSearch(searchable);
  if (direct.includes(needle)) return true;
  const romanized = transliterateBengali(product.name_bn || '');
  return romanized.includes(needle);
}
