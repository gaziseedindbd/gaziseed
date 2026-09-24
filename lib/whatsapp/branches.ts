export type WhatsAppCountry = 'BD' | 'IN';

export interface WhatsAppBranchConfig {
  country: WhatsAppCountry;
  branch: 'bangladesh' | 'india';
  currency: 'BDT' | 'INR';
  defaultLanguage: 'bn' | 'en' | 'hi';
  businessNumber: string;
  enabled: boolean;
}

const BRANCH_ENV: Record<WhatsAppCountry, string> = {
  BD: 'WHATSAPP_BD_BUSINESS_NUMBER',
  IN: 'WHATSAPP_IN_BUSINESS_NUMBER',
};

export function getWhatsAppBranch(country: WhatsAppCountry): WhatsAppBranchConfig {
  const businessNumber = process.env[BRANCH_ENV[country]] || '';

  return {
    country,
    branch: country === 'BD' ? 'bangladesh' : 'india',
    currency: country === 'BD' ? 'BDT' : 'INR',
    defaultLanguage: country === 'BD' ? 'bn' : 'en',
    businessNumber,
    enabled: true,
  };
}

export function resolveWhatsAppCountry(businessNumber: string): WhatsAppCountry | null {
  const normalized = businessNumber.replace(/[^0-9+]/g, '');
  const bd = (process.env.WHATSAPP_BD_BUSINESS_NUMBER || '').replace(/[^0-9+]/g, '');
  const india = (process.env.WHATSAPP_IN_BUSINESS_NUMBER || '').replace(/[^0-9+]/g, '');

  if (bd && normalized === bd) return 'BD';
  if (india && normalized === india) return 'IN';

  return null;
}

export function getCountryCurrency(country: WhatsAppCountry): 'BDT' | 'INR' {
  return country === 'BD' ? 'BDT' : 'INR';
}
