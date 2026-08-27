'use client';

import { useEffect, useState } from 'react';
import { Palette, Check, Moon, Sparkles, Sun, Droplets, Crown } from 'lucide-react';

export type HomePageTheme = 'theme1' | 'theme2' | 'theme3';
export type SiteTheme = 'emerald' | 'dark' | 'gold' | 'purple' | 'teal';

const THEME_KEY = 'sb_site_theme';
const HOME_THEME_KEY = 'sb_homepage_theme';

export const THEMES = [
  { 
    key: 'emerald' as const, 
    label: 'ক্লাসিক এমারেল্ড', 
    subtitle: 'ফ্রেশ ও ন্যাচারাল গ্রিন', 
    color: 'bg-emerald-600',
    icon: Sun
  },
  { 
    key: 'dark' as const, 
    label: 'মিডনাইট প্রো ডার্ক', 
    subtitle: 'আল্ট্রা স্মুথ ডার্ক মোড', 
    color: 'bg-slate-900',
    icon: Moon
  },
  { 
    key: 'gold' as const, 
    label: 'রয়্যাল গোল্ড', 
    subtitle: 'লাক্সারি ও প্রিমিয়াম লুক', 
    color: 'bg-amber-500',
    icon: Crown
  },
  { 
    key: 'purple' as const, 
    label: 'আল্ট্রা পার্পল', 
    subtitle: 'মডার্ন ভাইব্রেন্ট থিম', 
    color: 'bg-violet-600',
    icon: Sparkles
  },
  { 
    key: 'teal' as const, 
    label: 'ওশান টিল', 
    subtitle: 'কুল ও মডার্ন অ্যাকোয়া', 
    color: 'bg-teal-600',
    icon: Droplets
  },
];

export function getStoredTheme(): HomePageTheme {
  if (typeof window === 'undefined') return 'theme1';
  return (localStorage.getItem(HOME_THEME_KEY) as HomePageTheme) || 'theme1';
}

export function setStoredTheme(theme: HomePageTheme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HOME_THEME_KEY, theme);
  window.dispatchEvent(new Event('sb-theme-change'));
}

export function getStoredSiteTheme(): SiteTheme {
  if (typeof window === 'undefined') return 'emerald';
  return (localStorage.getItem(THEME_KEY) as SiteTheme) || 'emerald';
}

export function applyTheme(theme: SiteTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function setStoredSiteTheme(theme: SiteTheme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event('sb-site-theme-change'));
}

export function ThemeSwitcher({ defaultTheme }: { defaultTheme?: HomePageTheme }) {
  const [siteTheme, setSiteTheme] = useState<SiteTheme>('emerald');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = getStoredSiteTheme();
    setSiteTheme(stored);
    applyTheme(stored);

    const handler = () => {
      const current = getStoredSiteTheme();
      setSiteTheme(current);
      applyTheme(current);
    };

    window.addEventListener('sb-site-theme-change', handler);
    return () => window.removeEventListener('sb-site-theme-change', handler);
  }, []);

  const onChange = (t: SiteTheme) => {
    setSiteTheme(t);
    setStoredSiteTheme(t);
    setOpen(false);
  };

  return (
    <>
      {/* ফ্লোটিং থিম বাটন */}
      <div className="fixed right-3.5 top-1/2 z-50 -translate-y-1/2 sm:right-5">
        <button
          onClick={() => setOpen(!open)}
          className="group relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-card/90 shadow-xl ring-2 ring-primary/20 backdrop-blur-md transition-all hover:scale-105 hover:ring-primary hover:shadow-2xl active:scale-95 cursor-pointer"
          aria-label="Change Website Theme"
          title="ওয়েবসাইট থিম পরিবর্তন করুন"
        >
          <Palette className="h-5 w-5 text-primary transition-transform duration-300 group-hover:rotate-45" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary"></span>
          </span>
        </button>
      </div>

      {/* থিম প্যানেল */}
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-2xs" onClick={() => setOpen(false)} />
          <div className="fixed right-3.5 top-1/2 z-50 w-72 -translate-y-1/2 rounded-3xl border border-border bg-card p-4 shadow-2xl animate-in fade-in zoom-in-95 sm:right-5">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5 px-1">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <p className="text-sm font-extrabold text-foreground">পছন্দের থিম নির্বাচন করুন</p>
              </div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {THEMES.find(t => t.key === siteTheme)?.label}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-0.5">
              {THEMES.map((t) => {
                const IconComponent = t.icon;
                const isSelected = siteTheme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => onChange(t.key)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 ring-2 ring-primary/40 shadow-xs'
                        : 'hover:bg-secondary/60 text-foreground'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.color} text-white shadow-xs`}>
                      <IconComponent className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {t.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{t.subtitle}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
