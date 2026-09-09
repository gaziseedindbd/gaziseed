'use client';

import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import { useLang } from '@/components/site/language-provider';

export default function WishlistPage() {
  const { t } = useLang();

  return (
    <main className="min-h-[60vh] bg-slate-50/60 px-4 pb-24 pt-36 sm:px-6 lg:px-8 lg:pb-16">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Heart className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-emerald-950 sm:text-3xl">
            {t('প্রিয় তালিকা', 'Wishlist')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
            {t('আপনার প্রিয় পণ্যগুলো এখানে দেখা যাবে। এখনো কোনো পণ্য প্রিয় তালিকায় যোগ করা হয়নি।', 'Your favourite products will appear here. No products have been added to your wishlist yet.')}
          </p>
          <Link
            href="/all-products"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {t('পণ্য দেখুন', 'Browse products')}
          </Link>
        </div>
      </div>
    </main>
  );
}
