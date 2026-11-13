'use client';

import React from 'react';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { supabase } from '@/lib/supabase/client';

export type MultilingualValue = Record<string, Record<string, string>>;

type Field = { key: string; label: string; multiline?: boolean; richText?: boolean; placeholder?: string };
type LanguageKey = 'en' | 'bn' | 'hi';

const LANGS = [
  { key: 'en', label: 'English', flag: '🇬🇧' },
  { key: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { key: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
] as const;

export function MultilingualFields({
  value,
  onChange,
  fields,
  title = 'Multilingual Content',
  description = 'একই content-এর English, বাংলা ও हिन्दी version আলাদা করে সংরক্ষণ করুন। Existing content/logic অপরিবর্তিত থাকবে।',
  languages = ['en', 'bn', 'hi'],
  enableTranslate = false,
  sourceValues = {},
}: {
  value: MultilingualValue;
  onChange: (value: MultilingualValue) => void;
  fields: Field[];
  title?: string;
  description?: string;
  languages?: LanguageKey[];
  enableTranslate?: boolean;
  sourceValues?: Record<string, string>;
}) {
  const availableLangs = LANGS.filter((item) => languages.includes(item.key));
  const [lang, setLang] = React.useState<LanguageKey>('en');
  React.useEffect(() => {
    if (!languages.includes(lang)) setLang(languages[0] || 'en');
  }, [lang, languages]);
  const current = value?.[lang] || {};
  const [translating, setTranslating] = React.useState(false);
  const [translationMessage, setTranslationMessage] = React.useState('');

  const translateAll = async () => {
    const source = { ...(sourceValues || {}), ...(value?.en || {}) };
    Object.keys(source).forEach((key) => { if (!String(source[key] || '').trim() && sourceValues?.[key]) source[key] = sourceValues[key]; });
    const sourceFields = fields.filter((field) => String(source[field.key] || '').trim());
    const targets = languages.filter((language) => language !== 'en');
    if (!sourceFields.length) {
      setTranslationMessage('আগে English content লিখুন।');
      return;
    }
    setTranslating(true);
    setTranslationMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Admin login যাচাই করা যায়নি। আবার লগইন করুন।');
      let nextValue: MultilingualValue = { ...(value || {}) };
      for (const target of targets) {
        const missingFields = sourceFields.filter((field) => !String(nextValue?.[target]?.[field.key] || '').trim());
        if (!missingFields.length) continue;
        const response = await fetch('/api/admin/translate-product-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ target, texts: missingFields.map((field) => String(source[field.key])) }),
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok || !result.ok || !Array.isArray(result.translations)) {
          throw new Error(result.message || 'অনুবাদ করা যায়নি। পরে আবার চেষ্টা করুন।');
        }
        const translatedFields: Record<string, string> = {};
        missingFields.forEach((field, index) => { translatedFields[field.key] = result.translations[index]; });
        nextValue = { ...nextValue, [target]: { ...(nextValue[target] || {}), ...translatedFields } };
      }
      onChange(nextValue);
      setTranslationMessage('খালি ভাষার Field-গুলো অনুবাদ হয়েছে। Save করার আগে দেখে নিন।');
    } catch (error) {
      setTranslationMessage(error instanceof Error ? error.message : 'অনুবাদ করা যায়নি।');
    } finally {
      setTranslating(false);
    }
  };

  const setField = (key: string, next: string) => {
    onChange({
      ...(value || {}),
      [lang]: { ...(value?.[lang] || {}), [key]: next },
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {availableLangs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setLang(item.key)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${lang === item.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-secondary'}`}
          >
            {item.flag} {item.label}
          </button>
        ))}
        {enableTranslate && <button type="button" onClick={translateAll} disabled={translating} className="ml-auto rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">{translating ? 'অনুবাদ হচ্ছে…' : 'Translate All'}</button>}
      </div>
      {enableTranslate && translationMessage && <p className="mb-3 text-xs text-muted-foreground" role="status">{translationMessage}</p>}
      <div className="grid gap-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-sm font-medium">{field.label}</label>
            {field.richText ? (
              <RichTextEditor value={current[field.key] || ''} onChange={(next) => setField(field.key, next)} placeholder={field.placeholder} />
            ) : field.multiline ? (
              <textarea value={current[field.key] || ''} onChange={(e) => setField(field.key, e.target.value)} placeholder={field.placeholder} className="input-bangla min-h-[100px]" />
            ) : (
              <input value={current[field.key] || ''} onChange={(e) => setField(field.key, e.target.value)} placeholder={field.placeholder} className="input-bangla" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
