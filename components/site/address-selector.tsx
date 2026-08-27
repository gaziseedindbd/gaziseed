'use client';

import { useState, useEffect } from 'react';
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
  lang?: 'bn' | 'en';
};

export function AddressSelector({ value, onChange, lang = 'bn' }: AddressSelectorProps) {
  const [division, setDivision] = useState(value.division || '');
  const [district, setDistrict] = useState(value.district || '');
  const [thana, setThana] = useState(value.thana || '');
  const [detail, setDetail] = useState(value.detail || '');
  const [postalCode, setPostalCode] = useState(value.postalCode || '');

  useEffect(() => {
    onChange({ division, district, thana, detail, postalCode });
  }, [division, district, thana, detail, postalCode, onChange]);

  const districts = getDistricts(division);
  const thanas = getThanas(division, district);

  const label = lang === 'en' ? {
    division: 'Division', district: 'District', thana: 'Police Station', detail: 'Detailed Address', postal: 'Postal Code (optional)',
  } : {
    division: 'বিভাগ', district: 'জেলা', thana: 'থানা', detail: 'বিস্তারিত ঠিকানা', postal: 'পোস্ট কোড (ঐচ্ছিক)',
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{label.division} *</label>
          <select value={division} onChange={(e) => { setDivision(e.target.value); setDistrict(''); setThana(''); }} className="input-bangla" required>
            <option value="">{lang === 'en' ? 'Select division' : 'বিভাগ নির্বাচন করুন'}</option>
            {bangladeshLocations.map((d) => <option key={d.name} value={d.name}>{lang === 'en' ? d.name : d.bn}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{label.district} *</label>
          <select value={district} onChange={(e) => { setDistrict(e.target.value); setThana(''); }} className="input-bangla" required disabled={!division}>
            <option value="">{lang === 'en' ? 'Select district' : 'জেলা নির্বাচন করুন'}</option>
            {districts.map((d) => <option key={d.name} value={d.name}>{lang === 'en' ? d.name : d.bn}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{label.thana} *</label>
          <select value={thana} onChange={(e) => setThana(e.target.value)} className="input-bangla" required disabled={!district}>
            <option value="">{lang === 'en' ? 'Select thana' : 'থানা নির্বাচন করুন'}</option>
            {thanas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{label.detail} *</label>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} className="input-bangla min-h-[70px]" placeholder={lang === 'en' ? 'House, road, area...' : 'বাড়ি নম্বর, রোড, এলাকা...'} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{label.postal}</label>
        <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input-bangla" />
      </div>
    </div>
  );
}

export function formatAddressToString(v: AddressValue): string {
  const parts = [v.detail, v.thana, v.district, v.division].filter(Boolean);
  if (v.postalCode) parts.push(v.postalCode);
  return parts.join(', ');
}
