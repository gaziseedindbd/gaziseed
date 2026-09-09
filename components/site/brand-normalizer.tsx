'use client';

import { useEffect } from 'react';

const LEGACY_BRANDS = ['SUPER KING SEED', 'SEED BARI'];
const NEW_BRAND = 'GAZI SEED';

const MOBILE_BANNER_STYLE_ID = 'gazi-mobile-banner-wide-fix';
const MOBILE_BANNER_CSS = `
@media (max-width: 767px) {
  .home-premium-scope .home-hero-section {
    padding-top: 0 !important;
    padding-bottom: 18px !important;
  }
  .home-premium-scope .hero-wrap {
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    aspect-ratio: 2 / 1 !important;
    overflow: hidden !important;
    border-radius: 12px !important;
  }
  .home-premium-scope .hero-inner {
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    padding: 0 !important;
  }
  .home-premium-scope .hero-image-wrap,
  .home-premium-scope .hero-image-wrap picture {
    display: block !important;
    width: 100% !important;
    height: auto !important;
  }
  .home-premium-scope .hero-image-wrap img {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    max-width: none !important;
    object-fit: contain !important;
    border-radius: 12px !important;
  }
  .home-premium-scope .hero-content-overlay {
    padding: 10px !important;
  }
  .home-premium-scope .hero-content-overlay > div {
    max-width: 72% !important;
    padding: 10px !important;
  }
}
`;

export default function BrandNormalizer() {
  useEffect(() => {
    const replaceBrand = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const value = node.nodeValue || '';
        if (LEGACY_BRANDS.some((brand) => value.includes(brand))) nodes.push(node as Text);
      }
      nodes.forEach((textNode) => {
        let value = textNode.nodeValue || '';
        for (const brand of LEGACY_BRANDS) value = value.replaceAll(brand, NEW_BRAND);
        textNode.nodeValue = value;
      });
    };

    replaceBrand();
    const observer = new MutationObserver(replaceBrand);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    let style = document.getElementById(MOBILE_BANNER_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = MOBILE_BANNER_STYLE_ID;
      style.textContent = MOBILE_BANNER_CSS;
      document.head.appendChild(style);
    }

    return () => {
      observer.disconnect();
      document.getElementById(MOBILE_BANNER_STYLE_ID)?.remove();
    };
  }, []);

  return null;
}
