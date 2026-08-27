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
      <div className="container-custom py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-12 text-center">
          <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
          <h1 className="text-xl font-bold">{t('আপনার কার্ট খালি', 'Your cart is empty')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('কার্টে কোন পণ্য নেই', 'No items in your cart')}</p>
          <Link href="/all-products" className="mt-6 inline-block btn-primary">
            {t('শপিং করুন', 'Shop Now')}
          </Link>
        </div>
      </div>
    );
  }

  const itemsWithDiscount = items as CartItemWithDiscount[];
  const originalTotal = itemsWithDiscount.reduce((sum, item) => sum + (item.regular_price || item.unit_price) * item.quantity, 0);
  const savingsTotal = originalTotal - total;
  const discountPercent = originalTotal > 0 ? Math.round((savingsTotal / originalTotal) * 100) : 0;

  return (
    <div className="container-custom py-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t('কার্ট', 'Cart')}</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cart items */}
        <div className="lg:col-span-2">
          <div className="space-y-3">
            {itemsWithDiscount.map((item) => {
              const itemOriginal = (item.regular_price || item.unit_price) * item.quantity;
              const itemFinal = item.unit_price * item.quantity;
              const itemSavings = itemOriginal - itemFinal;
              const itemPercent = itemOriginal > 0 ? Math.round((itemSavings / itemOriginal) * 100) : 0;
              return (
                <div key={item.product_id} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                  <Link href={`/product/${item.slug}`} className="shrink-0">
                    <div className="h-20 w-20 overflow-hidden rounded-lg bg-secondary/30">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl">🌱</div>
                      )}
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col">
                    <Link href={`/product/${item.slug}`} className="font-medium hover:text-primary">
                      {item.name}
                    </Link>
                    {itemSavings > 0 ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground line-through">{formatPrice(item.regular_price)}</span>
                        <span className="font-medium text-primary">{formatPrice(item.unit_price)}</span>
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">-{itemPercent}%</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">{formatPrice(item.unit_price)} / {t('প্রতিটি', 'each')}</span>
                    )}

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-input">
                        <button onClick={() => { updateCartQuantity(item.product_id, item.quantity - 1); refresh(); }} className="p-2 hover:bg-secondary">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => { updateCartQuantity(item.product_id, item.quantity + 1); refresh(); }} className="p-2 hover:bg-secondary">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {itemSavings > 0 && <p className="text-xs text-muted-foreground line-through">{formatPrice(itemOriginal)}</p>}
                          <p className="font-bold">{formatPrice(itemFinal)}</p>
                        </div>
                        <button onClick={() => { removeFromCart(item.product_id); refresh(); }} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label={t('মুছুন', 'Remove')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Link href="/all-products" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            ← {t('শপিং চালিয়ে যান', 'Continue Shopping')}
          </Link>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-bold">{t('অর্ডার সারাংশ', 'Order Summary')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('সাধারণ মূল্য', 'Original Price')}</span>
                <span className="text-muted-foreground line-through">{formatPrice(originalTotal)}</span>
              </div>
              {savingsTotal > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-green-600">{t('ছাড়', 'Discount')} ({discountPercent}%)</span>
                    <span className="font-medium text-green-600">-{formatPrice(savingsTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('আপনার সাশ্রয়', 'Your Savings')}</span>
                    <span className="font-medium text-green-600">{formatPrice(savingsTotal)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('অফার মূল্য', 'Offer Price')}</span>
                <span className="font-medium">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('ডেলিভারি চার্জ', 'Delivery Charge')}</span>
                <span className="text-muted-foreground">{t('চেকআউটে নির্ধারিত', 'Determined at checkout')}</span>
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex justify-between text-base font-bold">
                  <span>{t('মোট', 'Total')}</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
            <Link href="/checkout" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              {t('চেকআউট', 'Checkout')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
