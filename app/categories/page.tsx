'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCategories } from '@/lib/data';
import type { Category } from '@/lib/supabase/types';
import { ArrowUpRight, Leaf, Sparkles } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang, t, tDb } = useLang();

  useEffect(() => {
    getCategories().then((c) => {
      setCategories(c);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#f7faf7] pb-16">
      <section className="relative mb-10 overflow-hidden bg-gradient-to-br from-[#063d2b] via-[#075b3d] to-[#043326] py-14 text-white shadow-[0_18px_55px_-35px_rgba(4,70,48,.9)] sm:py-18">
        <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.055] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-200 shadow-inner backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            {t('কালেকশন গ্যালারি', 'Collection Gallery')}
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{t('সকল ক্যাটাগরি', 'All Categories')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-7 text-emerald-100/75 sm:text-base">
            {t('আপনার পছন্দের বীজ ও গাছগুলো খুব সহজেই ক্যাটাগরি অনুযায়ী খুঁজে নিন।', 'Browse our premium seed and plant collections by category.')}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-[1.5rem] border border-emerald-100 bg-white p-2 shadow-sm">
                <div className="h-full rounded-[1.15rem] bg-emerald-50" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat, idx) => {
              const catName = lang === 'en' && (cat as any).name_en ? (cat as any).name_en : cat.name_bn;

              return (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.55rem] border border-[#dfe9e2] bg-[#fffdf8] p-2 shadow-[0_10px_30px_-20px_rgba(6,64,43,.45)] transition-all duration-500 hover:-translate-y-2 hover:border-[#c8aa58]/70 hover:shadow-[0_24px_50px_-24px_rgba(6,64,43,.48)] sm:rounded-[1.8rem] sm:p-2.5"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.2rem] bg-[#edf6ef] sm:rounded-[1.4rem]">
                    {cat.image ? (
                      <Image
                        src={cat.image}
                        alt={catName}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        priority={idx < 4}
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 text-emerald-700">
                        <Leaf className="h-10 w-10 sm:h-12 sm:w-12" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#062f22]/55 via-transparent to-white/5 opacity-80 transition-opacity duration-500 group-hover:opacity-95" />

                    <span className="absolute left-3 top-3 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/70 bg-white/90 px-2 text-[9px] font-black tracking-[0.12em] text-emerald-900 shadow-lg backdrop-blur-md sm:left-4 sm:top-4 sm:h-8 sm:min-w-8 sm:text-[10px]">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-[#fffdf8]/95 text-emerald-800 shadow-lg backdrop-blur-md transition-all duration-500 group-hover:rotate-45 group-hover:bg-[#0b6b48] group-hover:text-white sm:bottom-4 sm:right-4 sm:h-10 sm:w-10">
                      <ArrowUpRight className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                    </span>
                  </div>

                  <div className="relative flex flex-1 flex-col px-2.5 pb-2.5 pt-3 sm:px-3.5 sm:pb-3.5 sm:pt-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-1 w-7 rounded-full bg-gradient-to-r from-[#0a6b48] to-[#d6b65d] sm:w-9" />
                      <span className="text-[8px] font-black uppercase tracking-[0.16em] text-[#9a8040] sm:text-[9px]">
                        {t('প্রিমিয়াম কালেকশন', 'Premium Collection')}
                      </span>
                    </div>

                    <h3 className="line-clamp-2 text-[15px] font-black leading-snug tracking-[-0.01em] text-[#073c2c] transition-colors duration-300 group-hover:text-[#08704a] sm:text-lg">
                      {catName}
                    </h3>

                    {cat.description && (
                      <p className="mt-1.5 line-clamp-2 text-[10px] font-medium leading-relaxed text-slate-500 sm:text-xs">
                        {tDb(cat.description)}
                      </p>
                    )}

                    <div className="mt-auto pt-3 sm:pt-4">
                      <div className="flex items-center justify-between gap-2 border-t border-[#e8ece7] pt-2.5 sm:pt-3">
                        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[#d9e8dc] bg-[#eff8f0] px-2.5 py-1.5 text-[9px] font-extrabold text-[#096440] transition-all duration-300 group-hover:border-[#0b6b48] group-hover:bg-[#0b6b48] group-hover:text-white sm:px-3 sm:text-[10px]">
                          <span className="truncate">{t('পণ্য দেখুন', 'Explore products')}</span>
                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                        </span>
                        <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400 transition-colors group-hover:text-[#a7893f] sm:text-[9px]">
                          {t('ক্যাটাগরি', 'Collection')}
                        </span>
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
