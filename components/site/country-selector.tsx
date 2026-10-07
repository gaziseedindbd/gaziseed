'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getVisitorCountry, getManualCountryOverride, setManualCountry } from '@/lib/supabase/client';
import { useLang } from './language-provider';

type CountryOption = 'AUTO' | 'BD' | 'IN';

export function CountrySelector({ mobile = false }: { mobile?: boolean }) {
  const { t } = useLang();
  const [value, setValue] = useState<CountryOption>('AUTO');
  useEffect(() => { setValue(getManualCountryOverride() || 'AUTO'); }, []);

  useLayoutEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;

    const topBar = header.querySelector('.top-green-bar > div') as HTMLElement | null;
    const topBarLeft = topBar?.firstElementChild as HTMLElement | null;
    const topBarRight = topBar?.lastElementChild as HTMLElement | null;
    const topBarTagline = topBarLeft?.querySelector(':scope > span') as HTMLElement | null;

    if (topBarLeft) {
      topBarLeft.style.minWidth = '0';
      topBarLeft.style.flex = '1 1 auto';
    }
    if (topBarRight) {
      topBarRight.style.flexShrink = '0';
    }
    if (topBarTagline) {
      topBarTagline.style.minWidth = '0';
      topBarTagline.style.overflow = 'hidden';
      topBarTagline.style.textOverflow = 'ellipsis';
      topBarTagline.style.whiteSpace = 'nowrap';
    }

    // The homepage already reserves its fixed-header offset in CSS.
    // Do not mutate body padding or homepage padding after first paint;
    // that can move the entire <main> and create a large CLS.
    if (window.location.pathname === '/') return;

    const syncHeaderOffset = () => {
      const height = Math.ceil(header.getBoundingClientRect().height);
      document.body.style.setProperty('padding-top', String(height) + 'px', 'important');
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
  const currentLabel = detected === 'IN' ? `🇮🇳 ${t('ভারত', 'India', 'भारत')}` : `🇧🇩 ${t('বাংলাদেশ', 'Bangladesh', 'बांग्लादेश')}`;

  return (
    <label className={`relative flex min-w-0 items-center ${mobile ? 'w-full' : 'max-w-[180px]'}`}>
      <span className="sr-only">{t('দেশ নির্বাচন', 'Select country', 'देश चुनें')}</span>
      <select value={value} onChange={(e) => handleChange(e.target.value as CountryOption)}
        className="min-h-11 w-full cursor-pointer appearance-none rounded-lg border border-white/25 bg-emerald-900/35 py-2 pl-3 pr-8 text-xs font-semibold text-white outline-none transition hover:bg-emerald-900/50 focus-visible:ring-2 focus-visible:ring-white"
        aria-label={t('দেশ নির্বাচন', 'Select country', 'देश चुनें')}>
        <option className="bg-white text-emerald-950" value="AUTO">{currentLabel} · {t('অটো', 'Auto', 'स्वतः')}</option>
        <option className="bg-white text-emerald-950" value="BD">🇧🇩 {t('বাংলাদেশ', 'Bangladesh', 'बांग्लादेश')}</option>
        <option className="bg-white text-emerald-950" value="IN">🇮🇳 {t('ভারত', 'India', 'भारत')}</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-white" />
    </label>
  );
}

export default CountrySelector;
