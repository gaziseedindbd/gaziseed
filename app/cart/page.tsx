'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/components/site/cart-provider';
import { updateCartQuantity, removeFromCart, type CartItem } from '@/lib/cart';
import { formatPrice } from '@/lib/data';
import { useLang } from '@/components/site/language-provider';

type CartItemWithDiscount = CartItem & { regular_price: number };

export default function CartPage() {
  const { items, total, refresh } = useCart();
  const { t } = useLang();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <div className="container-custom py-12 sm:py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-primary/15 bg-card p-10 text-center shadow-xl sm:p-14">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10"><ShoppingBag className="h-9 w-9 text-primary" /></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">SUPER KING SEED</span>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{t('আপনার কার্ট খালি', 'Your cart is empty')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('কার্টে কোন পণ্য নেই', 'No items in your cart')}</p>
          <Link href="/all-products" className="mt-7 inline-flex items-center gap-2 btn-primary">{t('শপিং করুন', 'Shop Now')}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    );
  }

  const itemsWithDiscount = items as CartItemWithDiscount[];
  const originalTotal = itemsWithDiscount.reduce((sum, item) => sum + (item.regular_price || item.unit_price) * item.quantity, 0);
  const savingsTotal = originalTotal - total;
  const discountPercent = originalTotal > 0 ? Math.round((savingsTotal / originalTotal) * 100) : 0;

  return (
    <div className="container-custom py-7 sm:py-10">
      <div className="mb-7 rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-accent/10 px-5 py-7 shadow-sm sm:px-8">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">SUPER KING SEED</span>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{t('কার্ট', 'Cart')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{items.length} {t('টি পণ্য আপনার কার্টে আছে', 'items in your cart')}</p>
      </div>

      <div className="grid gap-7 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="space-y-3">
            {itemsWithDiscount.map((item) => {
              const itemOriginal = (item.regular_price || item.unit_price) * item.quantity;
              const itemFinal = item.unit_price * item.quantity;
              const itemSavings = itemOriginal - itemFinal;
              const itemPercent = itemOriginal > 0 ? Math.round((itemSavings / itemOriginal) * 100) : 0;
              return (
                <div key={item.product_id} className="group flex gap-3 rounded-[1.5rem] border border-border/70 bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg sm:gap-4 sm:p-4">
                  <Link href={`/product/${item.slug}`} className="shrink-0">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl bg-secondary/40 sm:h-28 sm:w-28">
                      {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center text-3xl">🌱</div>}
                    </div>
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2"><Link href={`/product/${item.slug}`} className="line-clamp-2 font-extrabold leading-snug hover:text-primary">{item.name}</Link><button onClick={() => { removeFromCart(item.product_id); refresh(); }} className="shrink-0 rounded-xl p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" aria-label={t('মুছুন', 'Remove')}><Trash2 className="h-4 w-4" /></button></div>
                    {itemSavings > 0 ? <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground line-through">{formatPrice(item.regular_price)}</span><span className="font-black text-primary">{formatPrice(item.unit_price)}</span><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">-{itemPercent}%</span></div> : <span className="text-xs text-muted-foreground">{formatPrice(item.unit_price)} / {t('প্রতিটি', 'each')}</span>}
                    <div className="mt-auto flex items-end justify-between gap-2"><div className="flex items-center rounded-xl border border-input bg-background p-0.5"><button onClick={() => { updateCartQuantity(item.product_id, item.quantity - 1); refresh(); }} className="rounded-lg p-2 transition hover:bg-secondary"><Minus className="h-3 w-3" /></button><span className="w-8 text-center text-sm font-black">{item.quantity}</span><button onClick={() => { updateCartQuantity(item.product_id, item.quantity + 1); refresh(); }} className="rounded-lg p-2 transition hover:bg-secondary"><Plus className="h-3 w-3" /></button></div><div className="text-right">{itemSavings > 0 && <p className="text-xs text-muted-foreground line-through">{formatPrice(itemOriginal)}</p>}<p className="text-base font-black text-primary sm:text-lg">{formatPrice(itemFinal)}</p></div></div>
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/all-products" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">← {t('শপিং চালিয়ে যান', 'Continue Shopping')}</Link>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-32 overflow-hidden rounded-[1.75rem] border border-primary/15 bg-card shadow-xl">
            <div className="bg-primary px-5 py-4 text-primary-foreground"><h2 className="font-black">{t('অর্ডার সারাংশ', 'Order Summary')}</h2><p className="mt-0.5 text-xs opacity-80">{t('আপনার সাশ্রয়সহ মোট হিসাব', 'Total with your savings')}</p></div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('সাধারণ মূল্য', 'Original Price')}</span><span className="text-muted-foreground line-through">{formatPrice(originalTotal)}</span></div>
              {savingsTotal > 0 && <div className="flex justify-between"><span className="font-bold text-primary">{t('ছাড়', 'Discount')} ({discountPercent}%)</span><span className="font-bold text-primary">-{formatPrice(savingsTotal)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">{t('অফার মূল্য', 'Offer Price')}</span><span className="font-bold">{formatPrice(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('ডেলিভারি চার্জ', 'Delivery Charge')}</span><span className="text-right text-xs text-muted-foreground">{t('চেকআউটে নির্ধারিত', 'Determined at checkout')}</span></div>
              <div className="mt-2 rounded-2xl bg-primary/5 p-4"><div className="flex justify-between text-base font-black"><span>{t('মোট', 'Total')}</span><span className="text-xl text-primary">{formatPrice(total)}</span></div>{savingsTotal > 0 && <p className="mt-1 text-xs font-semibold text-primary">{t('আপনি সাশ্রয় করছেন', 'You save')} {formatPrice(savingsTotal)}</p>}</div>
              <Link href="/checkout" className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl">{t('চেকআউট', 'Checkout')}<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
