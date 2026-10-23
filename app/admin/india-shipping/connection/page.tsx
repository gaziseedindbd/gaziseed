'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Result = 'idle' | 'checking' | 'connected' | 'failed';

/** India-only, read-only connectivity test. Never creates orders or AWBs. */
export default function IndiaShiprocketConnectionPage() {
  const [result, setResult] = useState<Result>('idle');
  const [message, setMessage] = useState('');
  const [country, setCountry] = useState<string | null>(null);

  async function checkConnection() {
    setResult('checking');
    setMessage('');
    try {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session?.access_token) throw new Error('Admin login required');
      const [adminCheck, countryCheck] = await Promise.all([
        supabase.rpc('is_admin'), supabase.rpc('current_admin_country'),
      ]);
      const selectedCountry = String(countryCheck.data ?? '').toUpperCase();
      setCountry(selectedCountry);
      if (adminCheck.error || countryCheck.error || adminCheck.data !== true || selectedCountry !== 'IN')
        throw new Error('India Admin access required');
      const { data, error } = await supabase.functions.invoke('india-shipping-connection-check', {
        method: 'POST', body: {},
        headers: { Authorization: 'Bearer ' + session.session.access_token, 'x-gazi-country': 'IN' },
      });
      if (data?.code === 'sandbox_testing_requires_official_panel')
        throw new Error('Shiprocket Sandbox API testing must be done in the official Sandbox Panel. No Shiprocket API request was sent from this website.');
      if (error || data?.ok !== true || data?.authenticated !== true)
        throw new Error('Connection could not be verified; check credentials and API access');
      setResult('connected');
      setMessage('Shiprocket API authentication succeeded. No shipment or pickup was created.');
    } catch (err) {
      setResult('failed');
      setMessage(err instanceof Error ? err.message : 'Connection unavailable');
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">India Shiprocket Connection Test</h1>
      <p className="text-sm text-gray-600">
        This read-only test verifies Shiprocket API login. It cannot create shipments,
        assign AWBs, charge the wallet, or request pickup.
      </p>
      {country && country !== 'IN' && (
        <p role="alert">Switch to your authorized India Admin branch to continue.</p>
      )}
      <button type="button" onClick={checkConnection} disabled={result === 'checking'}
        className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60">
        {result === 'checking' ? 'Testing connection…' : 'Test Shiprocket Connection'}
      </button>
      {result === 'connected' && <p role="status" className="text-emerald-700">{message}</p>}
      {result === 'failed' && <p role="alert" className="text-red-700">{message}</p>}
    </main>
  );
}
