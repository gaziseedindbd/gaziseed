'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Info, Loader2, MapPin } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';
import { supabase } from '@/lib/supabase/client';

type Props = {
  pin?: string;
  showInput?: boolean;
  initialPin?: string;
};

type CheckState = 'idle' | 'checking' | 'available' | 'unconfirmed' | 'error';

export default function IndiaPinCheck({ pin, showInput = false, initialPin = '' }: Props) {
  const { t } = useLang();
  const [localPin, setLocalPin] = useState(initialPin);
  const [state, setState] = useState<CheckState>('idle');
  const [message, setMessage] = useState('');
  const currentPin = pin === undefined ? localPin : pin;

  useEffect(() => {
    setState('idle');
    setMessage('');
  }, [currentPin]);

  async function checkPin() {
    if (!/^[1-9][0-9]{5}$/.test(currentPin)) {
      setState('error');
      setMessage(t('সঠিক ৬ সংখ্যার PIN কোড লিখুন।', 'Enter a valid 6-digit PIN code.', 'सही 6 अंकों का PIN कोड दर्ज करें।'));
      return;
    }

    setState('checking');
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('india-checkout-pin-check', {
        body: { pin: currentPin, country: 'IN' },
      });

      if (error || !data?.ok) {
        const text = data?.code === 'rate_limited'
          ? t('অনেকবার PIN যাচাই করা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।', 'Too many PIN checks. Please try again in a minute.', 'बहुत बार PIN जाँचा गया है। एक मिनट बाद फिर कोशिश करें।')
          : t('PIN যাচাই এখন সম্ভব হচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।', 'PIN verification is temporarily unavailable. Please try again shortly.', 'अभी PIN की जाँच संभव नहीं है। कुछ देर बाद फिर कोशिश करें।');
        setState('error');
        setMessage(text);
        return;
      }

      if (data.status === 'likely_available') {
        setState('available');
        setMessage(t(
          'এই PIN-এ courier service পাওয়ার সম্ভাবনা আছে। অর্ডার করার সময় আবার যাচাই হবে।',
          'Courier service appears available for this PIN. Availability will be checked again when you place the order.',
          'इस PIN पर courier service उपलब्ध होने की संभावना है। ऑर्डर करते समय फिर से जाँच होगी।',
        ));
      } else {
        setState('unconfirmed');
        setMessage(t(
          'এই PIN-এর জন্য courier availability নিশ্চিত করা যায়নি। অর্ডার করার আগে আমাদের সঙ্গে যোগাযোগ করুন।',
          'We could not confirm courier availability for this PIN. Please contact us before placing the order.',
          'इस PIN पर courier availability की पुष्टि नहीं हो सकी। ऑर्डर करने से पहले हमसे संपर्क करें।',
        ));
      }
    } catch {
      setState('error');
      setMessage(t('PIN যাচাই এখন সম্ভব হচ্ছে না। পরে আবার চেষ্টা করুন।', 'PIN verification is unavailable right now. Please try again later.', 'अभी PIN की जाँच नहीं हो सकी। बाद में फिर कोशिश करें।'));
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      {showInput && (
        <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">
          {t('আপনার PIN কোড', 'Your PIN code', 'आपका PIN कोड')}
          <input
            value={localPin}
            onChange={(event) => setLocalPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            placeholder="700001"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold tracking-wider text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={checkPin}
          disabled={state === 'checking' || !currentPin}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-emerald-300"
        >
          {state === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {state === 'checking' ? t('যাচাই হচ্ছে…', 'Checking…', 'जाँच हो रही है…') : t('PIN যাচাই করুন', 'Check PIN', 'PIN जाँचें')}
        </button>
        {state === 'available' && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{t('সম্ভাব্য সার্ভিস', 'Likely serviceable', 'सेवा उपलब्ध हो सकती है')}</span>}
        {state === 'unconfirmed' && <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300"><Info className="h-4 w-4" />{t('নিশ্চিত নয়', 'Not confirmed', 'पुष्टि नहीं हुई')}</span>}
      </div>
      {message && (
        <p role="status" aria-live="polite" className={\`mt-2 text-xs leading-5 \${state === 'available' ? 'text-emerald-800 dark:text-emerald-200' : state === 'unconfirmed' ? 'text-amber-800 dark:text-amber-200' : state === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600'}\`}>
          {message}
        </p>
      )}
      {state === 'available' && (
        <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          {t(
            'স্টোরের আনুমানিক সময়: Metro/City এলাকায় ২–৪ দিন, অন্যান্য এলাকায় ৪–৭ দিন (dispatch-এর পর)। এটি courier-confirmed delivery date নয়।',
            'Store estimate after dispatch: 2–4 days for Metro/City areas and 4–7 days for other areas. This is not a courier-confirmed delivery date.',
            'Dispatch के बाद स्टोर का अनुमान: Metro/City में 2–4 दिन और अन्य क्षेत्रों में 4–7 दिन। यह courier द्वारा पुष्टि की गई तारीख नहीं है।',
          )}
        </p>
      )}
    </div>
  );
}