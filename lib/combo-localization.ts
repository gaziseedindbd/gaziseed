export type ComboLanguage = 'en' | 'bn' | 'hi';

export function comboCopy(lang: string, en: string, bn: string, hi: string): string {
  return lang === 'bn' ? bn : lang === 'hi' ? hi : en;
}

export function localizedField(row: Record<string, any> | null | undefined, lang: string, key: string, fallback = ''): string {
  if (!row) return fallback;
  const candidates = [row.translations?.[lang]?.[key],
    lang === 'en' ? row[`${key}_en`] : lang === 'bn' ? row[`${key}_bn`] : null,
    row.translations?.en?.[key], row[`${key}_en`],
    row.translations?.bn?.[key], row[`${key}_bn`], row[key], fallback];
  return candidates.find(value => typeof value === 'string' && value.trim())?.trim() || fallback;
}
