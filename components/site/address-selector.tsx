'use client';

import { useLang } from './language-provider';
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
};

export function AddressSelector({ value, onChange, lang: preferredLang, countryCode = 'BD' }: AddressSelectorProps) {
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{label.division} *</label>
            <input aria-label={label.division} value={division} onChange={(e) => setDivision(e.target.value)} className="input-bangla" placeholder={tr('যেমন: West Bengal', 'e.g. West Bengal', 'जैसे: West Bengal')} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{label.district} *</label>
            <input aria-label={label.district} value={district} onChange={(e) => setDistrict(e.target.value)} className="input-bangla" placeholder={tr('যেমন: Kolkata', 'e.g. Kolkata', 'जैसे: Kolkata')} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{label.thana} *</label>
            <input aria-label={label.thana} value={thana} onChange={(e) => setThana(e.target.value)} className="input-bangla" placeholder={label.thana} required />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{label.detail} *</label>
          <textarea aria-label={label.detail} value={detail} onChange={(e) => setDetail(e.target.value)} className="input-bangla min-h-[70px]" placeholder={tr('বাড়ি, রাস্তা, ল্যান্ডমার্ক...', 'House, street, landmark...', 'मकान, सड़क, पहचान...')} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{label.postal}</label>
          <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label={label.postal} value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input-bangla" placeholder="700001" required />
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
  const parts = [v.detail, v.thana, v.district, v.division].filter(Boolean);
  if (v.postalCode) parts.push(v.postalCode);
  return parts.join(', ');
}
