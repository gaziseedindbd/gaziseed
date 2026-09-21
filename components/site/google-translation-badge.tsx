'use client';

import Link from 'next/link';
import { useLang } from './language-provider';

export function GoogleTranslationBadge() {
  const { lang } = useLang();
  if (lang !== 'hi') return null;

  return (
    <div className="fixed bottom-3 left-3 z-[70] rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-[9px] font-semibold text-slate-600 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <span>Powered by Google Translate</span>
        <a href="https://translate.google.com/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">Google</a>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[8px] font-medium text-slate-400">
        <span>Automatic Hindi translation</span>
        <Link href="/translation-info" className="underline underline-offset-2 hover:text-slate-600">Disclaimer</Link>
      </div>
    </div>
  );
}
