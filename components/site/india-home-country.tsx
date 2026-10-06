'use client';

import { useEffect } from 'react';
import { getVisitorCountry } from '@/lib/supabase/client';

const INDIA_HERO_ID = 'gazi-india-home-hero';

function replaceText(root: HTMLElement, replacements: Array<[string, string]>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  for (const textNode of nodes) {
    let value = textNode.nodeValue || '';
    for (const [from, to] of replacements) {
      if (value.includes(from)) value = value.split(from).join(to);
    }
    if (value !== textNode.nodeValue) textNode.nodeValue = value;
  }
}

function renderIndiaHomepage() {
  if (window.location.pathname !== '/') return;

  const root = document.querySelector<HTMLElement>('.home-premium-scope');
  if (!root) return;

  const replacements: Array<[string, string]> = [
    ['ঢাকা, বাংলাদেশ', 'ভারত'],
    ['বাংলাদেশের বিশ্বস্ত বীজ ও কৃষি পণ্যের অনলাইন স্টোর', 'ভারতের বিশ্বস্ত বীজ ও কৃষি পণ্যের অনলাইন স্টোর'],
    ['সারা দেশে ক্যাশ অন ডেলিভারি', 'সারা ভারতে ক্যাশ অন ডেলিভারি'],
    ['পণ্য হাতে পেয়ে টাকা দিন। ঢাকার ভিতরে ১-২ দিন, ঢাকার বাইরে ২-৫ দিন।', 'পণ্য হাতে পেয়ে টাকা দিন। মেট্রো/সিটিতে ২-৪ দিন, অন্যান্য এলাকায় ৪-৭ দিন।'],
    ['বিকাশ, নগদ, কার্ড ও COD', 'PhonePe, Paytm, UPI, Cards & COD'],
    ['সারা দেশে ডেলিভারি', 'সারা ভারতে ডেলিভারি'],
    ['সারাদেশে সেবা', 'সারা ভারতে সেবা'],
    ['ক্যাশ অন ডেলিভারি সারাদেশে', 'ক্যাশ অন ডেলিভারি সারা ভারতে'],
    ['ঢাকার ভিতরে ১-২ দিন, ঢাকার বাইরে ২-৫ দিন', 'মেট্রো/সিটিতে ২-৪ দিন, অন্যান্য এলাকায় ৪-৭ দিন'],
    ['ঢাকার ভিতরে ১–২ দিন, ঢাকার বাইরে ২–৫ দিন', 'মেট্রো/সিটিতে ২–৪ দিন, অন্যান্য এলাকায় ৪–৭ দিন'],
    ['৳', '₹'],
  ];

  replaceText(root, replacements);
  root.dataset.countryPatched = 'IN';
}

function resetHomepage() {
  const root = document.querySelector<HTMLElement>('.home-premium-scope');
  if (root) delete root.dataset.countryPatched;
}

export default function IndiaHomeCountry() {
  useEffect(() => {
    let timer: number | undefined;

    const apply = () => {
      if (getVisitorCountry() === 'IN') renderIndiaHomepage();
      else resetHomepage();
    };

    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(apply, { timeout: 1200 });
    else timer = window.setTimeout(apply, 700);

    window.addEventListener('gazi-country-changed', apply);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('gazi-country-changed', apply);
    };
  }, []);

  return null;
}
