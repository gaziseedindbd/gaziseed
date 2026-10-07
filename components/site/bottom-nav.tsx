'use client';

import React, { useEffect, useState } from 'react';
import { getVisitorCountry } from '@/lib/supabase/client';
import { useMobilePurchase } from './mobile-purchase-provider';
import { useLang } from './language-provider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Truck, LayoutGrid, PhoneCall, BadgeDollarSign } from 'lucide-react';

export function BottomNav({ initialCountry = 'BD' }: { initialCountry?: 'BD' | 'IN' }) {
  const pathname = usePathname();
  const { t } = useLang();
  const isProductPage = pathname.startsWith('/product/');
  const [country, setCountry] = useState(initialCountry);
  const { visible } = useMobilePurchase();
  useEffect(() => {
    const sync = () => setCountry(getVisitorCountry());
    sync();
    window.addEventListener('gazi-country-changed', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('gazi-country-changed', sync); window.removeEventListener('storage', sync); };
  }, []);
  if (country === 'IN' && pathname.startsWith('/checkout')) return null;

  const navItems = [
    { label: t('হোম', 'Home', 'होम'), href: '/', icon: Home },
    { label: t('পণ্য', 'Products', 'उत्पाद'), href: '/all-products', icon: ShoppingBag },
    { label: t('ক্যাটাগরি', 'Categories', 'श्रेणियाँ'), href: '/categories', icon: LayoutGrid },
    { label: t('ট্র্যাক', 'Track', 'ट्रैक'), href: '/track-order', icon: Truck },
    { label: t('চার্জ', 'Charges', 'शुल्क'), href: '/charges', icon: BadgeDollarSign },
    { label: t('যোগাযোগ', 'Contact', 'संपर्क'), href: '/contact', icon: PhoneCall },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className={`fixed left-2 right-2 z-50 flex min-h-[64px] w-auto items-center justify-around rounded-[20px] border border-primary/10 bg-background/95 px-1.5 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-[0_18px_44px_-20px_rgba(15,23,42,.6)] backdrop-blur-xl md:hidden ${
        isProductPage && (country !== 'IN' || visible) ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]' : 'bottom-2'
      }`}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-center transition-all duration-200 active:scale-95 ${
              isActive
                ? 'scale-[1.03] bg-primary/10 font-bold text-primary'
                : 'font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            {isActive && <span className="absolute top-1 h-1 w-5 rounded-full bg-primary" aria-hidden="true" />}
            <Icon className={`h-[19px] w-[19px] ${isActive ? 'stroke-[2.6px]' : 'stroke-[1.9px]'}`} aria-hidden="true" />
            <span className="max-w-full truncate px-0.5 text-[10px] leading-none tracking-tight sm:text-[11px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
