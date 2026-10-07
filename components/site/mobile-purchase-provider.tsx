'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const MobilePurchaseContext = createContext({ visible: false, setVisible: (_visible: boolean) => {} });

export function MobilePurchaseProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return <MobilePurchaseContext.Provider value={{ visible, setVisible }}>{children}</MobilePurchaseContext.Provider>;
}

export function useMobilePurchase() {
  return useContext(MobilePurchaseContext);
}

export function MobilePurchasePresence({ active }: { active: boolean }) {
  const { setVisible } = useMobilePurchase();
  useEffect(() => {
    setVisible(active);
    return () => setVisible(false);
  }, [active, setVisible]);
  return null;
}
