'use client';

import Link from 'next/link';
import { ShoppingCart, Zap, Heart, Star, ArrowUpRight, Leaf, Package } from 'lucide-react';
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
  const translations = (product as any).translations || {};
  const translated = translations?.[lang] || {};
  const name =
    translated.name ||
    (lang === 'en'
      ? (product.name_en || product.name_bn)
      : lang === 'hi'
        ? (product.name_en || product.name_bn)
        : (product.name_bn || product.name_en));
  const secondaryName =
    lang === 'hi' ? (product.name_en || product.name_bn) : lang === 'bn' ? product.name_en : product.name_bn;

  const badge = product.is_best_seller
    ? t('বেস্ট সেলার', 'Best Seller', 'बेस्ट सेलर')
    : product.is_new_arrival
      ? t('নতুন এসেছে', 'New Arrival', 'नया आया')
      : product.is_featured
        ? t('জনপ্রিয়', 'Popular', 'लोकप्रिय')
        : product.is_seasonal
          ? t('মৌসুমি', 'Seasonal', 'मौसमी')
          : null;

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!inStock) {
      toast(t('পণ্যটি স্টকে নেই', 'Out of stock', 'स्टॉक में नहीं है'), 'error');
      return;
    }

    const image = e.currentTarget.closest('article')?.querySelector('img');
    const sourceRect = image?.getBoundingClientRect();

    addToCart(product, 1);
    toast(t('কার্টে যোগ করা হয়েছে', 'Added to cart', 'कार्ट में जोड़ा गया'));

    if (image && sourceRect) {
      window.dispatchEvent(
        new CustomEvent('gazi-cart-fly', {
          detail: {
            image: image.currentSrc || image.src,
            sourceRect: {
              left: sourceRect.left,
              top: sourceRect.top,
              width: sourceRect.width,
              height: sourceRect.height,
            },
          },
        })
      );
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!inStock) {
      toast(t('পণ্যটি স্টকে নেই', 'Out of stock', 'स्टॉक में नहीं है'), 'error');
      return;
    }

    addToCart(product, 1);
    router.push('/checkout');
  };

  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.2rem] border border-slate-200/70 bg-white shadow-[0_12px_34px_-24px_rgba(15,23,42,.48)] ring-1 ring-black/[0.02] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-emerald-300/70 hover:shadow-[0_28px_70px_-34px_rgba(5,150,105,.34)] hover:ring-emerald-500/10 sm:rounded-[1.7rem] active:scale-[.995]">
      <Link href={`/product/${product.slug}`} className="group block min-w-0">
        <div className="relative mx-1.5 mt-1.5 aspect-[.96] overflow-hidden rounded-[1rem] bg-gradient-to-br from-[#f7fbf8] via-[#eef7f1] to-[#f6f2e8] ring-1 ring-emerald-900/[0.04] sm:mx-2.5 sm:mt-2.5 sm:rounded-[1.3rem]">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-emerald-200/25 blur-2xl transition-transform duration-500 group-hover:scale-125" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-lime-200/20 blur-2xl transition-transform duration-500 group-hover:scale-125" />

          {product.image ? (
            <img
              src={product.image}
              alt={translated.image_alt || product.image_alt || product.image_alt_bn || name}
              className="relative z-[1] h-full w-full object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-[1.045] sm:p-5"
              loading="lazy"
            />
          ) : (
            <div className="relative z-[1] flex h-full w-full items-center justify-center">
              <Leaf className="h-12 w-12 text-emerald-300 sm:h-16 sm:w-16" />
            </div>
          )}

          <div className="absolute inset-x-2.5 top-2.5 z-[3] flex items-start justify-between sm:inset-x-3.5 sm:top-3.5">
            {badge ? (
              <span className="rounded-full border border-white/70 bg-emerald-700/95 px-2.5 py-1.5 text-[8px] font-black text-white shadow-lg shadow-emerald-900/15 backdrop-blur sm:px-3.5 sm:text-[10px]">
                {badge}
              </span>
            ) : (
              <span />
            )}

            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/75 bg-white/92 text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-all duration-300 group-hover:scale-[1.03] sm:h-10 sm:w-10"
            >
              <Heart className="h-4 w-4 sm:h-[17px] sm:w-[17px]" />
            </span>
          </div>

          {discount > 0 && (
            <span className="absolute bottom-2.5 left-2.5 z-[3] inline-flex items-center rounded-full border border-white/20 bg-red-500 px-2.5 py-1.5 text-[9px] font-black text-white shadow-lg shadow-red-900/10 sm:left-3.5 sm:px-3 sm:text-[10px]">
              {discount}% {t('ছাড়', 'OFF', 'छूट')}
            </span>
          )}

          {product.packet_weight && (
            <span className="absolute bottom-2.5 right-2.5 z-[3] inline-flex items-center gap-1.5 rounded-full border border-white/75 bg-white/92 px-2.5 py-1.5 text-[9px] font-extrabold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur-md sm:right-3.5 sm:px-3 sm:text-[10px]">
              <Package className="h-3 w-3 text-emerald-700" />
              {product.packet_weight}
            </span>
          )}

          {!inStock && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/72 backdrop-blur-sm">
              <span className="rounded-full bg-slate-950 px-4 py-2 text-[11px] font-bold text-white shadow-xl sm:text-xs">
                {t('স্টকে নেই', 'Out of stock', 'स्टॉक में नहीं')}
              </span>
            </div>
          )}

          <span
            aria-hidden="true"
            className="absolute right-3 top-[4.15rem] z-[4] flex h-9 w-9 translate-x-1 items-center justify-center rounded-xl border border-white/70 bg-white/92 text-slate-900 shadow-lg shadow-slate-900/10 backdrop-blur-md opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        <div className="flex flex-col gap-2.5 px-3 pb-3 pt-3 sm:gap-3.5 sm:px-4.5 sm:pb-4 sm:pt-4.5 lg:px-5 lg:pb-4.5 lg:pt-5">
          <div className="min-w-0">
            <div className="mb-1.5 flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-[8px] font-extrabold text-amber-700 sm:text-[10px]">
                <Star className="h-2.5 w-2.5 fill-current sm:h-3 sm:w-3" />
                {t('মান যাচাই', 'Quality', 'गुणवत्ता')}
              </span>
              {product.seed_type && (
                <span className="max-w-full text-[9px] font-semibold leading-tight text-slate-400 sm:text-[10px]">{product.seed_type}</span>
              )}
            </div>

            <h3 className="line-clamp-2 text-[13px] font-black leading-[1.4] tracking-[-.012em] text-slate-900 sm:text-[15px] lg:text-[16px]">
              {name}
            </h3>

            {secondaryName && secondaryName !== name && (
              <p className="mt-1 line-clamp-1 text-[9px] font-medium text-slate-400 sm:text-[11px]">{secondaryName}</p>
            )}

            {product.short_description && (
              <p className="mt-1 line-clamp-2 text-[9px] leading-[1.55] text-slate-500 sm:mt-2 sm:text-[10px]">
                {product.short_description}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="mt-auto px-3 pb-4.5 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5">
        <div className="mb-2.5 flex min-w-0 items-end justify-between gap-2 border-t border-slate-100 pt-2.5 sm:mb-3 sm:pt-3.5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[1.05rem] font-black tracking-tight text-emerald-800 sm:text-[1.4rem]">
              {formatPrice(price)}
            </span>
            {discount > 0 && (
              <span className="text-[10px] font-semibold text-slate-400 line-through sm:text-xs">
                {formatPrice(product.regular_price)}
              </span>
            )}
          </div>

          <span
            className={
              `shrink-0 rounded-full px-2.5 py-1 text-[8px] font-bold sm:text-[9px] ${
                inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`
            }
          >
            {inStock
              ? t('স্টকে আছে', 'In stock', 'स्टॉक में')
              : t('স্টক শেষ', 'Sold out', 'स्टॉक समाप्त')}
          </span>
        </div>

        <div className={`grid gap-2 ${stackedActions ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <button
            onClick={handleAddToCart}
            disabled={!inStock}
            className="flex min-w-0 items-center justify-center gap-1.5 min-h-11 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-2.5 py-2.5 text-[9px] font-black text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-600 hover:text-white hover:shadow-[0_10px_20px_-12px_rgba(5,150,105,.55)] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-[10px]"
          >
            <ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>{t('কার্টে যোগ', 'Add to Cart', 'कार्ट में जोड़ें')}</span>
          </button>

          <button
            onClick={handleBuyNow}
            disabled={!inStock}
            className="flex min-w-0 items-center justify-center gap-1.5 min-h-11 rounded-xl bg-gradient-to-r from-slate-950 to-slate-900 px-2.5 py-2.5 text-[9px] font-black text-white shadow-[0_10px_24px_-16px_rgba(15,23,42,.75)] transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-700 hover:to-emerald-600 hover:shadow-[0_14px_28px_-16px_rgba(5,150,105,.6)] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-[10px]"
          >
            <Zap className="h-3 w-3 fill-current text-lime-300 sm:h-3.5 sm:w-3.5" />
            <span>{t('এখনই কিনুন', 'Buy Now', 'अभी खरीदें')}</span>
          </button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2.5 text-[7.5px] font-semibold text-slate-400 sm:text-[9px]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t('গুণমান যাচাই', 'Quality checked', 'गुणवत्ता जाँची गई')}
          </span>
          <span className="h-3 w-px bg-slate-200" />
          <span>{t('দ্রুত ডেলিভারি', 'Fast delivery', 'तेज़ डिलीवरी')}</span>
        </div>
      </div>
    </article>
  );
}
