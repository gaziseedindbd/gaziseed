'use client';

import React from 'react';
import { RichTextEditor } from '@/components/admin/rich-text-editor';

export type MultilingualValue = Record<string, Record<string, string>>;

type Field = { key: string; label: string; multiline?: boolean; richText?: boolean; placeholder?: string };

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
}: {
  value: MultilingualValue;
  onChange: (value: MultilingualValue) => void;
  fields: Field[];
  title?: string;
}) {
  const [lang, setLang] = React.useState<(typeof LANGS)[number]['key']>('en');
  const current = value?.[lang] || {};

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
        <p className="mt-1 text-xs text-muted-foreground">একই content-এর English, বাংলা ও हिन्दी version আলাদা করে সংরক্ষণ করুন। Existing content/logic অপরিবর্তিত থাকবে।</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {LANGS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setLang(item.key)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${lang === item.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-secondary'}`}
          >
            {item.flag} {item.label}
          </button>
        ))}
      </div>
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
