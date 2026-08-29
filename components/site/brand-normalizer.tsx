'use client';

import { useEffect } from 'react';

const OLD_BRAND = 'SEED BARI';
const NEW_BRAND = 'SUPER KING SEED';

export default function BrandNormalizer() {
  useEffect(() => {
    const replaceBrand = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.nodeValue?.includes(OLD_BRAND)) nodes.push(node as Text);
      }
      nodes.forEach((textNode) => {
        textNode.nodeValue = textNode.nodeValue?.replaceAll(OLD_BRAND, NEW_BRAND) ?? textNode.nodeValue;
      });
    };

    replaceBrand();
    const observer = new MutationObserver(replaceBrand);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
