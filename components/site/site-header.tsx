'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Grid, ShoppingBag, Layers, Tag, Wrench, BookOpen, PhoneCall, Search, User, ShoppingCart, Menu, X, Heart, MapPin, Phone, Facebook, Youtube, Instagram, Loader2, ArrowUpRight, ChevronDown } from 'lucide-react';
import { getSiteSettings, getProducts } from '@/lib/data';
import { getVisitorCountry } from '@/lib/supabase/client';
import type { SiteSettings, Product } from '@/lib/supabase/types';
import { useLang } from '@/components/site/language-provider';
import CountrySelector from '@/components/site/country-selector';

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [country, setCountry] = useState<'BD' | 'IN'>('BD');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { lang, setLang, t } = useLang();

  useEffect(() => { getSiteSettings().then(setSettings); }, []);
  useEffect(() => { setCountry(getVisitorCountry()); }, []);
  useEffect(() => { setMobileMenuOpen(false); setSearchOpen(false); }, [pathname]);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 80);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!searchOpen || !query) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await getProducts({ search: query });
        if (!cancelled) setSearchResults(results.slice(0, 6));
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, searchOpen]);

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
    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);

  const submitSearch = () => {
    const query = searchQuery.trim();
    if (!query) return;
    setSearchOpen(false);
    setSearchQuery('');
    router.push(`/all-products?search=${encodeURIComponent(query)}`);
  };

  const openProduct = (slug: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    router.push(`/product/${slug}`);
  };

  const navLinks = [
    { label: t('হোম', 'Home'), href: '/', icon: Home },
    { label: t('ক্যাটাগরি', 'Categories'), href: '/categories', icon: Grid },
    { label: t('সব পণ্য', 'Products'), href: '/all-products', icon: ShoppingBag },
    { label: t('কম্বো', 'Combo'), href: '/combos', icon: Layers },
    { label: t('অফার', 'Offers'), href: '/offers', icon: Tag, badge: 'Hot' },
    { label: t('চাষাবাদ', 'Guides'), href: '/blog', icon: BookOpen },
    { label: t('আমাদের', 'About'), href: '/about', icon: Wrench },
    { label: t('যোগাযোগ', 'Contact'), href: '/contact', icon: PhoneCall },
  ];

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href + '/'));

  const renderNav = (compact = false) => (
    <nav aria-label="Primary navigation" className={`flex items-center rounded-full border border-emerald-100/90 bg-white/95 backdrop-blur-md ${compact ? 'gap-0.5 p-1 shadow-[0_8px_26px_-16px_rgba(5,46,22,.45)]' : 'gap-1 p-1.5 shadow-[0_12px_35px_-18px_rgba(5,46,22,.45)]'}`}>
      {navLinks.map((link) => {
        const Icon = link.icon;
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`group relative flex shrink-0 items-center rounded-full font-extrabold transition-all duration-200 ${compact ? 'gap-1.5 px-2.5 py-2 text-[11px] 2xl:px-3' : 'gap-2 px-4 py-2.5 text-[13px]'} ${active ? 'bg-emerald-800 text-white shadow-[0_6px_16px_-8px_rgba(6,78,59,.7)]' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'}`}
          >
            <Icon className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-emerald-700'}`} />
            <span>{link.label}</span>
            {link.badge && <span className={`absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide shadow-sm ${active ? 'bg-lime-300 text-emerald-950' : 'bg-amber-400 text-amber-950'}`}>{link.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const logoSrc = settings?.logo || '/favicon.svg?v=2';
  const locationText = settings?.address || (country === 'IN' ? 'ভারত' : 'ঢাকা, বাংলাদেশ');
  const phoneText = settings?.phone || settings?.whatsapp;
  const hasSocials = Boolean(settings?.facebook || settings?.youtube || settings?.instagram);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-white/96 shadow-[0_14px_45px_-28px_rgba(5,46,22,.55)] backdrop-blur-xl">
      {/* Slim utility strip */}
      <div className="top-green-bar">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-1.5 text-[11px] font-semibold text-white sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <SproutMark />
            <span className="truncate">{t('ভালো বীজ, সবুজ ভবিষ্যৎ | GAZI SEED', 'Better Seeds, Greener Future | GAZI SEED')}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3 md:gap-5">
            <CountrySelector />
            <div className="hidden items-center gap-5 md:flex">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{locationText}</span>
              {phoneText && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{phoneText}</span>}
              {hasSocials && <span className="inline-flex items-center gap-2 opacity-90"><Facebook className="h-3.5 w-3.5" /><Youtube className="h-3.5 w-3.5" /><Instagram className="h-3.5 w-3.5" /></span>}
            </div>
          </div>
        </div>
      </div>

      {/* Premium desktop header */}
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8 lg:py-4">
        <Link href="/" className="group flex shrink-0 items-center rounded-2xl px-1 py-1 transition-transform duration-200 hover:scale-[1.015]" aria-label="GAZI SEED Home">
          {settings?.logo ? (
            <img src={logoSrc} alt={settings.website_name || 'GAZI SEED'} className="h-12 w-auto max-w-[205px] object-contain sm:h-[54px] sm:max-w-[225px] lg:h-[58px] lg:max-w-[235px]" />
          ) : (
            <div className="flex items-center gap-2.5">
              <SproutMark large />
              <div>
                <div className="text-2xl font-black leading-none tracking-tight text-emerald-950">GAZI SEED</div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Better Seeds · Better Future</div>
              </div>
            </div>
          )}
        </Link>

        <div className="hidden min-w-0 flex-1 xl:block">
          <div className="flex min-w-0 justify-center 2xl:justify-start">{renderNav(true)}</div>
        </div>

        {/* Desktop search + actions */}
        <div className="ml-auto hidden shrink-0 items-center gap-1.5 lg:flex">
          <div className={`relative flex items-center rounded-2xl border transition-all duration-200 ${searchOpen ? 'border-emerald-400 bg-white ring-4 ring-emerald-600/10 shadow-sm' : 'border-emerald-100 bg-emerald-50/70 hover:border-emerald-200 hover:bg-white'}`}>
            <button type="button" onClick={() => setSearchOpen(true)} aria-label={t('খুঁজুন', 'Search')} className="flex shrink-0 items-center justify-center pl-3 text-emerald-700">
              <Search className="h-5 w-5" />
            </button>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); if (e.key === 'Escape') setSearchOpen(false); }}
              type="search"
              placeholder={t('পণ্য খুঁজুন...', 'Search products...')}
              className="w-[155px] bg-transparent px-2.5 py-3 text-[12px] font-semibold text-slate-800 outline-none placeholder:text-slate-400 2xl:w-[185px]"
              aria-label={t('পণ্য খুঁজুন', 'Search products')}
            />
            {searchLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-700" />}
            {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="mr-1 rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
          </div>

          <button type="button" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')} className="rounded-xl px-2.5 py-2.5 text-xs font-black text-emerald-900 transition hover:bg-emerald-50" title={t('ভাষা পরিবর্তন', 'Change language')}>
            {lang === 'bn' ? 'EN' : 'বাংলা'}
          </button>
          <Link href="/wishlist" title={t('প্রিয় তালিকা', 'Wishlist')} className={`rounded-xl p-2.5 transition hover:bg-emerald-50 hover:text-emerald-700 ${isActive('/wishlist') ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700'}`}>
            <Heart className="h-5 w-5" />
          </Link>
          <Link href="/account" title={t('অ্যাকাউন্ট', 'Account')} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2.5 text-sm font-bold transition hover:bg-emerald-50 hover:text-emerald-700 ${isActive('/account') ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700'}`}>
            <User className="h-5 w-5" />
            <span className="hidden 2xl:inline">GAZI SEED</span>
            <ChevronDown className="hidden h-3.5 w-3.5 2xl:block" />
          </Link>
          <Link href="/cart" title={t('কার্ট', 'Cart')} className={`relative rounded-xl p-2.5 transition hover:bg-emerald-50 hover:text-emerald-700 ${isActive('/cart') ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700'}`}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 text-[9px] font-black text-white ring-2 ring-white">{cartCount > 99 ? '99+' : cartCount}</span>}
          </Link>
        </div>

        {/* Tablet/mobile actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 lg:hidden">
          <button type="button" onClick={() => setSearchOpen(v => !v)} aria-label={t('অনুসন্ধান খুলুন', 'Open search')} className={`rounded-xl p-2.5 transition ${searchOpen ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-800'}`}>
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
          <Link href="/cart" className="relative rounded-xl p-2.5 text-slate-700 hover:bg-emerald-50" aria-label={t('কার্ট', 'Cart')}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 text-[9px] font-black text-white ring-2 ring-white">{cartCount > 99 ? '99+' : cartCount}</span>}
          </Link>
          <button type="button" onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'} className="rounded-xl p-2.5 text-slate-700 hover:bg-slate-100">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Search dropdown */}
      {searchOpen && (
        <>
          <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="fixed inset-0 top-[90px] z-[-1] bg-emerald-950/5 backdrop-blur-[1px]" />
          <div className="absolute left-1/2 top-full w-[min(94vw,720px)] -translate-x-1/2 px-4 pb-4 pt-3">
            <div className="overflow-hidden rounded-[22px] border border-emerald-100 bg-white p-2 shadow-[0_28px_70px_-28px_rgba(5,46,22,.5)] ring-1 ring-emerald-950/5">
              <div className="flex items-center gap-2 rounded-[16px] border-2 border-emerald-100 bg-slate-50/70 px-3 focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-600/10">
                <Search className="h-5 w-5 shrink-0 text-emerald-700" />
                <input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }} type="search" placeholder={t('বীজ, পণ্য বা ক্যাটাগরি খুঁজুন...', 'Search seeds, products or categories...')} className="min-w-0 flex-1 bg-transparent px-1 py-4 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-400" />
                {searchLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-700" />}
                {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200" aria-label="Clear search"><X className="h-4 w-4" /></button>}
                <button type="button" onClick={submitSearch} className="hidden rounded-xl bg-emerald-800 px-5 py-3 text-sm font-black text-white hover:bg-emerald-900 sm:block">{t('খুঁজুন', 'Search')}</button>
              </div>

              {searchQuery.trim() ? (
                <div className="mt-2 overflow-hidden rounded-[18px] border border-slate-100 bg-white">
                  {searchLoading ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-7 text-sm font-semibold text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-emerald-700" />{t('খুঁজছি...', 'Searching...')}</div>
                  ) : searchResults.length > 0 ? (
                    <div>
                      <div className="px-4 pb-2 pt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{t('সম্পর্কিত পণ্য', 'Related products')}</div>
                      <div className="max-h-[310px] overflow-y-auto p-2">
                        {searchResults.map((product) => {
                          const name = lang === 'en' ? (product.name_en || product.name_bn) : (product.name_bn || product.name_en);
                          const price = product.sale_price && product.sale_price > 0 && product.sale_price < product.regular_price ? product.sale_price : product.regular_price;
                          return (
                            <button key={product.id} type="button" onClick={() => openProduct(product.slug)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-emerald-50/70">
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-emerald-50 bg-emerald-50">
                                {product.image ? <img src={product.image} alt={name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">🌱</div>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-black text-slate-800">{name}</div>
                                {lang === 'bn' && product.name_en && product.name_bn && <div className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{product.name_en}</div>}
                                <div className="mt-1 text-sm font-black text-emerald-700">{country === 'IN' ? '₹ ' : '৳ '}{Number(price).toLocaleString(country === 'IN' ? 'en-IN' : 'bn-BD')}</div>
                              </div>
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-700" />
                            </button>
                          );
                        })}
                      </div>
                      <button type="button" onClick={submitSearch} className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-xs font-black text-emerald-800 hover:bg-emerald-50">{t('সব সার্চ রেজাল্ট দেখুন', 'View all search results')} <ArrowUpRight className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="px-4 py-7 text-center">
                      <div className="text-sm font-bold text-slate-500">{t('কোনো মিল পাওয়া যায়নি', 'No matching products found')}</div>
                      <button type="button" onClick={submitSearch} className="mt-3 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100">{t('সব প্রোডাক্টে খুঁজুন', 'Search all products')}</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-400"><span>{t('পণ্য, বীজ ও ক্যাটাগরি সার্চ করুন', 'Search products, seeds and categories')}</span><span className="hidden rounded-md border border-slate-200 bg-white px-2 py-1 sm:inline">ESC</span></div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Secondary nav for mid-size desktop widths */}
      <nav className="hidden border-t border-slate-100/80 bg-gradient-to-r from-white via-emerald-50/40 to-white py-2.5 lg:block xl:hidden">
        <div className="mx-auto flex max-w-[1180px] items-center justify-center px-4">{renderNav(false)}</div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-100 bg-white shadow-2xl md:hidden">
          <div className="p-3">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Menu <span className="h-px flex-1 bg-slate-100" /></div>
            <button type="button" onClick={() => { setMobileMenuOpen(false); setSearchOpen(true); }} className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-left text-sm font-bold text-emerald-900"><Search className="h-5 w-5 text-emerald-700" />{t('পণ্য ও বীজ খুঁজুন...', 'Search products & seeds...')}</button>
            <div className="mb-3"><CountrySelector mobile /></div>
            <div className="grid grid-cols-2 gap-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return <Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold transition ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-slate-50 text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/50'}`}><Icon className="h-5 w-5 text-emerald-700" />{link.label}</Link>;
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/wishlist" className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-700"><Heart className="h-5 w-5 text-emerald-700" />{t('উইশলিস্ট', 'Wishlist')}</Link>
              <Link href="/account" className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-700"><User className="h-5 w-5 text-emerald-700" />{t('অ্যাকাউন্ট', 'Account')}</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function SproutMark({ large = false }: { large?: boolean }) {
  return <div className={`relative flex ${large ? 'h-10 w-10' : 'h-4 w-4'} items-center justify-center rounded-full text-emerald-700`}><span className={`absolute ${large ? 'h-7 w-3' : 'h-2.5 w-1.5'} -translate-x-1 rotate-[-38deg] rounded-full bg-emerald-600`} /><span className={`absolute ${large ? 'h-7 w-3' : 'h-2.5 w-1.5'} translate-x-1 rotate-[38deg] rounded-full bg-lime-500`} /><span className={`absolute bottom-0 ${large ? 'h-5' : 'h-2.5'} w-0.5 rounded-full bg-emerald-800`} /></div>;
}

export default SiteHeader;
