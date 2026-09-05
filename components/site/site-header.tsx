'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid, ShoppingBag, Layers, Tag, Wrench, BookOpen, PhoneCall, Search, User, ShoppingCart, Truck, BadgeDollarSign, Menu, X, Heart, MapPin, Phone, Facebook, Youtube, Instagram } from 'lucide-react';
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
    { label: t('সব পণ্য', 'Products'), href: '/all-products', icon: ShoppingBag },
    { label: t('অফার', 'Offers'), href: '/offers', icon: Tag, badge: 'Hot' },
    { label: t('চাষাবাদ', 'Guides'), href: '/blog', icon: BookOpen },
    { label: t('আমাদের', 'About'), href: '/about', icon: Wrench },
    { label: t('যোগাযোগ', 'Contact'), href: '/contact', icon: PhoneCall },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-white/95 shadow-[0_12px_40px_-24px_rgba(5,46,22,.45)] backdrop-blur-md">
      <div className="top-green-bar">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-1.5 text-[11px] font-semibold text-white sm:px-6">
          <div className="flex items-center gap-2.5"><SproutMark /> <span>{t('ভালো বীজ, সবুজ ভবিষ্যৎ | GAZI SEED', 'Better Seeds, Greener Future | GAZI SEED')}</span></div>
          <div className="hidden items-center gap-5 md:flex">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />ঢাকা, বাংলাদেশ</span>
            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />+880 1700 123 456</span>
            <span className="inline-flex items-center gap-2 opacity-90"><Facebook className="h-3.5 w-3.5" /><Youtube className="h-3.5 w-3.5" /><Instagram className="h-3.5 w-3.5" /></span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-2xl px-1 py-1 transition hover:scale-[1.01]">
          {settings?.logo ? <img src={settings.logo} alt={settings.website_name || 'GAZI SEED'} className="h-10 w-auto max-w-[175px] object-contain sm:h-11 sm:max-w-[195px]" /> : <div className="flex items-center gap-2"><SproutMark large /><div><div className="text-2xl font-black leading-none tracking-tight text-emerald-950">GAZI SEED</div><div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Better Seeds · Better Future</div></div></div>}
        </Link>

        <div className="hidden min-w-0 flex-1 sm:block">
          <div className="mx-auto flex max-w-2xl items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
            <input type="text" placeholder={t('আপনার পছন্দের বীজ খুঁজুন...', 'Search your favorite seeds...')} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400" />
            <button className="flex h-11 w-12 items-center justify-center bg-emerald-800 text-white transition hover:bg-emerald-900" aria-label={t('খুঁজুন', 'Search')}><Search className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')} className="hidden rounded-xl px-2 py-2 text-xs font-extrabold text-emerald-900 hover:bg-emerald-50 sm:block">{lang === 'bn' ? 'EN' : 'বাংলা'}</button>
          <Link href="/wishlist" title={t('প্রিয় তালিকা', 'Wishlist')} className="hidden rounded-xl p-2 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 sm:block"><Heart className="h-5 w-5" /></Link>
          <Link href="/account" title={t('লগইন / রেজিস্টার', 'Login / Register')} className="hidden items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 md:flex"><User className="h-5 w-5" /> <span className="hidden lg:inline">{t('লগইন / রেজিস্টার', 'Login / Register')}</span></Link>
          <Link href="/cart" title={t('কার্ট', 'Cart')} className="relative rounded-xl p-2 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"><ShoppingCart className="h-5 w-5" />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 text-[9px] font-black text-white ring-2 ring-white">{cartCount > 99 ? '99+' : cartCount}</span>}</Link>
          <button type="button" onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'} className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 hover:text-emerald-700 md:hidden">{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>

      <nav className="hidden border-t border-slate-100/80 bg-gradient-to-r from-white via-emerald-50/50 to-white py-2.5 md:block">
        <div className="mx-auto flex max-w-[1040px] items-center justify-center px-4">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white/90 p-1.5 shadow-[0_10px_35px_-18px_rgba(5,46,22,.55)] backdrop-blur-sm">
            {navLinks.map(link => {
              const Icon = link.icon;
              const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href + '/'));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold transition-all duration-200 ${active ? 'bg-emerald-800 text-white shadow-md shadow-emerald-900/15' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'}`}
                >
                  <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-emerald-700'}`} />
                  <span>{link.label}</span>
                  {link.badge && <span className={`absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${active ? 'bg-lime-300 text-emerald-950' : 'bg-amber-400 text-amber-950'}`}>{link.badge}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="border-t border-slate-100 bg-white shadow-2xl md:hidden">
          <div className="p-3">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Menu <span className="h-px flex-1 bg-slate-100" /></div>
            <div className="grid grid-cols-2 gap-2">
              {navLinks.map(link => {
                const Icon = link.icon;
                const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href + '/'));
                return <Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold transition ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-slate-50 text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/50'}`}><Icon className="h-5 w-5 text-emerald-700" />{link.label}</Link>;
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function SproutMark({ large = false }: { large?: boolean }) {
  return <div className={`relative flex ${large ? 'h-10 w-10' : 'h-4 w-4'} items-center justify-center rounded-full text-emerald-700`}><span className="absolute h-2/3 w-1/3 -translate-x-1 rotate-[-38deg] rounded-full bg-emerald-600" /><span className="absolute h-2/3 w-1/3 translate-x-1 rotate-[38deg] rounded-full bg-lime-500" /><span className={`absolute bottom-0 h-1/2 w-0.5 rounded-full bg-emerald-800 ${large ? 'h-5' : ''}`} /></div>;
}

export default SiteHeader;
