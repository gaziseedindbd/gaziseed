'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '@/lib/supabase/client';

type QuoteResult = {
  ok: boolean;
  environment?: 'staging' | 'production';
  serviceable?: boolean;
  reason?: string;
  estimatedCharge?: number | null;
  grossCharge?: number | null;
  currency?: string;
  approximate?: boolean;
  quoteOnly?: boolean;
  stagingRatesMayBeZero?: boolean;
  code?: string;
  diagnostic?: { stage?: string; upstreamStatus?: number };
};

export default function IndiaDelhiverySetupPage() {
  const [pickupPin, setPickupPin] = useState('');
  const [deliveryPin, setDeliveryPin] = useState('');
  const [weightGrams, setWeightGrams] = useState('500');
  const [lengthCm, setLengthCm] = useState('15');
  const [breadthCm, setBreadthCm] = useState('10');
  const [heightCm, setHeightCm] = useState('5');
  const [paymentMode, setPaymentMode] = useState<'prepaid' | 'cod'>('prepaid');
  const [codAmount, setCodAmount] = useState('');
  const [shippingMode, setShippingMode] = useState<'surface' | 'express'>('surface');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QuoteResult | null>(null);

  async function checkQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      if (!/^[1-9][0-9]{5}$/.test(pickupPin) || !/^[1-9][0-9]{5}$/.test(deliveryPin))
        throw new Error('Enter valid 6-digit pickup and delivery PIN codes.');
      const values = [weightGrams, lengthCm, breadthCm, heightCm].map(Number);
      if (values.some((value) => !Number.isFinite(value) || value <= 0))
        throw new Error('Enter valid parcel weight and dimensions.');
      if (paymentMode === 'cod' && (!Number.isFinite(Number(codAmount)) || Number(codAmount) <= 0))
        throw new Error('Enter the amount to collect for a COD rate estimate.');
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error('India Admin login required.');
      const { data, error: invokeError } = await supabase.functions.invoke('india-delhivery-quote', {
        method: 'POST',
        body: {
          pickupPin,
          deliveryPin,
          weightGrams: values[0],
          lengthCm: values[1],
          breadthCm: values[2],
          heightCm: values[3],
          paymentMode,
          codAmount: paymentMode === 'cod' ? Number(codAmount) : 0,
          shippingMode,
        },
        headers: { Authorization: 'Bearer ' + accessToken, 'x-gazi-country': 'IN' },
      });
      if (invokeError || !data?.ok) {
        let failure: QuoteResult | null = data && typeof data.code === 'string' ? data as QuoteResult : null;
        const context = (invokeError as { context?: unknown } | null)?.context;
        if (!failure && context instanceof Response) {
          try {
            const parsed = await context.clone().json() as QuoteResult;
            if (parsed && typeof parsed.code === 'string') failure = parsed;
          } catch {
            // Keep the generic error if the response is not safe JSON.
          }
        }
        const code = failure?.code || '';
        const messages: Record<string, string> = {
          delhivery_configuration_unavailable: 'Delhivery staging token is not configured in the server yet.',
          delhivery_auth_rejected: 'Delhivery did not accept the configured API token.',
          delhivery_serviceability_unavailable: 'Delhivery PIN serviceability check is unavailable.',
          delhivery_rate_unavailable: 'Delhivery rate estimate is unavailable.',
          invalid_parcel: 'Check the PIN, parcel values, and COD amount.',
        };
        const stage = failure?.diagnostic?.stage;
        const upstreamStatus = failure?.diagnostic?.upstreamStatus;
        const detail = stage ? ` Stage: ${stage}${upstreamStatus ? ` (HTTP ${upstreamStatus})` : ''}.` : '';
        throw new Error((messages[code] || 'Delhivery could not complete this read-only check.') + detail);
      }
      setResult(data as QuoteResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Delhivery check failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-5 sm:p-7">
      <Link href="/admin/india-shipping" className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold">
        ← India Shipping Management
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-semibold text-emerald-800">INDIA BRANCH · DELHIVERY</p>
        <h1 className="text-2xl font-bold">Delhivery route & rate check</h1>
        <p className="text-sm text-gray-600">
          Read-only integration check. This page checks delivery PIN serviceability and an approximate courier charge.
          It does not create an order, shipment, waybill, label, or pickup.
        </p>
      </header>

      <section className="rounded-xl border bg-white p-4 sm:p-6">
        <form onSubmit={checkQuote} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Pickup PIN
            <input required inputMode="numeric" maxLength={6} value={pickupPin} onChange={(e) => setPickupPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-lg border p-3" />
          </label>
          <label className="space-y-1 text-sm font-medium">Delivery PIN
            <input required inputMode="numeric" maxLength={6} value={deliveryPin} onChange={(e) => setDeliveryPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-lg border p-3" />
          </label>
          <label className="space-y-1 text-sm font-medium">Weight (grams)
            <input required type="number" min="1" max="50000" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} className="w-full rounded-lg border p-3" />
          </label>
          <label className="space-y-1 text-sm font-medium">Payment type
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as 'prepaid' | 'cod')} className="w-full rounded-lg border p-3">
              <option value="prepaid">Prepaid</option>
              <option value="cod">Cash on delivery</option>
            </select>
          </label>
          {paymentMode === 'cod' && <label className="space-y-1 text-sm font-medium">COD amount (INR)
            <input required type="number" min="1" max="100000" value={codAmount} onChange={(e) => setCodAmount(e.target.value)} className="w-full rounded-lg border p-3" />
          </label>}
          <label className="space-y-1 text-sm font-medium">Length (cm)
            <input required type="number" min="1" max="200" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} className="w-full rounded-lg border p-3" />
          </label>
          <label className="space-y-1 text-sm font-medium">Breadth (cm)
            <input required type="number" min="1" max="200" value={breadthCm} onChange={(e) => setBreadthCm(e.target.value)} className="w-full rounded-lg border p-3" />
          </label>
          <label className="space-y-1 text-sm font-medium">Height (cm)
            <input required type="number" min="1" max="200" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="w-full rounded-lg border p-3" />
          </label>
          <label className="space-y-1 text-sm font-medium">Shipping mode
            <select value={shippingMode} onChange={(e) => setShippingMode(e.target.value as 'surface' | 'express')} className="w-full rounded-lg border p-3">
              <option value="surface">Surface</option>
              <option value="express">Express</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto">
              {loading ? 'Checking Delhivery…' : 'Check Delhivery serviceability & rate'}
            </button>
          </div>
        </form>
      </section>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {result && <section role="status" className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <h2 className="font-bold">{result.serviceable ? 'PIN is serviceable' : 'PIN is not serviceable'}</h2>
        <p>Delhivery environment: {result.environment || 'unknown'}</p>
        {result.serviceable && <p>Approximate shipping charge: {result.estimatedCharge === null || result.estimatedCharge === undefined ? 'not returned' : '₹' + Number(result.estimatedCharge).toFixed(2)}</p>}
        {result.grossCharge !== null && result.grossCharge !== undefined && <p>Gross charge before total: ₹{Number(result.grossCharge).toFixed(2)}</p>}
        {result.reason === 'temporarily_embargoed' && <p>This PIN is temporarily under embargo.</p>}
        {result.stagingRatesMayBeZero && <p className="font-medium">Delhivery staging may return ₹0 for rates; this is not a production price.</p>}
        <p className="text-xs text-emerald-900">Delhivery describes this charge as approximate. Recheck the final charge before booking. No shipment or pickup was created.</p>
      </section>}

      <aside className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Secure credential handling</p>
        <p className="mt-1">The Delhivery API token is read only by the server Edge Function. Do not paste the token into this page or into chat. Keep the existing Shiprocket connection separate.</p>
      </aside>
      <a href="https://one.delhivery.com/developer-portal/documents/b2c/" target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-800 underline">
        Delhivery B2C API documentation
      </a>
    </main>
  );
}
