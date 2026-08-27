'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Lang = 'bn' | 'en';

const DB_TRANSLATIONS: Record<string, string> = {
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
  t: (bn: string, en: string) => string;
  tDb: (text: string) => string;
};

const LangContext = createContext<LangContextType>({
  lang: 'bn',
  setLang: () => {},
  t: (bn) => bn,
  tDb: (text) => text,
});

const LANG_KEY = 'gazi_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('bn');

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved === 'bn' || saved === 'en') setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  };

  const t = (bn: string, en: string) => (lang === 'en' ? en : bn);
  const tDb = (text: string) => {
    if (!text) return text;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          if (lang === 'en' && parsed.en) return parsed.en as string;
          if (lang === 'bn' && parsed.bn) return parsed.bn as string;
        }
      } catch {
        // not valid JSON, fall through to dictionary lookup
      }
    }
    return lang === 'en' ? (DB_TRANSLATIONS[text] || text) : text;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t, tDb }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
