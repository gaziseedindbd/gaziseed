'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'bn' | 'en' | 'hi';

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
  t: (bn: string, en: string, hi?: string) => string;
  tDb: (text: string) => string;
  content: (translations: any, fallback: any) => any;
};

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  t: (_bn, en, hi) => hi || en,
  tDb: (text) => text,
  content: (_translations, fallback) => fallback,
});

const LANG_KEY = 'gazi_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved === 'bn' || saved === 'en' || saved === 'hi') setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  };

  const t = (bn: string, en: string, hi?: string) => {
    if (lang === 'en') return en;
    if (lang === 'hi') return hi || en;
    return bn;
  };
  const content = (translations: any, fallback: any) => {
    const current = translations?.[lang];
    if (!current || typeof current !== 'object') return fallback;
    if (typeof fallback === 'string') return current.value || fallback;
    return { ...fallback, ...current };
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
        }
      } catch {
        // not valid JSON, fall through to dictionary lookup
      }
    }
    return lang === 'en' ? (DB_TRANSLATIONS[text] || text) : text;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t, tDb, content }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
