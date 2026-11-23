'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Truck, PackageCheck, Leaf } from 'lucide-react';
import { useCart } from '@/components/site/cart-provider';
import { updateCartQuantity, removeFromCart, type CartItem } from '@/lib/cart';
import { formatPrice } from '@/lib/data';
import { useLang } from '@/components/site/language-provider';
import CartFreeDeliveryProgress from '@/components/site/cart-free-delivery-progress';

type CartItemWithDiscount = CartItem & { regular_price: number };

export default function CartPage() {
  const { items, total, refresh } = useCart();
  const { t } = useLang();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);
  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <main className="min-h-[75vh] bg-[radial-gradient(ellipse_at_top,_#e8f5ec_0%,_#ffffff_72%)] px-4 py-12 sm:py-20">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-emerald-100 bg-white p-8 text-center shadow-[0_24px_70px_-38px_rgba(6,78,42,.35)] sm:p-14">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700"><ShoppingBag className="h-9 w-9" /></div>
          <span className="mt-5 block text-[10px] font-black uppercase tracking-[.22em] text-emerald-700">GAZI SEED · SHOPPING</span>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{t('আপনার কার্ট খালি', 'Your cart is empty')}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{t('আপনার পছন্দের বীজ বেছে নিয়ে আজই অর্ডার শুরু করুন।', 'Choose your favorite seeds and start your order today.')}</p>
          <Link href="/all-products" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-800 px-6 py-3 font-black text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900">{t('শপিং শুরু করুন', 'Start Shopping')}<ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>
    );
  }

  const itemsWithDiscount = items as CartItemWithDiscount[];
  const originalTotal = itemsWithDiscount.reduce((sum, item) => sum + Math.max(item.regular_price ?? item.unit_price, item.base_unit_price ?? item.unit_price) * item.quantity, 0);
  const savingsTotal = Math.max(0, originalTotal - total);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const discountPercent = originalTotal > 0 ? Math.round((savingsTotal / originalTotal) * 100) : 0;

  return (
    <main className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#f1f8f3_0%,#fbfdfb_300px,#ffffff_100%)] pb-[calc(12rem+env(safe-area-inset-bottom))] sm:pb-14">
      <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-9 lg:px-8">
        <header className="mb-6 overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_20px_60px_-42px_rgba(6,78,42,.4)]">
          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-emerald-100/70 blur-3xl" />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-emerald-800"><Leaf className="h-3.5 w-3.5" /> GAZI SEED · SHOPPING</span>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('আপনার শপিং কার্ট', 'Your Shopping Cart')}</h1>
                <p className="mt-1 text-sm text-slate-500">{itemCount} {t(itemCount === 1 ? 'টি পণ্য আপনার কার্টে আছে' : 'টি পণ্য আপনার কার্টে আছে', itemCount === 1 ? 'item in your cart' : 'items in your cart')}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-xs font-bold text-emerald-900"><ShieldCheck className="h-5 w-5 text-emerald-700" />{t('নিরাপদ শপিং', 'Secure shopping')}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-emerald-50 bg-emerald-50/50 text-center">
            <div className="px-2 py-3"><PackageCheck className="mx-auto h-4 w-4 text-emerald-700" /><p className="mt-1 text-[10px] font-bold text-slate-600">{t('আসল বীজ', 'Quality seeds')}</p></div>
            <div className="border-x border-emerald-100 px-2 py-3"><Truck className="mx-auto h-4 w-4 text-emerald-700" /><p className="mt-1 text-[10px] font-bold text-slate-600">{t('হোম ডেলিভারি', 'Home delivery')}</p></div>
            <div className="px-2 py-3"><ShieldCheck className="mx-auto h-4 w-4 text-emerald-700" /><p className="mt-1 text-[10px] font-bold text-slate-600">{t('নিরাপদ অর্ডার', 'Secure order')}</p></div>
          </div>
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)] lg:gap-7">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h2 className="text-base font-black text-slate-900 sm:text-lg">{t('কার্টের পণ্য', 'Items in your cart')}</h2>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-500 shadow-sm">{itemCount} {t(itemCount === 1 ? 'টি আইটেম' : 'টি আইটেম', itemCount === 1 ? 'item' : 'items')}</span>
            </div>
            <div className="space-y-3">
              {itemsWithDiscount.map((item) => {
                const itemBasePrice = Math.max(item.regular_price ?? item.unit_price, item.base_unit_price ?? item.unit_price);
                const itemOriginal = itemBasePrice * item.quantity;
                const itemFinal = item.unit_price * item.quantity;
                const itemSavings = Math.max(0, itemOriginal - itemFinal);
                const itemPercent = itemOriginal > 0 ? Math.round((itemSavings / itemOriginal) * 100) : 0;
                return (
                  <article key={`${item.product_id}:${item.variant_id || ''}:${item.bundle_id || ''}`} className="group grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white p-3 shadow-[0_8px_30px_-24px_rgba(15,23,42,.35)] transition hover:border-emerald-200 hover:shadow-lg sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4 sm:p-4">
                    <Link href={`/product/${item.slug}`} className="block">
                      <div className="h-[88px] w-[88px] overflow-hidden rounded-2xl border border-slate-100 bg-emerald-50 sm:h-28 sm:w-28">
                        {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center text-3xl">🌱</div>}
                      </div>
                    </Link>
                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/product/${item.slug}`} className="line-clamp-2 min-w-0 text-sm font-extrabold leading-snug text-slate-900 hover:text-emerald-800 sm:text-base">{item.name}</Link>
                        <button type="button" onClick={() => { removeFromCart(item.product_id, item.variant_id, item.bundle_id); refresh(); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label={t('মুছুন', 'Remove')}><Trash2 className="h-4 w-4" /></button>
                      </div>
                      {itemSavings > 0 ? <div className="mt-1 flex flex-wrap items-center gap-2 text-xs"><span className="text-slate-400 line-through">{formatPrice(itemBasePrice)}</span><span className="font-black text-emerald-800">{formatPrice(item.unit_price)}</span><span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600">-{itemPercent}%</span></div> : <span className="mt-1 text-xs font-semibold text-slate-500">{formatPrice(item.unit_price)} / {t('প্রতিটি', 'each')}</span>}
                      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
                        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                          <button type="button" onClick={() => { updateCartQuantity(item.product_id, item.quantity - 1, item.variant_id, item.bundle_id); refresh(); }} className="flex h-12 w-12 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-emerald-800" aria-label={t('একটি কমান','Decrease quantity')}><Minus className="h-4 w-4" /></button>
                          <span className="w-8 text-center text-sm font-black tabular-nums text-slate-900">{item.quantity}</span>
                          <button type="button" onClick={() => { updateCartQuantity(item.product_id, item.quantity + 1, item.variant_id, item.bundle_id); refresh(); }} className="flex h-12 w-12 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-emerald-800" aria-label={t('একটি বাড়ান','Increase quantity')}><Plus className="h-4 w-4" /></button>
                        </div>
                        <div className="text-right">{itemSavings > 0 && <p className="text-[11px] text-slate-400 line-through">{formatPrice(itemOriginal)}</p>}<p className="text-base font-black text-slate-950 sm:text-lg">{formatPrice(itemFinal)}</p></div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <Link href="/all-products" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50">← {t('আরও পণ্য দেখুন', 'Continue shopping')}</Link>
          </section>

          <aside className="min-w-0">
            <div className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-[0_20px_60px_-38px_rgba(6,78,42,.4)] lg:sticky lg:top-28">
              <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 px-5 py-5 text-white">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-100">{t('আপনার অর্ডার', 'YOUR ORDER')}</p>
                <h2 className="mt-1 text-xl font-black">{t('অর্ডার সারাংশ', 'Order Summary')}</h2>
                <p className="mt-1 text-xs text-emerald-100/85">{t('আপনার সাশ্রয়সহ বর্তমান হিসাব', 'Your current total and savings')}</p>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">{t('সাধারণ মূল্য', 'Original Price')}</span><span className="font-semibold text-slate-500">{formatPrice(originalTotal)}</span></div>
                {savingsTotal > 0 && <div className="flex justify-between gap-3 text-sm text-emerald-700"><span className="font-bold">{t('আপনার ছাড়', 'Your discount')} ({discountPercent}%)</span><span className="font-black">-{formatPrice(savingsTotal)}</span></div>}
                <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">{t('অফারসহ পণ্যের মোট', 'Offer / product total')}</span><span className="font-bold text-slate-900">{formatPrice(total)}</span></div>
                <CartFreeDeliveryProgress items={items} subtotal={total} />
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-800">{t('পণ্যের মোট', 'Product subtotal')}</p>
                  <div className="mt-1 flex items-end justify-between gap-3"><span className="text-sm font-bold text-slate-700">{itemCount} {t(itemCount === 1 ? 'টি পণ্য' : 'টি পণ্য', itemCount === 1 ? 'item' : 'items')}</span><span className="text-2xl font-black tracking-tight text-emerald-900">{formatPrice(total)}</span></div>
                  {savingsTotal > 0 && <p className="mt-1 text-xs font-bold text-emerald-700">{t('আপনি সাশ্রয় করছেন', 'You save')} {formatPrice(savingsTotal)}</p>}
                </div>
                <Link href="/checkout" className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 py-4 text-base font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-900 active:scale-[.99]">{t('চেকআউটে এগিয়ে যান', 'Proceed to checkout')}<ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <div className="sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 mt-4 lg:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-[0_18px_50px_-20px_rgba(6,78,42,.45)] backdrop-blur-xl">
          <div className="min-w-0 flex-1 pl-1"><p className="text-[10px] font-bold text-slate-500">{t('পণ্যের মোট', 'Product total')}</p><p className="truncate text-lg font-black text-emerald-900">{formatPrice(total)}</p></div>
          <Link href="/checkout" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-xs font-black text-white">{t('চেকআউট', 'Checkout')}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </main>
  );
}
