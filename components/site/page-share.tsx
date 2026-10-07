'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Facebook, MessageCircle, Share2, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { usePathname } from 'next/navigation';
import { useLang } from './language-provider';

const TARGETS = ['/product/', '/combo/', '/offer/', '/animated-landing/'];

export default function PageShare({ inline = false }: { inline?: boolean }) {
  const { t } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const enabled = useMemo(() => TARGETS.some((prefix) => pathname?.startsWith(prefix)), [pathname]);

  useEffect(() => {
    setOpen(false);
    setCopied(false);
  }, [pathname]);

  if (!enabled || (pathname.startsWith('/product/') && !inline)) return null;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const title = typeof document !== 'undefined' ? document.title : 'GAZI SEED';
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${title}\n${shareUrl}`);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast(t('লিংক কপি হয়েছে', 'Link copied', 'लिंक कॉपी हुआ'));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast(t('লিংক কপি করা যায়নি', 'Unable to copy link', 'लिंक कॉपी नहीं हुआ'), 'error');
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url: shareUrl });
        setOpen(false);
        return;
      } catch {
        // User cancelled; keep the share menu closed without showing an error.
        return;
      }
    }
    setOpen((value) => !value);
  };

  const openShare = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer,width=720,height=680');
    setOpen(false);
  };

  return (
    <div className={inline ? "relative shrink-0" : "fixed bottom-[calc(5rem+env(safe-area-inset-bottom)+4.75rem)] right-4 z-[70] sm:bottom-24 sm:right-6"}>
      {open && (
        <div className={`${inline ? "absolute right-0 top-full mt-2 z-[70]" : "mb-3"} w-[250px] overflow-hidden rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in duration-200`}>
          <div className="flex items-center justify-between px-1 pb-2">
            <div>
              <p className="text-sm font-extrabold text-emerald-950">{t('শেয়ার করুন', 'Share this product', 'यह उत्पाद साझा करें')}</p>
              <p className="text-[11px] text-slate-500">{t('বন্ধু ও পরিচিত কৃষকদের জানান', 'Share with friends and fellow growers', 'दोस्तों और किसानों के साथ साझा करें')}</p>
            </div>
            <button onClick={() => setOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" aria-label={t('শেয়ার মেনু বন্ধ করুন', 'Close share menu', 'साझा मेनू बंद करें')}><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)} className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100"><Facebook className="h-4 w-4" /> Facebook</button>
            <button onClick={() => openShare(`https://wa.me/?text=${encodedText}`)} className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs font-bold text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /> WhatsApp</button>
            <button onClick={copyLink} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t('কপি হয়েছে', 'Copied', 'कॉपी हुआ') : t('লিংক কপি', 'Copy Link', 'लिंक कॉपी करें')}</button>
          </div>
        </div>
      )}
      <button onClick={nativeShare} aria-label={t('এই পণ্য শেয়ার করুন', 'Share this product', 'यह उत्पाद साझा करें')} aria-expanded={open} className={inline ? "flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" : "group flex min-h-11 items-center gap-2 rounded-full border border-white/80 bg-emerald-950 px-4 py-3 text-white shadow-xl transition hover:bg-emerald-900"}>
        <Share2 className="h-5 w-5 transition-transform group-hover:rotate-12" />
        {!inline && <span className="hidden sm:inline text-sm font-extrabold">{t('শেয়ার', 'Share', 'साझा करें')}</span>}
      </button>
    </div>
  );
}
