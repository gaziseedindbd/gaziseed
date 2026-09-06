'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Globe2 } from 'lucide-react';
import { getVisitorCountry, setManualCountry } from '@/lib/supabase/client';

type CountryOption = 'AUTO' | 'BD' | 'IN';

export function CountrySelector({ mobile = false }: { mobile?: boolean }) {
  const [value, setValue] = useState<CountryOption>('AUTO');

  useEffect(() => {
    const saved = localStorage.getItem('gazi_country_override')?.toUpperCase();
    setValue(saved === 'BD' || saved === 'IN' ? saved : 'AUTO');
  }, []);

  const handleChange = (next: CountryOption) => {
    if (next === 'AUTO') {
      setManualCountry(null);
    } else {
      setManualCountry(next);
    }
    setValue(next);
    window.location.reload();
  };

  const detected = getVisitorCountry();
  const currentLabel = detected === 'IN' ? '🇮🇳 India' : '🇧🇩 Bangladesh';

  return (
    <label
      className={
        mobile
          ? 'flex w-full items-center justify-between rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 px-3.5 py-3 shadow-sm'
          : 'group flex min-w-[150px] items-center gap-2 rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-lime-50 px-2.5 py-1.5 shadow-[0_8px_22px_-14px_rgba(5,150,105,.8)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-[0_12px_26px_-14px_rgba(5,150,105,.95)]'
      }
    >
      <span className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm ring-2 ring-white">
          <Globe2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
            Country
          </span>
          <span className="block truncate text-[13px] font-black text-emerald-950">
            {currentLabel}
          </span>
        </span>
      </span>

      <span className="relative shrink-0">
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value as CountryOption)}
          className="cursor-pointer appearance-none rounded-lg border border-emerald-200 bg-white py-1.5 pl-2.5 pr-7 text-[11px] font-black text-emerald-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          aria-label="Select country"
        >
          <option value="AUTO">🌐 Auto</option>
          <option value="BD">🇧🇩 Bangladesh</option>
          <option value="IN">🇮🇳 India</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-700" />
      </span>
    </label>
  );
}

export default CountrySelector;
