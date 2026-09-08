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

  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;

    const syncHeaderOffset = () => {
      const height = Math.ceil(header.getBoundingClientRect().height);
      document.body.style.setProperty('padding-top', `${height}px`, 'important');
    };

    syncHeaderOffset();
    const observer = new ResizeObserver(syncHeaderOffset);
    observer.observe(header);
    window.addEventListener('resize', syncHeaderOffset);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeaderOffset);
    };
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
          : 'group flex min-w-0 max-w-[min(360px,calc(100vw-190px))] items-center gap-2 rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-lime-50 px-2.5 py-1.5 shadow-[0_8px_22px_-14px_rgba(5,150,105,.8)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-[0_12px_26px_-14px_rgba(5,150,105,.95)] sm:min-w-[150px] sm:max-w-none'
      }
    >
      <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm ring-2 ring-white sm:h-8 sm:w-8 sm:rounded-xl">
          <Globe2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[8px] font-black uppercase tracking-[0.1em] text-emerald-700 sm:text-[9px] sm:tracking-[0.12em]">
            Country
          </span>
          <span className="block truncate text-[11px] font-black text-emerald-950 sm:text-[13px]">
            {currentLabel}
          </span>
        </span>
      </span>

      <span className="relative flex h-7 w-8 shrink-0 items-center sm:h-auto sm:w-auto">
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value as CountryOption)}
          className="h-7 w-8 cursor-pointer appearance-none rounded-lg border border-emerald-200 bg-white px-0 text-[0px] font-black text-transparent shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:h-auto sm:w-auto sm:py-1.5 sm:pl-2.5 sm:pr-7 sm:text-[11px] sm:text-emerald-900"
          aria-label="Select country"
        >
          <option value="AUTO">🌐 Auto</option>
          <option value="BD">🇧🇩 Bangladesh</option>
          <option value="IN">🇮🇳 India</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-1/2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 text-emerald-700 sm:right-2 sm:translate-x-0" />
      </span>
    </label>
  );
}

export default CountrySelector;
