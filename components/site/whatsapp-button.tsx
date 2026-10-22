'use client';

import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/lib/data';
import type { SiteSettings } from '@/lib/supabase/types';
import { usePathname } from 'next/navigation';

function WhatsAppMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7 shrink-0"
      viewBox="0 0 32 32"
      fill="none"
    >
      <path
        d="M16 3.5a12 12 0 0 0-10.3 18.2L4 28l6.5-1.7A12 12 0 1 0 16 3.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 10.4c-.3-.7-.7-.7-1-.7h-.8c-.3 0-.8.1-1.2.6-.4.5-1.5 1.5-1.5 3.6s1.5 4.1 1.7 4.4c.2.3 2.9 4.7 7.1 6.4 3.5 1.4 4.2 1.1 5 .9.8-.1 2.6-1.1 2.9-2.1.4-1 .4-1.9.3-2.1-.1-.2-.4-.3-.9-.6l-2.7-1.3c-.4-.2-.7-.3-1 .2-.3.5-1.1 1.3-1.3 1.6-.2.3-.5.4-.9.1-.4-.2-1.8-.7-3.4-2.2-1.3-1.1-2.2-2.5-2.4-2.9-.2-.4 0-.6.2-.8.2-.2.4-.5.7-.7.2-.2.3-.4.4-.7.1-.3 0-.5-.1-.7l-1.1-2.7Z"
        fill="currentColor"
        transform="translate(3 0) scale(.82)"
      />
    </svg>
  );
}

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
      className={`fixed right-4 sm:right-6 z-40 inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-4 text-white shadow-lg transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#20BD5A] hover:shadow-xl active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-200 ${
        isProductPage ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))]' : 'bottom-20'
      }`}
      aria-label="Chat with us on WhatsApp"
    >
      <WhatsAppMark />
      <span className="text-sm font-semibold tracking-[0.01em]">WhatsApp</span>
    </a>
  );
}
