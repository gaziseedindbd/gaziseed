'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Facebook, Instagram, Youtube, Phone, Mail, MapPin } from 'lucide-react';
import { getSiteSettings, getNavigation } from '@/lib/data';
import type { SiteSettings, Navigation } from '@/lib/supabase/types';
import { useLang } from './language-provider';
import { getVisitorCountry } from '@/lib/supabase/client';

export function SiteFooter() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [nav, setNav] = useState<Navigation[]>([]);
  const [country, setCountry] = useState<'BD' | 'IN'>('BD');
  const { t, tDb } = useLang();

  useEffect(() => {
    getSiteSettings().then(setSettings);
    getNavigation().then(setNav);
    setCountry(getVisitorCountry());
  }, []);

  const isIndia = country === 'IN';
  const fallbackBrand = 'GAZI SEED';
  const fallbackTagline = isIndia ? 'Quality Seeds • Better Farming' : 'বীজ • গাছ • কৃষি পণ্য';
  const fallbackDescription = isIndia
    ? "India's trusted online store for seeds and agro products."
    : 'বাংলাদেশের বিশ্বস্ত বীজ ও কৃষি পণ্যের অনলাইন স্টোর। সারাদেশে ক্যাশ অন ডেলিভারি।';
  const fallbackLocation = isIndia ? 'ভারত' : 'ঢাকা, বাংলাদেশ';

  return (
    <footer className="border-t border-border bg-secondary/20">
      <div className="container-custom py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              {settings?.logo ? (
                <img
                  src={settings.logo}
                  alt={settings.website_name || fallbackBrand}
                  className="h-10 w-auto max-w-[150px] object-contain"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <span className="text-xl font-bold">G</span>
                </div>
              )}
              <div>
                <div className="text-lg font-bold text-primary">{settings?.website_name || fallbackBrand}</div>
                <div className="text-[10px] text-muted-foreground">{settings?.site_tagline || fallbackTagline}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {isIndia && settings?.announcement_text
                ? settings.announcement_text
                : (settings?.site_tagline ? settings.site_tagline : fallbackDescription)}
            </p>
            <div className="mt-4 flex gap-3">
              {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-secondary p-2 hover:bg-accent" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>}
              {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-secondary p-2 hover:bg-accent" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>}
              {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-secondary p-2 hover:bg-accent" aria-label="YouTube"><Youtube className="h-4 w-4" /></a>}
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-foreground">{t('কুইক লিংক', 'Quick Links')}</h3>
            <ul className="space-y-2 text-sm">
              {nav.slice(0, 6).map((item) => (
                <li key={item.id}><Link href={item.url} className="text-muted-foreground hover:text-primary">{tDb(item.title)}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-foreground">{t('কাস্টমার সার্ভিস', 'Customer Service')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="text-muted-foreground hover:text-primary">{t('যোগাযোগ', 'Contact')}</Link></li>
              <li><Link href="/track-order" className="text-muted-foreground hover:text-primary">{t('অর্ডার ট্র্যাকিং', 'Track Order')}</Link></li>
              <li><Link href="/page/privacy-policy" className="text-muted-foreground hover:text-primary">{t('প্রাইভেসি পলিসি', 'Privacy Policy')}</Link></li>
              <li><Link href="/page/terms-conditions" className="text-muted-foreground hover:text-primary">{t('শর্তাবলী', 'Terms & Conditions')}</Link></li>
              <li><Link href="/page/shipping-policy" className="text-muted-foreground hover:text-primary">{t('শিপিং পলিসি', 'Shipping Policy')}</Link></li>
              <li><Link href="/page/return-refund-policy" className="text-muted-foreground hover:text-primary">{t('রিটার্ন ও রিফান্ড', 'Return & Refund')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-foreground">{t('যোগাযোগ', 'Contact')}</h3>
            <ul className="space-y-3 text-sm">
              {settings?.phone && <li className="flex items-start gap-2 text-muted-foreground"><Phone className="mt-0.5 h-4 w-4 shrink-0" /><a href={`tel:${settings.phone}`} className="hover:text-primary">{settings.phone}</a></li>}
              {settings?.email && <li className="flex items-start gap-2 text-muted-foreground"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><a href={`mailto:${settings.email}`} className="hover:text-primary">{settings.email}</a></li>}
              <li className="flex items-start gap-2 text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{settings?.address || fallbackLocation}</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {settings?.website_name || fallbackBrand}. {t('সর্বস্বত্ব সংরক্ষিত।', 'All rights reserved.')}</p>
        </div>
      </div>
    </footer>
  );
}
