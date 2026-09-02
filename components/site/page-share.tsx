'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Facebook, MessageCircle, Share2, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { usePathname } from 'next/navigation';

const TARGETS = ['/product/', '/combo/', '/offer/', '/animated-landing/'];

export default function PageShare() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const enabled = useMemo(() => TARGETS.some((prefix) => pathname?.startsWith(prefix)), [pathname]);

  useEffect(() => {
    setOpen(false);
    setCopied(false);
  }, [pathname]);

  if (!enabled) return null;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const title = typeof document !== 'undefined' ? document.title : 'SUPER KING SEED';
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${title}\n${shareUrl}`);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast('লিংক কপি হয়েছে');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('লিংক কপি করা যায়নি', 'error');
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
    <div className="fixed bottom-24 right-4 sm:right-6 z-[70]">
      {open && (
        <div className="mb-3 w-[250px] overflow-hidden rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-center justify-between px-1 pb-2">
            <div>
              <p className="text-sm font-extrabold text-emerald-950">শেয়ার করুন</p>
              <p className="text-[11px] text-slate-500">বন্ধু ও পরিচিত কৃষকদের জানান</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close share menu"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)} className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100"><Facebook className="h-4 w-4" /> Facebook</button>
            <button onClick={() => openShare(`https://wa.me/?text=${encodedText}`)} className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs font-bold text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /> WhatsApp</button>
            <button onClick={() => openShare(`https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=0`)} className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-xs font-bold text-sky-700 hover:bg-sky-100"><MessageCircle className="h-4 w-4" /> Messenger</button>
            <button onClick={copyLink} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy Link'}</button>
          </div>
        </div>
      )}
      <button onClick={nativeShare} aria-label="Share this page" className="group flex items-center gap-2 rounded-full border border-white/80 bg-emerald-950 px-4 py-3 text-white shadow-xl ring-1 ring-emerald-900/10 transition-all hover:-translate-y-0.5 hover:bg-emerald-900 active:scale-95">
        <Share2 className="h-5 w-5 transition-transform group-hover:rotate-12" />
        <span className="hidden sm:inline text-sm font-extrabold">শেয়ার</span>
      </button>
    </div>
  );
}
