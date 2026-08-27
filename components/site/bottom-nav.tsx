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
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[68px] w-full items-center justify-around border-t border-border/80 bg-background/95 backdrop-blur-md px-1 py-1.5 shadow-lg md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 text-center transition-all ${
              isActive
                ? 'font-bold text-primary scale-105'
                : 'text-muted-foreground hover:text-foreground font-medium'
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="max-w-full truncate px-0.5 text-[10px] leading-none tracking-tight sm:text-[11px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
