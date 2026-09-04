'use client';

import { useTransition } from 'react';

export default function CountrySwitcher({ country }: { country: 'BD' | 'IN' }) {
  const [isPending, startTransition] = useTransition();

  function changeCountry(nextCountry: 'BD' | 'IN') {
    if (nextCountry === country) return;

    startTransition(() => {
      document.cookie = `seed-bari-country=${nextCountry}; path=/; max-age=31536000; samesite=lax`;
      window.location.reload();
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border bg-white p-1 text-xs font-bold shadow-sm" aria-label="Select store country">
      <button
        type="button"
        onClick={() => changeCountry('BD')}
        disabled={isPending}
        className={`rounded-lg px-3 py-1.5 transition ${country === 'BD' ? 'bg-[#1f6b3b] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
      >
        🇧🇩 BD
      </button>
      <button
        type="button"
        onClick={() => changeCountry('IN')}
        disabled={isPending}
        className={`rounded-lg px-3 py-1.5 transition ${country === 'IN' ? 'bg-[#1f6b3b] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
      >
        🇮🇳 IN
      </button>
    </div>
  );
}
