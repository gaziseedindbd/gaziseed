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
    <div className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl dark:hover:border-emerald-800">
      <Link href={`/product/${product.slug}`} className="flex h-full flex-col">
        <div className="relative aspect-[1/0.94] w-full overflow-hidden bg-emerald-50/40 dark:bg-emerald-950/20">
          {product.image ? (
            <img src={product.image} alt={lang === 'en' ? (product.name_en || product.name_bn) : (product.name_bn || product.name_en)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.055]" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground"><span className="text-5xl">🌱</span></div>
          )}
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between">
            {discount > 0 ? <span className="rounded-lg bg-rose-500 px-2.5 py-1 text-[10px] font-black text-white shadow-md">-{discount}%</span> : <span />}
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/95 text-emerald-700 shadow-md backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 dark:border-white/10 dark:bg-black/65 dark:text-emerald-300">
              <Heart className="h-4 w-4" />
            </span>
          </div>
          {discount > 0 && <span className="absolute bottom-3 left-3 rounded-lg bg-emerald-700 px-2.5 py-1 text-[10px] font-bold text-white shadow-md">{t('বিশেষ অফার', 'Special offer')}</span>}
          {!inStock && <div className="absolute inset-0 flex items-center justify-center bg-background/75 backdrop-blur-[2px]"><span className="rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background shadow-lg">{t('স্টকে নেই', 'Out of stock')}</span></div>}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400"><Star className="h-3.5 w-3.5 fill-current" /> 5.0</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground">{t('জনপ্রিয়', 'Popular')}</span>
            </div>
            <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-foreground sm:text-base">
              {lang === 'en' ? (product.name_en || product.name_bn) : (product.name_bn || product.name_en)}
            </h3>
            {lang === 'bn' && product.name_en && product.name_bn && <p className="mt-1 line-clamp-1 text-[11px] font-medium text-muted-foreground">{product.name_en}</p>}
          </div>

          <div className="mt-auto space-y-3">
            <div className="flex items-end justify-between gap-2 border-t border-border/60 pt-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-lg font-black tracking-tight text-emerald-700 dark:text-emerald-400 sm:text-xl">{formatPrice(price)}</span>
                {discount > 0 && <span className="text-xs font-semibold text-muted-foreground line-through">{formatPrice(product.regular_price)}</span>}
              </div>
              <span className="hidden text-[10px] font-semibold text-muted-foreground sm:block">{inStock ? t('স্টকে আছে', 'In stock') : t('স্টক শেষ', 'Sold out')}</span>
            </div>
            <div className={`grid gap-2 ${stackedActions ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <button onClick={handleAddToCart} disabled={!inStock} className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600/25 bg-emerald-50 py-2.5 px-2 text-[11px] font-bold text-emerald-900 transition-all hover:bg-emerald-100 hover:shadow-sm active:scale-95 disabled:opacity-50 dark:bg-emerald-950/30 dark:text-emerald-300 sm:text-xs">
                <ShoppingCart className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{t('কার্টে যোগ', 'Add')}</span>
              </button>
              <button onClick={handleBuyNow} disabled={!inStock} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-2.5 px-2 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-emerald-800 hover:shadow-md active:scale-95 disabled:opacity-50 sm:text-xs">
                <Zap className="h-3.5 w-3.5 shrink-0 fill-current text-amber-300" /><span className="truncate">{t('কিনুন', 'Buy')}</span>
              </button>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
