'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Facebook, Instagram, Youtube, Phone, Mail, MapPin } from 'lucide-react';
import { getSiteSettings, getNavigation } from '@/lib/data';
import type { SiteSettings, Navigation } from '@/lib/supabase/types';
import { useLang } from './language-provider';

export function SiteFooter() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [nav, setNav] = useState<Navigation[]>([]);
  const { lang, t, tDb } = useLang();

  useEffect(() => {
    getSiteSettings().then(setSettings);
    getNavigation().then(setNav);
  }, []);

  return (
    <footer className="border-t border-border bg-secondary/20">
      <div className="container-custom py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              {settings?.logo ? (
                <img 
                  src={settings.logo} 
                  alt={settings.website_name || 'SEED BARI'} 
                  className="h-10 w-auto max-w-[150px] object-contain" 
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <span className="text-xl font-bold">S</span>
                </div>
              )}
              <div>
                <div className="text-lg font-bold text-primary">{settings?.website_name || 'SEED BARI'}</div>
                <div className="text-[10px] text-muted-foreground">{t('বীজ • গাছ • কৃষি পণ্য', 'Seeds • Plants • Agro')}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('বাংলাদেশের বিশ্বস্ত বীজ ও কৃষি পণ্যের অনলাইন স্টোর। সারাদেশে ক্যাশ অন ডেলিভারি।', 'Bangladesh\'s trusted online store for seeds and agro products. Cash on delivery nationwide.')}
            </p>
            <div className="mt-4 flex gap-3">
              {settings?.facebook && (
                <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-secondary p-2 hover:bg-accent" aria-label="Facebook">
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {settings?.instagram && (
                <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-secondary p-2 hover:bg-accent" aria-label="Instagram">
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {settings?.youtube && (
                <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-secondary p-2 hover:bg-accent" aria-label="YouTube">
                  <Youtube className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="mb-4 font-semibold text-foreground">{t('কুইক লিংক', 'Quick Links')}</h3>
            <ul className="space-y-2 text-sm">
              {nav.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link href={item.url} className="text-muted-foreground hover:text-primary">
                    {tDb(item.title)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer service */}
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

          {/* Contact */}
          <div>
            <h3 className="mb-4 font-semibold text-foreground">{t('যোগাযোগ', 'Contact')}</h3>
            <ul className="space-y-3 text-sm">
              {settings?.phone && (
                <li className="flex items-start gap-2 text-muted-foreground">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                  <a href={`tel:${settings.phone}`} className="hover:text-primary">{settings.phone}</a>
                </li>
              )}
              {settings?.email && (
                <li className="flex items-start gap-2 text-muted-foreground">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <a href={`mailto:${settings.email}`} className="hover:text-primary">{settings.email}</a>
                </li>
              )}
              {settings?.address && (
                <li className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{settings.address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {settings?.website_name || 'SEED BARI'}. {t('সর্বস্বত্ব সংরক্ষিত।', 'All rights reserved.')}</p>
        </div>
      </div>
    </footer>
  );
}
