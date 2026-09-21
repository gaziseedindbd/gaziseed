'use client';

import { useLang } from './language-provider';

export function GoogleTranslationBadge() {
  const { lang } = useLang();
  if (lang !== 'hi') return null;

  return (
    <a
      href="https://translate.google.com/"
      target="_blank"
      rel="noreferrer noopener"
      className="fixed bottom-3 left-3 z-[70] rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[9px] font-semibold text-slate-600 shadow-lg backdrop-blur"
      aria-label="Powered by Google Translate"
    >
      Powered by Google Translate
    </a>
  );
}
