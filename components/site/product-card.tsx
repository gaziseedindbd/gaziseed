'use client';

import Link from 'next/link';
import { ShoppingCart, Zap, Heart, Star, ArrowUpRight } from 'lucide-react';
import { formatPrice, getEffectivePrice, getDiscountPercent } from '@/lib/utils';
import type { Product } from '@/lib/supabase/types';
import { addToCart } from '@/lib/cart';
import { toast } from './toast-provider';
import { useRouter } from 'next/navigation';
import { useLang } from './language-provider';

export function ProductCard({ product, stackedActions = false }: { product: Product; stackedActions?: boolean }) {
  const router = useRouter();
  const { lang, t } = useLang();
  const price = getEffectivePrice(product);
  const discount = getDiscountPercent(product);
  const inStock = product.stock > 0;
  const name = lang === 'en' ? (product.name_en || product.name_bn) : (product.name_bn || product.name_en);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!inStock) { toast(t('পণ্যটি স্টকে নেই', 'Out of stock'), 'error'); return; }
    addToCart(product, 1); toast(t('কার্টে যোগ করা হয়েছে', 'Added to cart'));
  };
  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!inStock) { toast(t('পণ্যটি স্টকে নেই', 'Out of stock'), 'error'); return; }
    addToCart(product, 1); router.push('/checkout');
  };

  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.45rem] border border-slate-200/80 bg-white shadow-[0_10px_35px_-24px_rgba(15,23,42,.5)] ring-1 ring-transparent transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-emerald-300/80 hover:shadow-[0_22px_55px_-28px_rgba(5,150,105,.48)] hover:ring-emerald-500/10 sm:rounded-[1.65rem]">
      <Link href={`/product/${product.slug}`} className="flex h-full flex-col">
        <div className="relative aspect-[1/1.02] w-full overflow-hidden bg-gradient-to-br from-emerald-50 via-lime-50 to-stone-100 sm:aspect-[.96]">
          {product.image ? <img src={product.image} alt={name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><span className="text-4xl sm:text-5xl">🌱</span></div>}
          <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between sm:inset-x-3 sm:top-3">
            {discount > 0 ? <span className="rounded-lg bg-slate-950/95 px-2 py-1 text-[9px] font-black tracking-wide text-white shadow-lg sm:rounded-xl sm:px-2.5 sm:py-1.5 sm:text-[10px]">-{discount}%</span> : <span />}
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/80 bg-white/90 text-emerald-700 shadow-md backdrop-blur-md transition-all duration-300 group-hover:scale-105 sm:h-10 sm:w-10 sm:rounded-2xl"><Heart className="h-3.5 w-3.5 sm:h-[17px] sm:w-[17px]" /></span>
          </div>
          {discount > 0 && <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1 text-[9px] font-extrabold text-white shadow-lg sm:bottom-3 sm:left-3 sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[10px]"><Zap className="h-2.5 w-2.5 fill-current text-lime-300 sm:h-3 sm:w-3" />{t('বিশেষ অফার', 'Special offer')}</span>}
          {!inStock && <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-sm"><span className="rounded-xl bg-slate-950 px-3.5 py-2 text-[11px] font-bold text-white shadow-xl sm:px-4 sm:text-xs">{t('স্টকে নেই', 'Out of stock')}</span></div>}
          <span className="absolute bottom-2.5 right-2.5 flex h-8 w-8 translate-x-1 items-center justify-center rounded-xl bg-white/90 text-slate-900 shadow-md backdrop-blur-md opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:bottom-3 sm:right-3 sm:h-9 sm:w-9"><ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-2.5 p-3 sm:gap-3.5 sm:p-4 lg:p-5">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 sm:mb-2 sm:gap-2"><span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-1 text-[8px] font-extrabold text-amber-700 sm:px-2.5 sm:py-1 sm:text-[10px]"><Star className="h-2.5 w-2.5 fill-current sm:h-3 sm:w-3" /> 5.0</span><span className="text-[9px] font-semibold text-slate-400 sm:text-[10px]">{t('জনপ্রিয়', 'Popular')}</span></div>
            <h3 className="line-clamp-2 text-[13px] font-black leading-[1.35] tracking-[-.01em] text-slate-900 sm:text-[15px] lg:text-base">{name}</h3>
            {lang === 'bn' && product.name_en && product.name_bn && <p className="mt-1 line-clamp-1 text-[9px] font-medium text-slate-400 sm:text-[11px]">{product.name_en}</p>}
          </div>

          <div className="mt-auto space-y-2 sm:space-y-2.5">
            <div className="flex min-w-0 items-end justify-between gap-2 border-t border-slate-100 pt-2.5 sm:pt-3"><div className="flex min-w-0 flex-wrap items-baseline gap-1.5 sm:gap-2"><span className="text-[1.05rem] font-black tracking-tight text-emerald-700 sm:text-[1.35rem]">{formatPrice(price)}</span>{discount > 0 && <span className="text-[10px] font-semibold text-slate-400 line-through sm:text-xs">{formatPrice(product.regular_price)}</span>}</div><span className="hidden shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-700 sm:block sm:text-[9px]">{inStock ? t('স্টকে আছে', 'In stock') : t('স্টক শেষ', 'Sold out')}</span></div>
            <div className={`grid gap-1.5 sm:gap-2 ${stackedActions ? 'grid-cols-2 sm:grid-cols-1' : 'grid-cols-2'}`}>
              <button onClick={handleAddToCart} disabled={!inStock} className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-2 text-[9px] font-bold text-emerald-700 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:text-white active:scale-95 disabled:opacity-50 sm:gap-1.5 sm:rounded-xl sm:px-2 sm:py-2.5 sm:text-xs"><ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5" /><span>{t('কার্টে যোগ', 'Add')}</span></button>
              <button onClick={handleBuyNow} disabled={!inStock} className="flex min-w-0 items-center justify-center gap-1 rounded-lg bg-slate-950 px-1.5 py-2 text-[9px] font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50 sm:gap-1.5 sm:rounded-xl sm:px-2 sm:py-2.5 sm:text-xs"><Zap className="h-3 w-3 fill-current text-lime-300 sm:h-3.5 sm:w-3.5" /><span>{t('কিনুন', 'Buy')}</span></button>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
