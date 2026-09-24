'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCategories } from '@/lib/data';
import type { Category } from '@/lib/supabase/types';
import { Leaf, Sparkles } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang, t, tDb, tCategoryName } = useLang();

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
              const catName = tCategoryName(cat.name_bn, (cat as any).name_en || cat.name_bn);

              return (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.6rem] border border-[#dfe9e2] bg-white p-1.5 shadow-[0_10px_30px_-20px_rgba(6,64,43,.42)] transition-all duration-500 hover:-translate-y-1.5 hover:border-[#c8aa58]/70 hover:shadow-[0_24px_50px_-24px_rgba(6,64,43,.42)] sm:rounded-[1.9rem] sm:p-2"
                >
                  <div className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-[#edf6ef] sm:rounded-[1.5rem]">
                    {cat.image ? (
                      <Image
                        src={cat.image}
                        alt={catName}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        priority={idx < 4}
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 text-emerald-700">
                        <Leaf className="h-11 w-11 sm:h-14 sm:w-14" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#062f22]/45 via-[#062f22]/5 to-transparent" />
                  </div>

                  <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                    <div className="mb-2 flex items-start gap-2.5">
                      <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 sm:h-8 sm:w-8">
                        <Leaf className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-[17px] font-black uppercase leading-[1.2] tracking-[0.01em] text-[#073c2c] transition-colors duration-300 group-hover:text-[#08704a] sm:text-[21px]">
                          {catName}
                        </h3>
                        {((lang === 'en' ? cat.name_bn : cat.name_en) || '').trim() && (
                          <p className="mt-1 text-[11px] font-bold leading-snug text-emerald-700/70 sm:text-[12px]">
                            {lang === 'en' ? cat.name_bn : cat.name_en}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="min-h-[3.35rem] sm:min-h-[3.8rem]">
                      {cat.description && (
                        <p className="line-clamp-2 text-[11px] font-medium leading-[1.55] text-slate-500 sm:text-[13px] sm:leading-[1.6]">
                          {tDb(cat.description)}
                        </p>
                      )}
                    </div>

                    <div className="mt-3.5 sm:mt-4">
                      <span className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-emerald-500/60 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-3 text-[10px] font-black uppercase tracking-[0.04em] text-white shadow-[0_5px_0_#075c3e,0_10px_18px_-8px_rgba(5,92,62,.65)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_0_#075c3e,0_13px_22px_-8px_rgba(5,92,62,.7)] group-active:translate-y-1 group-active:shadow-[0_2px_0_#075c3e,0_5px_10px_-6px_rgba(5,92,62,.6)] sm:min-h-12 sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-[11px]">
                        {t('পণ্য দেখুন', 'Explore Products')}
                      </span>
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
