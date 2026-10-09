'use client';

import { useEffect } from 'react';

export default function ComboError({error,reset}:{error: Error & {digest?:string}, reset:()=>void}) {
  useEffect(() => { console.error('Combo page failed to render', error); }, [error]);
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Combo details are temporarily unavailable</h1><p className="mt-3 break-words text-sm text-red-700">{error.message}</p><button className="mt-5 rounded-lg bg-emerald-800 px-4 py-2 text-white" onClick={reset}>Retry</button></main>;
}
