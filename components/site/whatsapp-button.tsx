'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { getSiteSettings } from '@/lib/data';
import type { SiteSettings } from '@/lib/supabase/types';
import { usePathname } from 'next/navigation';

export function WhatsAppButton() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const pathname = usePathname();
  const isProductPage = pathname.startsWith('/product/');

  useEffect(() => {
    getSiteSettings().then(setSettings);
  }, []);

  if (!settings?.whatsapp_enabled || !settings?.whatsapp) return null;

  const phoneNumber = settings.whatsapp.replace(/[^0-9]/g, '');
  const message = encodeURIComponent(settings.whatsapp_message || '');
  const href = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-110 active:scale-95 ${
        isProductPage ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))]' : 'bottom-20'
      }`}
      aria-label="WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
      </span>
    </a>
  );
}
