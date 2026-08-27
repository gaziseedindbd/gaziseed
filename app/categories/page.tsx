'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCategories } from '@/lib/data';
import type { Category } from '@/lib/supabase/types';
import { Sprout, ArrowRight, Sparkles } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang, t, tDb } = useLang();

  useEffect(() => { getCategories().then((c) => { setCategories(c); setLoading(false); }); }, []);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      <section className="relative mb-10 overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 py-14 text-white shadow-sm sm:py-18">
        <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-200 backdrop-blur-md"><Sparkles className="h-3.5 w-3.5" /> {t('কালেকশন গ্যালারি', 'Collection Gallery')}</div>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{t('সকল ক্যাটাগরি', 'All Categories')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-7 text-emerald-100/75 sm:text-base">{t('আপনার পছন্দের বীজ ও গাছগুলো খুব সহজেই ক্যাটাগরি অনুযায়ী খুঁজে নিন।', 'Browse our premium seed and plant collections by category.')}</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-[1.4rem] bg-slate-200" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat, idx) => {
              const catName = lang === 'en' && (cat as any).name_en ? (cat as any).name_en : cat.name_bn;
              return (
                <Link key={cat.id} href={`/category/${cat.slug}`} className="group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-300 hover:shadow-xl sm:p-3">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.05rem] bg-emerald-50">
                    {cat.image ? <Image src={cat.image} alt={catName} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" priority={idx < 4} className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" /> : <div className="flex h-full w-full items-center justify-center bg-emerald-50 text-emerald-700"><Sprout className="h-10 w-10 sm:h-12 sm:w-12" /></div>}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <span className="absolute bottom-2.5 right-2.5 flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-white/95 text-emerald-700 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"><ArrowRight className="h-4 w-4" /></span>
                  </div>
                  <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                    <h3 className="line-clamp-1 text-sm font-extrabold text-slate-900 transition-colors group-hover:text-emerald-700 sm:text-base">{catName}</h3>
                    {cat.description && <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-500 sm:text-xs">{tDb(cat.description)}</p>}
                    <div className="mt-auto pt-3">
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold text-emerald-800 transition-all duration-300 group-hover:bg-emerald-700 group-hover:text-white sm:text-[11px]">{t('পণ্য দেখুন', 'Explore products')} <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" /></span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 group-hover:text-emerald-600">{t('ক্যাটাগরি', 'Collection')}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
