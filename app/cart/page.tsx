'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearCart, CartItem, loadCart, updateCart } from '@/lib/cart';
import { formatMoney } from '@/lib/country';

type StoreCountry = 'BD' | 'IN';
const COUNTRY_KEY = 'seed-bari-country';

function getStoreCountry(): StoreCountry {
  if (typeof document === 'undefined') return 'BD';
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COUNTRY_KEY}=`))
    ?.split('=')[1];

  return value === 'IN' ? 'IN' : 'BD';
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState<StoreCountry>('BD');

  async function refresh() {
    setLoading(true);
    setCountry(getStoreCountry());
    setItems(await loadCart());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    window.addEventListener('gazi-cart', refresh);
    return () => window.removeEventListener('gazi-cart', refresh);
  }, []);

  const subtotal = items.reduce(
    (total: number, item: any) =>
      total +
      Number(
        item.variant?.sale_price ??
          item.variant?.price ??
          item.product?.sale_price ??
          item.product?.regular_price ??
          0,
      ) * item.quantity,
    0,
  );

  const currencyLabel = country === 'BD' ? 'BDT' : 'INR';

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-black">Your Cart</h1>
            <p className="mt-2 text-sm text-gray-500">
              Prices are shown in {currencyLabel} for the selected store.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-10">Loading…</p>
        ) : !items.length ? (
          <div className="mt-8 rounded-2xl border bg-white p-10 text-center">
            <p className="text-5xl">🛒</p>
            <h2 className="mt-4 text-xl font-bold">Your cart is empty</h2>
            <Link
              href="/shop"
              className="mt-5 inline-block rounded-xl bg-[#1f6b3b] px-6 py-3 font-bold text-white"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_340px]">
            <section className="space-y-4">
              {items.map((item: any) => {
                const unitPrice = Number(
                  item.variant?.sale_price ??
                    item.variant?.price ??
                    item.product?.sale_price ??
                    item.product?.regular_price ??
                    0,
                );

                return (
                  <div key={item.id} className="rounded-2xl border bg-white p-5">
                    <div className="flex justify-between gap-4">
                      <div>
                        <h2 className="font-bold">
                          {item.product?.name_en || item.product?.name_bn}
                        </h2>
                        {item.variant?.name ? (
                          <p className="mt-1 text-sm text-gray-500">
                            Variant: {item.variant.name}
                          </p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => updateCart(item.id, 0).then(refresh)}
                        className="text-sm text-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() =>
                          updateCart(item.id, Math.max(0, item.quantity - 1)).then(refresh)
                        }
                        className="h-9 w-9 rounded-lg border"
                        aria-label={`Decrease quantity of ${item.product?.name_en || item.product?.name_bn || 'item'}`}
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCart(item.id, item.quantity + 1).then(refresh)}
                        className="h-9 w-9 rounded-lg border"
                        aria-label={`Increase quantity of ${item.product?.name_en || item.product?.name_bn || 'item'}`}
                      >
                        +
                      </button>
                      <strong className="ml-auto">
                        {formatMoney(unitPrice * item.quantity, country)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </section>

            <aside className="h-fit rounded-2xl border bg-white p-6">
              <h2 className="text-xl font-bold">Summary</h2>
              <div className="mt-5 flex justify-between">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal, country)}</strong>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Shipping and coupon are calculated at checkout.
              </p>
              <Link
                href="/checkout"
                className="mt-6 block rounded-xl bg-[#1f6b3b] px-5 py-3 text-center font-bold text-white"
              >
                Proceed to Checkout
              </Link>
              <button
                onClick={() => clearCart().then(refresh)}
                className="mt-3 w-full rounded-xl border px-5 py-3"
              >
                Clear Cart
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
