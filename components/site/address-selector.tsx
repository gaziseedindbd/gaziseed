'use client';

import { useLang } from './language-provider';
import { useEffect, useRef, useState } from 'react';
import { bangladeshLocations, getDistricts, getThanas } from '@/lib/bangladesh-locations';

export type AddressValue = {
  division: string;
  district: string;
  thana: string;
  detail: string;
  postalCode?: string;
  landmark?: string;
};

export type AddressSelectorProps = {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  lang?: 'bn' | 'en' | 'hi';
  countryCode?: 'BD' | 'IN';
};

export function AddressSelector({ value, onChange, lang: preferredLang, countryCode = 'BD' }: AddressSelectorProps) {
  const { lang: selectedLang } = useLang();
  const lang = preferredLang || selectedLang;
  const tr = (bn: string, en: string, hi: string) => lang === 'bn' ? bn : lang === 'hi' ? hi : en;
  const { division, district, thana, detail, postalCode = '', landmark = '' } = value;
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const [pinVerified, setPinVerified] = useState('');
  const [pinStatus, setPinStatus] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  useEffect(() => {
    if (countryCode !== 'IN' || !/^[1-9][0-9]{5}$/.test(postalCode)) {
      setPinVerified(''); setPinStatus(''); setPinLoading(false);
      return;
    }
    // Only PIN changes should trigger a new lookup; other address edits must not restart it.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPinLoading(true);
      try {
        const response = await fetch('/api/india-pin?pin=' + postalCode, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.state) throw new Error(result.error || 'PIN verification failed');
        if (!controller.signal.aborted) {
          const { value: current, onChange: apply } = latest.current;
          if (current.postalCode !== postalCode) return;
          apply({ ...current, division: result.state, district: current.district || result.district || '', thana: current.thana });
          setPinVerified(postalCode); setPinStatus('');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPinVerified(''); setPinStatus(error instanceof Error ? error.message : 'PIN verification failed');
          const { value: current, onChange: apply } = latest.current;
          if (current.postalCode === postalCode) apply({ ...current, division: '' });
        }
      } finally {
        if (!controller.signal.aborted) setPinLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [postalCode, countryCode]);
  const update = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });
  const setDivision = (division: string) => update({ division, district: '', thana: '' });
  const setDistrict = (district: string) => update({ district, thana: '' });
  const setThana = (thana: string) => update({ thana });
  const setDetail = (detail: string) => update({ detail });
  const setPostalCode = (postalCode: string) => update({ postalCode });

  const isIndia = countryCode === 'IN';
  const districts = getDistricts(division);
  const thanas = getThanas(division, district);

  const label = isIndia
    ? { division: tr('রাজ্য', 'State', 'राज्य'), district: tr('শহর / জেলা', 'City / District', 'शहर / जिला'), thana: tr('এলাকা / লোকালিটি', 'Area / Locality', 'क्षेत्र / इलाका'), detail: tr('বিস্তারিত ঠিকানা', 'Detailed Address', 'पूरा पता'), postal: tr('PIN কোড *', 'PIN Code *', 'पिन कोड *') }
    : { division: tr('বিভাগ', 'Division', 'संभाग'), district: tr('জেলা', 'District', 'जिला'), thana: tr('থানা', 'Police Station', 'थाना'), detail: tr('বিস্তারিত ঠিকানা', 'Detailed Address', 'पूरा पता'), postal: tr('পোস্ট কোড (ঐচ্ছিক)', 'Postal Code (optional)', 'पोस्टल कोड (वैकल्पिक)') };

  if (isIndia) {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{tr('PIN কোড', 'PIN Code', 'पिन कोड')} *</label>
          <input type="text" inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6}
            aria-label="PIN Code" value={postalCode}
            onChange={(e) => { setPinVerified(''); setPinStatus(''); onChange({ ...value, postalCode: e.target.value.replace(/\D/g, '').slice(0, 6), division: '', district: '', thana: '' }); }}
            className="input-bangla" placeholder="700001" required />
          {pinLoading && <p role="status" className="mt-1 text-xs">{tr('PIN যাচাই হচ্ছে...', 'Checking PIN...', 'पिन जाँच रहे हैं...')}</p>}
          {pinStatus && <p role="alert" className="mt-1 text-xs text-red-600">{pinStatus}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{label.division} *</label>
          <input aria-label={label.division} value={pinVerified === postalCode ? division : ''} readOnly
            className="input-bangla" placeholder={tr('PIN দিলে State আসবে', 'State appears after PIN verification', 'पिन सत्यापन के बाद राज्य आएगा')} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{label.detail} *</label>
          <textarea aria-label={label.detail} value={detail} onChange={(e) => setDetail(e.target.value)}
            autoComplete="street-address" className="input-bangla min-h-[70px]"
            placeholder={tr('বাড়ি নম্বর, রাস্তা, এলাকা', 'House number, street and area', 'मकान, सड़क और क्षेत्र')} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{tr('জেলা / শহর / টাউন', 'District / City / Town', 'जिला / शहर / कस्बा')} *</label>
          <input aria-label="District / City / Town" value={district} onChange={(e) => setDistrict(e.target.value)}
            className="input-bangla" placeholder="e.g. Kolkata" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{tr('ল্যান্ডমার্ক (ঐচ্ছিক)', 'Landmark (optional)', 'लैंडमार्क (वैकल्पिक)')}</label>
          <input aria-label="Landmark (optional)" value={landmark} onChange={(e) => update({ landmark: e.target.value })}
            className="input-bangla" placeholder={tr('কাছের পরিচিত স্থান', 'Nearby landmark', 'पास का स्थान')} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{label.division} *</label>
          <select aria-label={label.division} value={division} onChange={(e) => { setDivision(e.target.value); }} className="input-bangla" required>
            <option value="">{tr('বিভাগ নির্বাচন করুন', 'Select division', 'संभाग चुनें')}</option>
            {bangladeshLocations.map((d) => <option key={d.name} value={d.name}>{lang === 'bn' ? d.bn : d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{label.district} *</label>
          <select aria-label={label.district} value={district} onChange={(e) => { setDistrict(e.target.value); }} className="input-bangla" required disabled={!division}>
            <option value="">{tr('জেলা নির্বাচন করুন', 'Select district', 'जिला चुनें')}</option>
            {districts.map((d) => <option key={d.name} value={d.name}>{lang === 'bn' ? d.bn : d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{label.thana} *</label>
          <select aria-label={label.thana} value={thana} onChange={(e) => setThana(e.target.value)} className="input-bangla" required disabled={!district}>
            <option value="">{tr('থানা নির্বাচন করুন', 'Select thana', 'थाना चुनें')}</option>
            {thanas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{label.detail} *</label>
        <textarea aria-label={label.detail} value={detail} onChange={(e) => setDetail(e.target.value)} className="input-bangla min-h-[70px]" placeholder={tr('বাড়ি নম্বর, রোড, এলাকা...', 'House, road, area...', 'मकान, सड़क, इलाका...')} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{label.postal}</label>
        <input type="text" aria-label={label.postal} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input-bangla" />
      </div>
    </div>
  );
}

export function formatAddressToString(v: AddressValue): string {
  const parts = [v.detail, v.landmark, v.thana, v.district, v.division].filter(Boolean);
  if (v.postalCode) parts.push(v.postalCode);
  return parts.join(', ');
}
