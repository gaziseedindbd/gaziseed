'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Minus, Plus, ShoppingCart, Sparkles, Trash2, Truck, X } from 'lucide-react';
import { useCart } from '@/components/site/cart-provider';
import { removeFromCart, updateCartQuantity, type CartItem } from '@/lib/cart';
import { formatPrice } from '@/lib/data';
import { getVisitorCountry } from '@/lib/supabase/client';
import { useLang } from '@/components/site/language-provider';

export default function FloatingCartDrawer() {
  const { items, total, count, refresh } = useCart();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<'BD' | 'IN'>('BD');

  useEffect(() => {
    setCountry(getVisitorCountry());

    const openCart = () => setOpen(true);
    const closeCart = () => setOpen(false);

    window.addEventListener('gazi-cart-open', openCart);
    window.addEventListener('gazi-cart-close', closeCart);
    return () => {
      window.removeEventListener('gazi-cart-open', openCart);
      window.removeEventListener('gazi-cart-close', closeCart);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const freeDeliveryTarget = country === 'IN' ? 999 : 600;
  const remaining = Math.max(0, freeDeliveryTarget - total);
  const progress = Math.min(100, Math.round((total / freeDeliveryTarget) * 100));

  const message = useMemo(() => {
    if (items.length === 0) return t('আপনার কার্ট এখনো খালি।', 'Your cart is empty.');
    if (remaining <= 0) return t('অভিনন্দন! আপনার ফ্রি ডেলিভারি আনলক হয়েছে।', 'Great! Free delivery is unlocked.');
    return country === 'IN'
      ? `আর ${formatPrice(remaining)} যোগ করলে ফ্রি ডেলিভারি পাবেন।`
      : `আর ${formatPrice(remaining)} যোগ করলে ফ্রি ডেলিভারি পাবেন।`;
  }, [country, items.length, remaining, t]);

  const changeQuantity = (item: CartItem, nextQuantity: number) => {
    updateCartQuantity(item.product_id, nextQuantity, item.variant_id, item.bundle_id);
    refresh();
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={t('কার্ট বন্ধ করুন', 'Close cart')}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-[2px] transition-opacity"
        />
      )}

      <aside
        aria-label={t('শপিং কার্ট', 'Shopping cart')}
        className={`fixed right-0 top-0 z-[90] flex h-dvh w-full max-w-[430px] flex-col border-l border-emerald-100 bg-white shadow-[-24px_0_70px_-30px_rgba(5,46,22,.5)] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                <ShoppingCart className="h-5 w-5 text-emerald-700" />
              </span>
              <div>
                <h2 className="text-base font-black">{t('আপনার কার্ট', 'Your Cart')}</h2>
                <p className="text-[11px] font-semibold text-slate-400">{count} {t('টি আইটেম', 'items')}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label={t('বন্ধ করুন', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-lime-50/60 to-white px-5 py-4 sm:px-6">
            <div className="mb-2 flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <p className="text-xs font-bold leading-5 text-emerald-900">{message}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white shadow-inner">
              <div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span>{formatPrice(total)}</span>
              <span>{formatPrice(freeDeliveryTarget)} {t('ফ্রি ডেলিভারি', 'free delivery')}</span>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {items.length === 0 ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-emerald-50">
                <ShoppingCart className="h-9 w-9 text-emerald-600" />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-900">{t('কার্ট খালি', 'Your cart is empty')}</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{t('পছন্দের বীজ কার্টে যোগ করুন এবং অর্ডার শুরু করুন।', 'Add your favorite seeds to the cart and start your order.')}</p>
              <Link
                href="/all-products"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-900"
              >
                {t('শপিং শুরু করুন', 'Start Shopping')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article
                  key={`${item.product_id}:${item.variant_id || ''}:${item.bundle_id || ''}`}
                  className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/55 p-3 transition hover:border-emerald-100 hover:bg-white"
                >
                  <Link href={`/product/${item.slug}`} onClick={() => setOpen(false)} className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-emerald-50">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">🌱</div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <Link href={`/product/${item.slug}`} onClick={() => setOpen(false)} className="line-clamp-2 min-w-0 flex-1 text-sm font-black leading-5 text-slate-900 hover:text-emerald-700">
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => { removeFromCart(item.product_id, item.variant_id, item.bundle_id); refresh(); }}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={t('পণ্য মুছুন', 'Remove product')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-emerald-800">{formatPrice(item.unit_price)}</span>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => changeQuantity(item, item.quantity - 1)}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                          aria-label={t('একটি কমান', 'Decrease quantity')}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-black text-slate-800">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(item, item.quantity + 1)}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                          aria-label={t('একটি বাড়ান', 'Increase quantity')}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-right text-[11px] font-bold text-slate-500">{formatPrice(item.unit_price * item.quantity)}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-slate-100 bg-white px-5 pb-5 pt-4 shadow-[0_-16px_40px_-32px_rgba(5,46,22,.5)] sm:px-6">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-slate-500">
              <Truck className="h-4 w-4 text-emerald-700" />
              <span>{remaining <= 0 ? t('ফ্রি ডেলিভারি প্রযোজ্য', 'Free delivery applies') : t('ডেলিভারি চার্জ চেকআউটে নির্ধারিত হবে', 'Delivery charge is calculated at checkout')}</span>
              {remaining <= 0 && <Check className="ml-auto h-4 w-4 text-emerald-600" />}
            </div>
            <div className="mb-4 flex items-end justify-between">
              <span className="text-sm font-bold text-slate-500">{t('Subtotal', 'Subtotal')}</span>
              <span className="text-2xl font-black tracking-tight text-slate-950">{formatPrice(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
              >
                {t('কার্ট দেখুন', 'View Cart')}
              </Link>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-900"
              >
                {t('চেকআউট', 'Checkout')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
