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
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-2xl">
      <Link href={`/product/${product.slug}`} className="flex h-full flex-col">
        <div className="relative aspect-square w-full overflow-hidden bg-secondary/40">
          {product.image ? <img src={product.image} alt={name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><span className="text-5xl">🌱</span></div>}
          <div className="absolute inset-x-3 top-3 flex items-start justify-between">
            {discount > 0 ? <span className="rounded-full bg-rose-500 px-3 py-1 text-[10px] font-black text-white shadow-lg">-{discount}%</span> : <span />}
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 text-primary shadow-lg backdrop-blur-md transition-transform group-hover:scale-110"><Heart className="h-4 w-4" /></span>
          </div>
          {discount > 0 && <span className="absolute bottom-3 left-3 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold text-primary-foreground shadow-lg">{t('বিশেষ অফার', 'Special offer')}</span>}
          {!inStock && <div className="absolute inset-0 flex items-center justify-center bg-background/75 backdrop-blur-sm"><span className="rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background shadow-xl">{t('স্টকে নেই', 'Out of stock')}</span></div>}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
          <div>
            <div className="mb-2 flex items-center gap-2"><span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> 5.0</span><span className="h-1 w-1 rounded-full bg-border" /><span className="text-[10px] font-semibold text-muted-foreground">{t('জনপ্রিয়', 'Popular')}</span></div>
            <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-foreground sm:text-base">{name}</h3>
            {lang === 'bn' && product.name_en && product.name_bn && <p className="mt-1 line-clamp-1 text-[11px] font-medium text-muted-foreground">{product.name_en}</p>}
          </div>

          <div className="mt-auto space-y-3">
            <div className="flex items-end justify-between gap-2 border-t border-border/70 pt-3"><div className="flex flex-wrap items-baseline gap-2"><span className="text-xl font-black tracking-tight text-primary">{formatPrice(price)}</span>{discount > 0 && <span className="text-xs font-semibold text-muted-foreground line-through">{formatPrice(product.regular_price)}</span>}</div><span className="hidden text-[10px] font-bold text-muted-foreground sm:block">{inStock ? t('স্টকে আছে', 'In stock') : t('স্টক শেষ', 'Sold out')}</span></div>
            <div className={`grid gap-2 ${stackedActions ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <button onClick={handleAddToCart} disabled={!inStock} className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 px-2 py-2.5 text-[11px] font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95 disabled:opacity-50 sm:text-xs"><ShoppingCart className="h-3.5 w-3.5" /><span>{t('কার্টে যোগ', 'Add')}</span></button>
              <button onClick={handleBuyNow} disabled={!inStock} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-2 py-2.5 text-[11px] font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50 sm:text-xs"><Zap className="h-3.5 w-3.5 fill-current text-accent" /><span>{t('কিনুন', 'Buy')}</span></button>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
