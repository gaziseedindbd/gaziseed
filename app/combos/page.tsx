'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';
import { useFeatureFlags } from '@/components/site/feature-provider';

export default function CombosPage() {
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang, t } = useLang();
  const { ready, enabled } = useFeatureFlags();

  useEffect(() => {
    if (!ready || !enabled('enable_combos')) return;

    const fetchCombos = async () => {
      // Keep the public storefront list query narrow and independent of the
      // nested combo_items/products relationship. The detail page handles
      // combo contents separately. This avoids guest-only RLS failures from
      // a nested relationship query while preserving the existing data model.
      const { data, error } = await supabase
        .from('combo_packs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data) setCombos(data);
      setLoading(false);
    };

    fetchCombos();
  }, [ready, enabled]);

  if (!ready) return null;

  if (!enabled('enable_combos')) return (
    <div className="container-custom py-24 text-center">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8">
        <h3 className="text-lg font-bold text-foreground">{t('এই ফিচারটি বর্তমানে বন্ধ আছে', 'This feature is currently disabled')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('কম্বো অফার বর্তমানে সক্রিয় নয়।', 'Combo offers are currently unavailable.')}</p>
      </div>
    </div>
  );

  const getItemsCount = (combo: any) => {
    if (combo.manual_items_list) {
      if (Array.isArray(combo.manual_items_list)) return combo.manual_items_list.length;
      if (typeof combo.manual_items_list === 'string') {
        try {
          const parsed = JSON.parse(combo.manual_items_list);
          if (Array.isArray(parsed)) return parsed.length;
        } catch (e) {
          return combo.manual_items_list.split('\n').filter((l: string) => l.trim()).length;
        }
      }
    }
    return 0;
  };

  if (loading) return (
    <div className="container-custom py-16">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-80 animate-pulse rounded-3xl bg-emerald-900/20" />
        ))}
      </div>
    </div>
  );

  if (combos.length === 0) return (
    <div className="container-custom py-24 text-center">
      <div className="mx-auto max-w-md rounded-3xl bg-emerald-950/40 p-8 border border-emerald-800/50">
        <ShoppingBag className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
        <h3 className="text-lg font-bold text-white">{t('কোনো অফার পাওয়া যায়নি', 'No Offers Found')}</h3>
        <p className="text-sm text-emerald-300/80 mt-1">{t('এই মুহূর্তে কোনো স্পেশাল কম্বো প্যাক সচল নেই। শীঘ্রই নতুন অফার আসছে!', 'No special combo packs are active right now. New offers are coming soon!')}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2a1d] to-[#091a12] py-10 text-white">
      <div className="container-custom px-4 md:px-6">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-4 py-1.5 text-amber-400 border border-amber-400/20 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="h-3.5 w-3.5" /> {t('স্পেশাল ডিসকাউন্ট অফার', 'Special Discount Offer')}
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-amber-400">{t('এক্সক্লুসিভ কম্বো প্যাক', 'Exclusive Combo Packs')}</h1>
          <p className="text-sm md:text-base text-emerald-200/80 mt-2 max-w-lg mx-auto">
            {t('সাশ্রয়ী মূল্যে সেরা কম্বো প্যাকগুলো লুফে নিন। সারা দেশে ক্যাশ অন হোম ডেলিভারি!', 'Grab the best combo packs at affordable prices. Cash on home delivery nationwide!')}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => {
            const firstTier = combo.tier_pricing?.[0] || {};
            const offerPrice = Number(firstTier.offer) || Number(combo.combo_price) || 0;
            const regularPrice = Number(firstTier.regular) || Number(combo.regular_total) || 0;
            const savings = regularPrice - offerPrice;
            const totalItems = getItemsCount(combo);
            const badge = firstTier.badge || 'SPECIAL OFFER';

            const comboTitle = lang === 'en' && combo.title_en ? combo.title_en : combo.title_bn;
            const comboDesc = lang === 'en' && combo.description_en ? combo.description_en : combo.description_bn;

            return (
              <Link
                key={combo.id}
                href={`/combo/${combo.slug}`}
                className="group relative flex flex-col justify-between rounded-3xl bg-[#133827] border-2 border-emerald-800/70 p-5 shadow-xl transition-all duration-300 hover:border-amber-400/60 hover:-translate-y-1.5 hover:shadow-2xl"
              >
                <div>
                  <div className="relative mb-4 overflow-hidden rounded-2xl bg-emerald-950 aspect-[4/3] border border-emerald-700/50">
                    {combo.images?.[0] ? (
                      <Image
                        src={combo.images[0]}
                        alt={comboTitle}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-emerald-600">{t('ছবি নেই', 'No Image')}</div>
                    )}
                    <span className="absolute top-3 left-3 z-10 rounded-full bg-red-600 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
                      {badge}
                    </span>
                    <span className="absolute bottom-3 right-3 z-10 rounded-xl bg-slate-900/80 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-amber-400 border border-amber-400/30">
                      📦 {totalItems} {t('টি আইটেম', 'Items')}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-lg text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                    {comboTitle}
                  </h3>
                  {comboDesc && (
                    <p className="text-xs text-emerald-200/70 line-clamp-2 mt-1.5 leading-relaxed">
                      {comboDesc}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-emerald-800/80">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-xs text-emerald-300 block">{t('অফারমূল্য', 'Offer Price')}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-400">৳{offerPrice}</span>
                        {regularPrice > 0 && (
                          <span className="text-xs text-emerald-400/70 line-through">৳{regularPrice}</span>
                        )}
                      </div>
                    </div>
                    {savings > 0 && (
                      <span className="rounded-xl bg-emerald-900/90 border border-emerald-600 px-2.5 py-1 text-[11px] font-bold text-green-400">
                        {t('সাশ্রয়', 'Save')} ৳{savings}
                      </span>
                    )}
                  </div>

                  <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 text-sm transition-all shadow-md group-hover:bg-amber-400">
                    <span>{t('অফারটি দেখুন', 'View Offer')}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
