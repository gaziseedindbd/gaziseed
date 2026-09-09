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

  const existingHero = root.querySelector<HTMLElement>('.home-hero-section');
  if (existingHero) existingHero.style.display = 'none';

  const categorySection = root.querySelector<HTMLElement>('.home-category-section');
  if (categorySection && !document.getElementById(INDIA_HERO_ID)) {
    const section = document.createElement('section');
    section.id = INDIA_HERO_ID;
    section.className = 'section-pad';
    section.innerHTML = `
      <div class="container-custom">
        <div style="position:relative;overflow:hidden;border-radius:24px;padding:clamp(28px,5vw,58px);background:linear-gradient(135deg,#064e3b 0%,#047857 55%,#16a34a 100%);color:#fff;box-shadow:0 24px 60px -30px rgba(6,78,59,.55)">
          <div style="position:absolute;right:-70px;top:-90px;width:260px;height:260px;border-radius:999px;background:rgba(255,255,255,.09);filter:blur(2px)"></div>
          <div style="position:absolute;left:42%;bottom:-120px;width:280px;height:280px;border-radius:999px;background:rgba(190,242,100,.10);filter:blur(4px)"></div>
          <div style="position:relative;max-width:780px">
            <div style="display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.10);border-radius:999px;padding:8px 14px;font-size:12px;font-weight:800;letter-spacing:.04em">🇮🇳 GAZI SEED INDIA</div>
            <h1 style="margin:18px 0 10px;font-size:clamp(30px,5vw,58px);line-height:1.05;font-weight:900;letter-spacing:-.03em">Premium Seeds for Better Farming</h1>
            <p style="margin:0;max-width:650px;font-size:clamp(15px,2vw,19px);line-height:1.7;color:rgba(236,253,245,.92)">India-focused seed shopping with fast pan-India delivery, secure payments and trusted customer support.</p>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:22px">
              <span style="display:inline-flex;align-items:center;border-radius:999px;background:#fff;color:#065f46;padding:10px 15px;font-size:13px;font-weight:900">UPI</span>
              <span style="display:inline-flex;align-items:center;border-radius:999px;background:#fff;color:#065f46;padding:10px 15px;font-size:13px;font-weight:900">PhonePe</span>
              <span style="display:inline-flex;align-items:center;border-radius:999px;background:#fff;color:#065f46;padding:10px 15px;font-size:13px;font-weight:900">Paytm</span>
              <span style="display:inline-flex;align-items:center;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.20);color:#fff;padding:10px 15px;font-size:13px;font-weight:800">Cards & COD</span>
            </div>
          </div>
        </div>
      </div>`;
    categorySection.parentElement?.insertBefore(section, categorySection);
  }

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

  replaceText(document.body, replacements);
  root.dataset.countryPatched = 'IN';
}

function resetHomepage() {
  const hero = document.getElementById(INDIA_HERO_ID);
  hero?.remove();
  const existingHero = document.querySelector<HTMLElement>('.home-premium-scope .home-hero-section');
  if (existingHero) existingHero.style.display = '';
  const root = document.querySelector<HTMLElement>('.home-premium-scope');
  if (root) delete root.dataset.countryPatched;
}

export default function IndiaHomeCountry() {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let timer: number | undefined;

    const apply = () => {
      const country = getVisitorCountry();
      if (country === 'IN') renderIndiaHomepage();
      else resetHomepage();
    };

    timer = window.setTimeout(apply, 350);
    observer = new MutationObserver(() => {
      if (window.location.pathname === '/' && getVisitorCountry() === 'IN') {
        if (!document.getElementById(INDIA_HERO_ID)) apply();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('gazi-country-changed', apply);

    return () => {
      if (timer) window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('gazi-country-changed', apply);
    };
  }, []);

  return null;
}
