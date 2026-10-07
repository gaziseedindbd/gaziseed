'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { STOREFRONT_HINDI } from '@/lib/storefront-hindi';

export type Lang = 'bn' | 'en' | 'hi';

const CATEGORY_HI_TRANSLATIONS: Record<string, string> = {
  'ফুল': 'फूल',
  'তরমুজ': 'तरबूज',
  'মরিচ': 'मिर्च',
  'কুমড়া': 'कद्दू और स्क्वैश',
  'বেগুন': 'बैंगन',
  'সবজি': 'सब्ज़ियाँ',
  'শসা-করলা': 'खीरा और करेला',
  'টমেটো': 'टमाटर',
  'কৃষি টুল': 'कृषि उपकरण',
  'কম্বো প্যাকেজ': 'कॉम्बो पैकेज',
  'শীতকালীন': 'शीतकालीन',
  'ঔষধি': 'औषधीय पौधे',
};

const DB_TRANSLATIONS: Record<string, string> = {
  'ভারত': 'India',
  'বাংলাদেশ': 'Bangladesh',
  'ঢাকা, বাংলাদেশ': 'Dhaka, Bangladesh',
  '১০ গ্রাম': '10 g',
  'প্রায় 100 টি বীজ': 'Approximately 100 seeds',
  'প্রযোজ্য নয় / প্যাকেটভেদে পরিবর্তিত': 'Varies by packet',
  'Packet label অনুযায়ী দিন': 'See packet label',
  'হোম': 'Home',
  'সকল প্রোডাক্ট': 'All Products',
  'ক্যাটাগরি': 'Categories',
  'সার্ভিসসমূহ': 'Services',
  'ডেলিভারি চার্জ': 'Delivery Charge',
  'অফার': 'Offers',
  'বাগান গাইড': 'Gardening Guide',
  'যোগাযোগ': 'Contact',
  'অর্ডার ট্র্যাকিং': 'Order Tracking',
  'বাড়িতেই চাষ করুন তাজা সবজি': 'Grow Fresh Vegetables at Home',
  'উন্নত মানের বীজ পেতে অর্ডার করুন আজই': 'Order Today for Quality Seeds',
  'এখনই কিনুন': 'Shop Now',
  'ছাদ বাগানের জন্য সেরা বীজ': 'Best Seeds for Rooftop Gardening',
  'ছাদে সবজি চাষ করুন সহজে': 'Grow Vegetables on Your Rooftop Easily',
  'ব্রাউজ করুন': 'Browse',
  'ক্যাশ অন ডেলিভারি সারাদেশে': 'Cash on Delivery Nationwide',
  'পণ্য হাতে পেয়ে টাকা দিন': 'Pay When You Receive Your Order',
  'অর্ডার করুন': 'Order Now',
  'সবজি বীজ': 'Vegetable Seeds',
  'ফুলের বীজ': 'Flower Seeds',
  'ফলের বীজ': 'Fruit Seeds',
  'হাইব্রিড বীজ': 'Hybrid Seeds',
  'দেশি বীজ': 'Local Seeds',
  'বিদেশি বীজ': 'Imported Seeds',
  'আমার অ্যাকাউন্ট': 'My Account',
};

type LangContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (bn: string, en: string, hi?: string) => string;
  tDb: (text: string) => string;
  tCategoryName: (bn: string, en: string) => string;
  content: (translations: any, fallback: any) => any;
};

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  t: (_bn, en) => en,
  tDb: (text) => text,
  tCategoryName: (bn, en) => en || bn,
  content: (_translations, fallback) => fallback,
});

const LANG_KEY = 'gazi_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as Lang | null;
      if (saved === 'bn' || saved === 'en' || saved === 'hi') setLangState(saved);
    } catch { /* Keep English when browser storage is unavailable. */ }
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* Language still changes for this visit. */ }
  }, []);

  const t = useCallback((bn: string, en: string, hi?: string) => {
    if (lang === 'en') return en;
    if (lang === 'hi') return hi || STOREFRONT_HINDI[en] || en;
    return bn;
  }, [lang]);
  const content = (translations: any, fallback: any) => {
    const current = translations?.[lang];
    if (!current || typeof current !== 'object') return fallback;
    if (typeof fallback === 'string') return current.value || fallback;
    return { ...fallback, ...current };
  };
  const tCategoryName = (bn: string, en: string) => {
    if (lang === 'en') return en || bn;
    if (lang === 'hi') return CATEGORY_HI_TRANSLATIONS[bn] || en || bn;
    return bn;
  };

  const tDb = (text: string) => {
    if (!text) return text;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          if (lang === 'en' && parsed.en) return parsed.en as string;
          if (lang === 'bn' && parsed.bn) return parsed.bn as string;
          if (lang === 'hi' && parsed.hi) return parsed.hi as string;
          // Graceful fallback when a language version is not present.
          if (lang === 'en' && parsed.bn) return parsed.bn as string;
          if (lang === 'bn' && parsed.en) return parsed.en as string;
          if (lang === 'hi' && parsed.en) return parsed.en as string;
        }
      } catch {
        // not valid JSON, fall through to dictionary lookup
      }
    }
    const english = DB_TRANSLATIONS[text] || text;
    return lang === 'en' ? english : lang === 'hi' ? (STOREFRONT_HINDI[english] || english) : text;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t, tDb, tCategoryName, content }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
