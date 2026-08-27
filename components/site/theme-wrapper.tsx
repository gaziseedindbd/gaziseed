'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getStoredTheme, type HomePageTheme } from './theme-switcher';

const THEME_CLASSES: Record<HomePageTheme, string> = {
  theme1: 'theme-premium',
  theme2: 'theme-farm',
  theme3: 'theme-marketplace',
};

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<HomePageTheme>('theme1');

  useEffect(() => {
    setTheme(getStoredTheme());
    const handler = () => setTheme(getStoredTheme());
    window.addEventListener('sb-theme-change', handler);
    return () => window.removeEventListener('sb-theme-change', handler);
  }, []);

  return <div className={THEME_CLASSES[theme]}>{children}</div>;
}
