'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Grid,
  ShoppingBag,
  Layers,
  Tag,
  Wrench,
  BookOpen,
  PhoneCall,
  Search,
  User,
  ShoppingCart,
  Truck,
  BadgeDollarSign,
  Menu,
  X,
} from 'lucide-react';
import { getSiteSettings } from '@/lib/data';
import type { SiteSettings } from '@/lib/supabase/types';
import { useLang } from '@/components/site/language-provider';

export function SiteHeader() {
  const [cartCount, setCartCount] = useState(0);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();

  useEffect(() => {
    getSiteSettings().then(setSettings);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const updateCartCount = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('gazi_cart') || '[]');
      const count = cart.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
      setCartCount(count);
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    window.addEventListener('storage', updateCartCount);
    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);

  const navLinks = [
    { label: t('হোম', 'Home'), href: '/', icon: Home },
    { label: t('ক্যাটাগরি', 'Categories'), href: '/categories', icon: Grid },
    { label: t('সকল প্রোডাক্ট', 'All Products'), href: '/all-products', icon: ShoppingBag },
    { label: t('কম্বো', 'Combos'), href: '/combos', icon: Layers },
    { label: t('অফার', 'Offers'), href: '/offers', icon: Tag },
    { label: t('সার্ভিসসমূহ', 'Services'), href: '/services', icon: Wrench },
    { label: t('ডেলিভারি চার্জ', 'Delivery Charges'), href: '/charges', icon: BadgeDollarSign },
    { label: t('ব্লগ', 'Blog'), href: '/blog', icon: BookOpen },
    { label: t('যোগাযোগ', 'Contact'), href: '/contact', icon: PhoneCall },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {settings?.logo ? (
            <img
              src={settings.logo}
              alt={settings.website_name || 'SEED BARI'}
              className="h-8 sm:h-9 w-auto max-w-[120px] sm:max-w-[140px] object-contain"
            />
          ) : (
            <span className="font-extrabold text-lg sm:text-xl md:text-2xl text-emerald-800 tracking-tight">
              {settings?.website_name || 'SEED BARI'}
            </span>
          )}
        </Link>

        <div className="flex-1 max-w-xl mx-auto hidden sm:block">
          <div className="relative">
            <input
              type="text"
              placeholder={t('বীজ, গাছ বা পণ্য খুঁজুন...', 'Search seeds, plants or products...')}
              className="w-full pl-4 pr-10 py-1.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent bg-gray-50 text-gray-800"
            />
            <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-emerald-700 text-white p-1 rounded-full hover:bg-emerald-800 transition">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-full border border-emerald-600/40 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition whitespace-nowrap"
            title="Switch Language"
          >
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>

          <Link
            href="/track-order"
            title="অর্ডার ট্র্যাকিং"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-full transition border border-emerald-200/60 whitespace-nowrap"
          >
            <Truck className="h-3.5 w-3.5 text-emerald-700" />
            <span>{t('ট্র্যাকিং', 'Tracking')}</span>
          </Link>

          <Link href="/account" title="আমার অ্যাকাউন্ট" className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition text-gray-700">
            <User className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>

          <Link href="/cart" title="কার্ট" className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition text-gray-700 relative">
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] sm:text-[11px] font-bold text-white shadow-sm ring-2 ring-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'}
            aria-expanded={mobileMenuOpen}
            className="flex sm:hidden items-center justify-center rounded-full p-1.5 text-gray-700 hover:bg-gray-100 transition"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <nav className="border-t border-gray-100 bg-gray-50/90 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-5 lg:gap-7 py-2 overflow-x-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-emerald-700 transition whitespace-nowrap py-0.5"
              >
                <Icon className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white shadow-xl">
          <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
            <div className="grid grid-cols-2 gap-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                      isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-emerald-50 hover:text-emerald-800'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-emerald-700" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default SiteHeader;
