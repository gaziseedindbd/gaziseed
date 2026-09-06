'use client';

import { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
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

  return (
    <label className={`inline-flex items-center gap-1.5 ${mobile ? 'w-full justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5' : 'rounded-xl px-2 py-2 hover:bg-emerald-50'}`}>
      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
        <Globe2 className="h-4 w-4 text-emerald-700" />
        <span>{mobile ? 'দেশ / Country' : detected === 'IN' ? '🇮🇳 India' : '🇧🇩 Bangladesh'}</span>
      </span>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value as CountryOption)}
        className="bg-transparent text-xs font-bold text-slate-700 outline-none"
        aria-label="Select country"
      >
        <option value="AUTO">Auto</option>
        <option value="BD">🇧🇩 Bangladesh</option>
        <option value="IN">🇮🇳 India</option>
      </select>
    </label>
  );
}

export default CountrySelector;
