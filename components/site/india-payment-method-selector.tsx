'use client';

import { Banknote, WalletCards } from 'lucide-react';

export type IndiaPaymentMethod = 'online' | 'cod';

function inr(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Math.max(0, value));
}

export function IndiaPaymentMethodSelector({
  value,
  onChange,
  advanceAmount,
  dueAmount,
  codAvailable = true,
  language = 'bn',
}: {
  value: IndiaPaymentMethod;
  onChange: (method: IndiaPaymentMethod) => void;
  advanceAmount: number;
  dueAmount: number;
  codAvailable?: boolean;
  language?: 'bn' | 'en' | 'hi';
}) {
  const copy = language === 'hi'
    ? { title: 'भुगतान का तरीका चुनें', online: 'ऑनलाइन भुगतान', cod: 'कैश ऑन डिलीवरी', onlineDetail: 'UPI / कार्ड से Cashfree पर सुरक्षित भुगतान', codDetail: `अभी ${inr(advanceAmount)} अग्रिम · डिलीवरी पर ${inr(dueAmount)} बाकी` }
    : language === 'en'
      ? { title: 'Choose a payment method', online: 'Online payment', cod: 'Cash on Delivery', onlineDetail: 'Pay securely with UPI / Card via Cashfree', codDetail: `${inr(advanceAmount)} advance now · ${inr(dueAmount)} due on delivery` }
      : { title: 'পেমেন্ট পদ্ধতি বেছে নিন', online: 'অনলাইন পেমেন্ট', cod: 'ক্যাশ অন ডেলিভারি', onlineDetail: 'Cashfree দিয়ে UPI / Card-এ নিরাপদ পেমেন্ট', codDetail: `এখন ${inr(advanceAmount)} অগ্রিম · ডেলিভারিতে ${inr(dueAmount)} বাকি` };

  const options: Array<{ id: IndiaPaymentMethod; title: string; detail: string; icon: typeof WalletCards }> = [
    { id: 'online', title: copy.online, detail: copy.onlineDetail, icon: WalletCards },
    { id: 'cod', title: copy.cod, detail: copy.codDetail, icon: Banknote },
  ];

  return (
    <fieldset className="rounded-2xl border border-emerald-200 bg-white p-4">
      <legend className="px-1 text-sm font-black text-slate-800">{copy.title}</legend>
      <div className="mt-1 grid gap-3 sm:grid-cols-2">
        {options.map(({ id, title, detail, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            disabled={id === 'cod' && !codAvailable}
            className={`rounded-xl border-2 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 ${value === id ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 hover:border-emerald-400'}`}
          >
            <span className="flex items-center gap-2 text-sm font-extrabold"><Icon className="h-4 w-4 text-emerald-700" />{title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">{detail}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
