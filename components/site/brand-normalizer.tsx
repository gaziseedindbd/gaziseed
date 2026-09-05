'use client';

import { useEffect } from 'react';

const LEGACY_BRANDS = ['SUPER KING SEED', 'SEED BARI'];
const NEW_BRAND = 'GAZI SEED';

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
    return () => observer.disconnect();
  }, []);

  return null;
}
