'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const MobilePurchaseContext = createContext({ height: 0, setHeight: (_height: number) => {} });

export function MobilePurchaseProvider({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(0);
  return <MobilePurchaseContext.Provider value={{ height, setHeight }}>{children}</MobilePurchaseContext.Provider>;
}

export function useMobilePurchase() {
  return useContext(MobilePurchaseContext);
}

export function MobilePurchasePresence({ active }: { active: boolean }) {
  const { setHeight } = useMobilePurchase();
  useEffect(() => {
    const bar = active ? document.getElementById('mobile-product-purchase') : null;
    if (!bar) { setHeight(0); return; }
    const measure = () => setHeight(Math.ceil(bar.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => { observer.disconnect(); setHeight(0); };
  }, [active, setHeight]);
  return null;
}
