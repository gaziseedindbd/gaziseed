'use client';

import { useState } from 'react';
import { useLang } from '@/components/site/language-provider';

type Props = {
  pin?: string;
  showInput?: boolean;
  initialPin?: string;
};

export default function IndiaPinCheck({ showInput = false, initialPin = '' }: Props) {
  const { t } = useLang();
  const [localPin, setLocalPin] = useState(initialPin);

  if (!showInput) return null;

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">
        {t('আপনার PIN কোড', 'Your PIN code', 'आपका PIN कोड')}
        <input
          value={localPin}
          onChange={(event) => setLocalPin(event.target.value.replace(/\\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="700001"
          className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold tracking-wider text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
        />
      </label>
    </div>
  );
}
