'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid, ShoppingBag, Layers, Tag, Wrench, BookOpen, PhoneCall, Search, User, ShoppingCart, Truck, BadgeDollarSign, Menu, X } from 'lucide-react';
import { getSiteSettings } from '@/lib/data';
import type { SiteSettings } from '@/lib/supabase/types';
import { useLang } from '@/components/site/language-provider';

export function SiteHeader() {
  const [cartCount, setCartCount] = useState(0);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();

  useEffect(() => { getSiteSettings().then(setSettings); }, []);
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  const updateCartCount = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('gazi_cart') || '[]');
      setCartCount(cart.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0));
    } catch { setCartCount(0); }
  };

  useEffect(() => {
    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    window.addEventListener('storage', updateCartCount);
    return () => { window.removeEventListener('cart-updated', updateCartCount); window.removeEventListener('storage', updateCartCount); };
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-emerald-950/10 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.07)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-3 sm:px-5 lg:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-2xl px-1 py-1">
          {settings?.logo ? <img src={settings.logo} alt={settings.website_name || 'SUPER KING SEED'} className="h-9 w-auto max-w-[150px] object-contain sm:h-10 sm:max-w-[175px]" /> : <span className="text-lg font-black tracking-tight text-emerald-950 sm:text-xl">SUPER KING SEED</span>}
        </Link>

        <div className="hidden min-w-0 flex-1 sm:block">
          <div className="mx-auto flex max-w-2xl items-center rounded-2xl border border-slate-200 bg-slate-50/90 p-1 shadow-inner transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10">
            <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
            <input type="text" placeholder={t('বীজ, গাছ বা পণ্য খুঁজুন...', 'Search seeds, plants or products...')} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
            <button className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 active:scale-95"><span className="hidden md:inline">{t('খুঁজুন', 'Search')}</span><Search className="h-4 w-4 md:hidden" /></button>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-extrabold text-emerald-900 transition hover:bg-emerald-100 sm:px-3 sm:text-xs">{lang === 'bn' ? 'EN' : 'বাংলা'}</button>
          <Link href="/track-order" title="অর্ডার ট্র্যাকিং" className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 md:flex"><Truck className="h-4 w-4" />{t('ট্র্যাকিং', 'Tracking')}</Link>
          <Link href="/account" title="আমার অ্যাকাউন্ট" className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 hover:text-emerald-700"><User className="h-5 w-5" /></Link>
          <Link href="/cart" title="কার্ট" className="relative rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 hover:text-emerald-700"><ShoppingCart className="h-5 w-5" />{cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white ring-2 ring-white">{cartCount > 99 ? '99+' : cartCount}</span>}</Link>
          <button type="button" onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'} className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 sm:hidden">{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>

      <nav className="hidden border-t border-slate-100 bg-slate-50/80 md:block">
        <div className="mx-auto flex max-w-[1440px] items-center justify-center gap-1 overflow-x-auto px-4 py-1.5">
          {navLinks.map(link => { const Icon = link.icon; const active = pathname === link.href; return <Link key={link.href} href={link.href} className={`group flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${active ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-emerald-700 hover:shadow-sm'}`}><Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-emerald-700'}`} /><span>{link.label}</span></Link>; })}
        </div>
      </nav>

      {mobileMenuOpen && <div className="border-t border-slate-100 bg-white shadow-2xl sm:hidden"><div className="grid grid-cols-2 gap-2 p-3">{navLinks.map(link => { const Icon = link.icon; const active = pathname === link.href; return <Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-slate-50 text-slate-700'}`}><Icon className="h-5 w-5 text-emerald-700" />{link.label}</Link>; })}</div></div>}
    </header>
  );
}

export default SiteHeader;
