'use client';

import { useLang } from './language-provider';
import IndiaPinCheck from '@/components/site/india-pin-check';
import { bangladeshLocations, getDistricts, getThanas } from '@/lib/bangladesh-locations';

export type AddressValue = {
  division: string;
  district: string;
  thana: string;
  detail: string;
  postalCode?: string;
};

export type AddressSelectorProps = {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  lang?: 'bn' | 'en' | 'hi';
  countryCode?: 'BD' | 'IN';
  postalCodeFirst?: boolean;
};

export function AddressSelector({ value, onChange, lang: preferredLang, countryCode = 'BD', postalCodeFirst = false }: AddressSelectorProps) {
  const { lang: selectedLang } = useLang();
  const lang = preferredLang || selectedLang;
  const tr = (bn: string, en: string, hi: string) => lang === 'bn' ? bn : lang === 'hi' ? hi : en;
  const { division, district, thana, detail, postalCode = '' } = value;
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
        {postalCodeFirst && (
          <div>
            <label className="mb-1 block text-sm font-medium">{label.postal}</label>
            <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label={label.postal} value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input-bangla" placeholder="700001" required />
            <IndiaPinCheck pin={postalCode} />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">{tr('সম্পূর্ণ ঠিকানা', 'Full Address', 'पूरा पता')} *</label>
          <textarea aria-label={tr('সম্পূর্ণ ঠিকানা', 'Full Address', 'पूरा पता')} value={detail} onChange={(e) => setDetail(e.target.value)} className="input-bangla min-h-[100px]" placeholder={tr('বাড়ি নম্বর, রাস্তা, এলাকা, শহর/জেলা, রাজ্য ও ল্যান্ডমার্ক লিখুন', 'House number, street, locality, city/district, state and landmark', 'मकान नंबर, सड़क, इलाका, शहर/जिला, राज्य और पहचान लिखें')} required />
        </div>
        {!postalCodeFirst && (
          <div>
            <label className="mb-1 block text-sm font-medium">{label.postal}</label>
            <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label={label.postal} value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input-bangla" placeholder="700001" required />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {postalCodeFirst && (
        <div>
          <label className="mb-1 block text-sm font-medium">{label.postal}</label>
          <input type="text" inputMode="numeric" aria-label={label.postal} value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 10))} className="input-bangla" placeholder={isIndia ? '700001' : 'Postal code'} required={isIndia} />
        </div>
      )}
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
      {!postalCodeFirst && (
        <div>
          <label className="mb-1 block text-sm font-medium">{label.postal}</label>
          <input type="text" aria-label={label.postal} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input-bangla" />
        </div>
      )}
    </div>
  );
}

export function formatAddressToString(v: AddressValue): string {
  const parts = [v.detail, v.thana, v.district, v.division].filter(Boolean);
  if (v.postalCode) parts.push(v.postalCode);
  return parts.join(', ');
}
