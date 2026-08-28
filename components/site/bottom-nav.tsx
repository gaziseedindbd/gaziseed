'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Truck, LayoutGrid, PhoneCall, BadgeDollarSign } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'সকল প্রোডাক্ট', href: '/all-products', icon: ShoppingBag },
    { label: 'ক্যাটাগরি', href: '/categories', icon: LayoutGrid },
    { label: 'ট্র্যাকিং', href: '/track-order', icon: Truck },
    { label: 'ডেলিভারি চার্জ', href: '/charges', icon: BadgeDollarSign },
    { label: 'যোগাযোগ', href: '/contact', icon: PhoneCall },
  ];

  return (
    <nav className="fixed bottom-2 left-2 right-2 z-50 flex h-[64px] w-auto items-center justify-around rounded-2xl border border-border/70 bg-background/90 px-1.5 py-1.5 shadow-[0_16px_40px_-18px_rgba(15,23,42,.55)] backdrop-blur-xl md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-center transition-all duration-200 ${
              isActive
                ? 'scale-[1.03] bg-primary/10 font-bold text-primary'
                : 'font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            {isActive && <span className="absolute top-1 h-1 w-5 rounded-full bg-primary" aria-hidden="true" />}
            <Icon className={`h-[19px] w-[19px] ${isActive ? 'stroke-[2.6px]' : 'stroke-[1.9px]'}`} />
            <span className="max-w-full truncate px-0.5 text-[9px] leading-none tracking-tight sm:text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
