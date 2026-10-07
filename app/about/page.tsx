'use client';

import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/lib/data';
import type { SiteSettings } from '@/lib/supabase/types';
import { useLang } from '@/components/site/language-provider';
import { Leaf, ShieldCheck, Sprout, Truck, HeartHandshake } from 'lucide-react';

export default function AboutPage() {
  const { t } = useLang();
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => { getSiteSettings().then(setSettings); }, []);

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.12] via-background to-accent/[0.10]">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="container-custom relative py-14 text-center sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-primary shadow-sm">
            <Sprout className="h-3.5 w-3.5" /> GAZI SEED
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">{t('ভালো বীজ, ভালো ফসল, ভালো ভবিষ্যৎ', 'Better Seeds, Better Harvests, Better Future', 'बेहतर बीज, बेहतर फसल, बेहतर भविष्य')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {t('মানসম্মত বীজ, সহজ কেনাকাটা এবং প্রয়োজনের সময় নির্ভরযোগ্য সহায়তা—কৃষক ও বাগানপ্রেমীদের জন্য একটি আধুনিক seed experience।', 'Quality seeds, easy shopping and reliable support for farmers and home gardeners.', 'किसानों और बागवानी प्रेमियों के लिए गुणवत्तापूर्ण बीज, आसान खरीदारी और विश्वसनीय सहायता।')}
          </p>
        </div>
      </section>

      <section className="container-custom py-10 sm:py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [ShieldCheck, t('বিশ্বস্ত পণ্য', 'Trusted Products', 'विश्वसनीय उत्पाद'), t('নির্বাচিত ও মানসম্মত বীজের উপর গুরুত্ব', 'Selected seeds with a focus on quality', 'चुनिंदा और गुणवत्तापूर्ण बीज')],
            [Leaf, t('কৃষিবান্ধব', 'Made for Growers', 'खेती के लिए'), t('ফসল ও বাগানের প্রয়োজনকে সামনে রেখে পণ্য নির্বাচন', 'Products selected for farms and gardens', 'खेतों और बगीचों की ज़रूरतों के लिए चुनिंदा उत्पाद')],
            [Truck, t('সহজ ডেলিভারি', 'Easy Delivery', 'आसान डिलीवरी'), t('অর্ডার থেকে ডেলিভারি পর্যন্ত সহজ অভিজ্ঞতা', 'A simple experience from order to delivery', 'ऑर्डर से डिलीवरी तक आसान अनुभव')],
            [HeartHandshake, t('গ্রাহক সহায়তা', 'Customer Support', 'ग्राहक सहायता'), t('পণ্য নির্বাচন ও চাষাবাদে প্রয়োজনীয় সহযোগিতা', 'Help with seed selection and growing', 'बीज चुनने और खेती में सहायता')],
          ].map(([Icon, title, text]) => (
            <div key={title as string} className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></div>
              <h2 className="mt-5 font-black">{title as string}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text as string}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <article className="rounded-[2rem] border border-border/70 bg-card p-7 shadow-sm sm:p-9">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">{t('আমাদের গল্প', 'Our Story', 'हमारी कहानी')}</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">{t('বীজ থেকে শুরু, আস্থায় এগিয়ে চলা', 'Starting with Seeds, Growing with Trust', 'बीज से शुरुआत, विश्वास के साथ आगे')}</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {t('GAZI SEED-এর লক্ষ্য হলো ভালো বীজকে আরও সহজলভ্য করা এবং অনলাইন কেনাকাটাকে কৃষক ও ঘরোয়া বাগানপ্রেমীদের জন্য সহজ, স্বচ্ছ ও নির্ভরযোগ্য করে তোলা।', 'GAZI SEED aims to make quality seeds more accessible and online shopping simple, transparent and reliable for farmers and home gardeners.', 'GAZI SEED का उद्देश्य गुणवत्तापूर्ण बीज सुलभ बनाना और किसानों व बागवानी प्रेमियों के लिए ऑनलाइन खरीदारी आसान, पारदर्शी और विश्वसनीय बनाना है।')}
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t('আমরা product discovery, clear pricing, convenient ordering এবং customer care—এই চারটি অভিজ্ঞতাকে একসাথে গুরুত্ব দিই।', 'We focus on finding the right products, clear pricing, convenient ordering and customer care.', 'हम सही उत्पाद खोजने, स्पष्ट मूल्य, आसान ऑर्डर और ग्राहक सेवा पर ध्यान देते हैं।')}
            </p>
          </article>
          <aside className="rounded-[2rem] bg-primary p-7 text-primary-foreground shadow-xl sm:p-9">
            <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{t('কেন GAZI SEED', 'Why GAZI SEED', 'GAZI SEED क्यों')}</p>
            <h2 className="mt-2 text-2xl font-black">{t('আপনার চাষের পাশে', 'Supporting Your Growing Journey', 'आपकी खेती के साथ')}</h2>
            <div className="mt-6 space-y-4 text-sm">
              {[t('সহজে সঠিক বীজ খুঁজে পাওয়া', 'Find the right seeds easily', 'सही बीज आसानी से खोजें'), t('স্বচ্ছ মূল্য ও অফার', 'Clear prices and offers', 'स्पष्ट मूल्य और ऑफ़र'), t('সারা দেশের জন্য সুবিধাজনক অর্ডার', 'Convenient nationwide ordering', 'पूरे देश में आसान ऑर्डर'), t('প্রয়োজনে সরাসরি যোগাযোগ', 'Direct contact when you need help', 'ज़रूरत पर सीधे संपर्क करें')].map((item) => (
                <div key={item} className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs">✓</span><span className="opacity-90">{item}</span></div>
              ))}
            </div>
            {settings?.phone && <p className="mt-7 border-t border-white/15 pt-5 text-xs opacity-75">{t('গ্রাহক সহায়তা', 'Customer Care', 'ग्राहक सहायता')}: {settings.phone}</p>}
          </aside>
        </div>
      </section>
    </main>
  );
}
